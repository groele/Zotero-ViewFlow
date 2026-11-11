import { renderLookupTitle } from './lookup-title.ts';
/**
 * Zotero ViewFlow - Dedicated Reverse Lookup Sidebar Section
 *
 * Implements a standalone item-pane section for citation reverse lookup.
 * Keeps the standard citation preview pane clean and decoupled.
 */

import { parseCompactCitation, queryPhysicalCandidates, verifyAndFilterCandidates, locateItemInZotero, openItemAttachment } from './citation-lookup.ts';
import type { CitationCacheManager } from './citation-cache.ts';
import type { PreviewFacade } from './contracts.ts';

const cleanups = new WeakMap<HTMLElement, () => void>();

export interface LookupSectionContext {
	cacheManager: CitationCacheManager;
	stylesheetURI: string;
	log: (msg: string) => void;
	pref: (name: string) => unknown;
}

export function buildLookupSectionDOM(
	doc: Document,
	context: LookupSectionContext,
	body: HTMLElement
): void {
	cleanups.get(body)?.();
	doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');
	body.innerHTML = '';
	body.className = 'zotero-viewflow-lookup-body';
	// Each native pane can initialize independently or inside its own shadow tree.
	const sheet = doc.createElementNS('http://www.w3.org/1999/xhtml', 'link');
	sheet.setAttribute('rel', 'stylesheet');
	sheet.setAttribute('href', context.stylesheetURI);
	body.appendChild(sheet);

	const container = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
	container.className = 'viewflow-lookup-container';

	// Input box
	const input = doc.createElementNS('http://www.w3.org/1999/xhtml', 'input') as HTMLInputElement;
	input.type = 'text';
	input.className = 'viewflow-lookup-input';
	input.setAttribute('data-l10n-id', 'zotero-preview-lookup-input');

	// Buttons
	const btnRow = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
	btnRow.className = 'viewflow-lookup-actions';

	const searchBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLButtonElement;
	searchBtn.className = 'viewflow-lookup-search';
	searchBtn.setAttribute('data-l10n-id', 'zotero-preview-lookup-search');

	const clipBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLButtonElement;
	clipBtn.setAttribute('data-l10n-id', 'zotero-preview-lookup-clipboard');

	btnRow.appendChild(searchBtn);
	btnRow.appendChild(clipBtn);

	// Status feedback area
	const statusDiv = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
	statusDiv.setAttribute('role', 'status');
	statusDiv.setAttribute('aria-live', 'polite');
	statusDiv.className = 'viewflow-lookup-status';

	const cacheNotice = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
	cacheNotice.className = 'viewflow-lookup-cache-error';
	cacheNotice.hidden = true;
	const cacheMsg = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
	const retryBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLButtonElement;
	retryBtn.type = 'button';
	retryBtn.className = 'viewflow-lookup-cache-retry';
	cacheNotice.appendChild(cacheMsg);
	cacheNotice.appendChild(retryBtn);

	container.appendChild(input);
	container.appendChild(btnRow);
	container.appendChild(cacheNotice);
	container.appendChild(statusDiv);
	body.appendChild(container);

	let request = 0;
	const setL10n = (el: Element, id: string, fallback: string, args?: Record<string, unknown>) => {
		el.setAttribute('data-l10n-id', id);
		if (args) el.setAttribute('data-l10n-args', JSON.stringify(args));
		else el.removeAttribute('data-l10n-args');
		el.textContent = fallback;
	};
	setL10n(retryBtn, 'zotero-preview-cache-retry', '重试保存缓存');
	const syncCacheStatus = () => {
		if (!body.isConnected) return;
		if (context.cacheManager?.saveFailed || context.cacheManager?.lastError) {
			cacheNotice.hidden = false;
			setL10n(cacheMsg, 'zotero-preview-cache-save-failed', '历史缓存写入失败，记录暂存于内存，请点击重试保存。');
		} else {
			cacheNotice.hidden = true;
			cacheMsg.textContent = '';
		}
	};
	const offCacheStatus = context.cacheManager?.onStatusChange?.(syncCacheStatus);
	retryBtn.onclick = async () => {
		try {
			await (context.cacheManager?.retrySave ? context.cacheManager.retrySave() : context.cacheManager?.flush?.());
		} catch (_) {}
		syncCacheStatus();
	};
	syncCacheStatus();
	input.oninput = () => { request++; };
	cleanups.set(body, () => { request++; offCacheStatus?.(); });
	const executeLookup = async (textToSearch: string) => {
		const current = ++request;
		const active = () => current === request && body.isConnected;
		try {
		if (!textToSearch.trim()) {
			setL10n(statusDiv, 'zotero-preview-lookup-status-empty', '请输入或粘贴引文');
			return;
		}
		setL10n(statusDiv, 'zotero-preview-lookup-status-searching', '正在反查本地文献库...');

		const renderItemResult = (target: Zotero.Item, labelPrefix: string, l10nId = 'zotero-preview-lookup-state-matched') => {
			statusDiv.removeAttribute('data-l10n-id');
			statusDiv.removeAttribute('data-l10n-args');
			statusDiv.innerHTML = '';
			const card = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
			card.className = 'viewflow-lookup-card';

			const head = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
			head.className = 'viewflow-lookup-card-head';

			const status = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			status.className = 'viewflow-lookup-result-state';
			setL10n(status, l10nId, labelPrefix.replace(/🎯|：/g, '').trim());
			card.appendChild(status);
			renderLookupTitle(head, String(target.getField('title')));
			card.appendChild(head);

			const meta = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;
			meta.className = 'viewflow-lookup-card-meta';

			const journal = target.getField('publicationTitle') || target.getField('journalAbbreviation') || '';
			const year = target.getField('year') || target.getField('date') || '';
			meta.textContent = `${journal} (${year}) · Vol.${target.getField('volume') || '-'} · pp.${target.getField('pages') || '-'}`;
			card.appendChild(meta);

			const actRow = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLElement;

			const locateBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLButtonElement;
			locateBtn.setAttribute('data-l10n-id', 'zotero-preview-lookup-locate');

			locateBtn.onclick = async () => {
				const located = await locateItemInZotero(target);
				if (active()) {
					setL10n(
						status,
						located ? 'zotero-preview-lookup-status-located' : 'zotero-preview-lookup-status-locate-failed',
						located ? '已定位' : '定位失败，请重试'
					);
				}
			};
			actRow.className = 'viewflow-lookup-actions';
			actRow.appendChild(locateBtn);

			const pdfBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLButtonElement;
			pdfBtn.setAttribute('data-l10n-id', 'zotero-preview-lookup-open-pdf');

			pdfBtn.onclick = async () => {
				const opened = await openItemAttachment(target);
				if (active() && !opened && !meta.textContent?.includes('未找到 PDF 附件')) {
					meta.textContent += ' (未找到 PDF 附件)';
				}
			};
			actRow.appendChild(pdfBtn);

			card.appendChild(actRow);
			statusDiv.appendChild(card);
		};

		const renderCandidatesList = (items: Zotero.Item[], headingText: string, l10nId = 'zotero-preview-lookup-candidates-heading') => {
			statusDiv.removeAttribute('data-l10n-id');
			statusDiv.removeAttribute('data-l10n-args');
			statusDiv.innerHTML = '';
			const msg = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			setL10n(msg, l10nId, headingText, { count: items.length });
			statusDiv.appendChild(msg);

			const list = doc.createElementNS('http://www.w3.org/1999/xhtml', 'ul') as HTMLElement;

			for (const m of items) {
				const li = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button') as HTMLElement;
				const j = m.getField('journalAbbreviation') || m.getField('publicationTitle') || '';
				const y = m.getField('year') || m.getField('date') || '';
				const suffix = j || y ? ` (${[j, y].filter(Boolean).join(', ')})` : '';
				renderLookupTitle(li, String(m.getField('title')));
				li.appendChild(doc.createTextNode(suffix));

				li.onclick = () => {
					renderItemResult(m, '候选文献，请核对后定位：', 'zotero-preview-lookup-state-candidate');
				};
				const row = doc.createElementNS('http://www.w3.org/1999/xhtml', 'li');
				row.appendChild(li);
				list.appendChild(row);
			}
			statusDiv.appendChild(list);
		};

		// 1. Try local copy history first (O(1) exact provenance)
		if (context.pref('lookupHistoryEnabled') !== false) {
			const histRecords = context.cacheManager.lookupAll
				? context.cacheManager.lookupAll(textToSearch)
				: (context.cacheManager.lookup(textToSearch) ? [context.cacheManager.lookup(textToSearch)!] : []);
			if (histRecords.length > 0) {
				const liveItems: Zotero.Item[] = [];
				const seenIDs = new Set<number>();
				for (const histRecord of histRecords) {
					const item = Zotero.Items.getByLibraryAndKeyAsync
						? await Zotero.Items.getByLibraryAndKeyAsync(histRecord.libraryID, histRecord.itemKey)
						: await Zotero.Items.getAsync(histRecord.itemID);
					if (!active()) return;
					if (item && !item.deleted && item.isRegularItem() && !seenIDs.has(item.id)) {
						seenIDs.add(item.id);
						liveItems.push(item);
					}
				}
				if (liveItems.length === 1) {
					renderItemResult(liveItems[0], '复制历史匹配，请核对后定位：', 'zotero-preview-lookup-state-history');
					return;
				} else if (liveItems.length > 1) {
					renderCandidatesList(liveItems, `复制历史关联到 ${liveItems.length} 篇文献，请点击选择：`, 'zotero-preview-lookup-history-candidates');
					return;
				}
			}
		}

		// 2. Fallback to physical coordinate pruning & fuzzy verification
		const parsed = parseCompactCitation(textToSearch);
		if (!parsed) {
			setL10n(statusDiv, 'zotero-preview-lookup-status-unrecognized', '无法识别引文结构，请提供包含期刊、年份、卷号与页码（或 DOI/arXiv）的引文。');
			return;
		}

		const pane = (doc.defaultView as unknown as {
			ZoteroPane?: { getSelectedLibraryID?: () => number; getSelectedLibraryIDs?: () => number[] };
		})?.ZoteroPane;
		let libraryID: number | undefined;
		for (const getLib of [
			() => pane?.getSelectedLibraryID?.(),
			() => pane?.getSelectedLibraryIDs?.()?.[0],
			() => (typeof Zotero !== 'undefined' ? Zotero.Libraries?.userLibraryID : undefined)
		]) {
			try {
				const val = getLib();
				if (typeof val === 'number' && Number.isFinite(val)) {
					libraryID = val;
					break;
				}
			} catch (_) {}
		}
		const candidates = await queryPhysicalCandidates(parsed, libraryID);
		if (!active()) return;
		const matches = verifyAndFilterCandidates(candidates, parsed);

		if (matches.length === 1) {
			const target = matches[0];
			if (!await locateItemInZotero(target)) throw new Error('Item selection failed');
			if (!active()) return;
			renderItemResult(target, '🎯 已定位文献：', 'zotero-preview-lookup-state-located');
		} else if (matches.length > 1) {
			renderCandidatesList(matches, `找到 ${matches.length} 篇可能匹配的文献，请点击选择：`, 'zotero-preview-lookup-candidates-heading');
		} else {
			const targetLabel = parsed.journalText || parsed.doi || parsed.arxiv || '-';
			const yearLabel = String(parsed.year || '-');
			setL10n(
				statusDiv,
				'zotero-preview-lookup-status-not-found',
				`未在当前文库中找到匹配项 (解析: ${targetLabel}, ${yearLabel})`,
				{ journal: targetLabel, year: yearLabel }
			);
		}
		} catch (error) {
			if (active()) setL10n(statusDiv, 'zotero-preview-lookup-status-error', '查询失败，请重试或重新粘贴引文。');
			context.log(String(error));
		}
	};

	searchBtn.onclick = () => executeLookup(input.value);
	input.onpaste = () => {
		setTimeout(() => {
			if (input.value.trim()) executeLookup(input.value);
		}, 0);
	};
	input.onkeydown = (e: Event) => {
		const key = (e as KeyboardEvent).key;
		if (key === 'Enter') {
			executeLookup(input.value);
		} else if (key === 'Escape') {
			request++;
			input.value = '';
			statusDiv.removeAttribute('data-l10n-id');
			statusDiv.removeAttribute('data-l10n-args');
			statusDiv.textContent = '';
		}
	};

	clipBtn.onclick = () => {
		try {
			const clip = Services.clipboard;
			const trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable) as nsITransferable;
			trans.init(null as unknown as nsILoadContext);
			trans.addDataFlavor('text/plain');
			clip.getData(trans, Ci.nsIClipboard.kGlobalClipboard);
			const str: { value?: nsISupports } = {};
			(trans.getTransferData as (flavor: string, data: object) => void)('text/plain', str);
			const text = (str.value as unknown as { data: string })?.data;
			if (text) {
				input.value = text;
				executeLookup(text);
				return;
			}
		} catch (_) {}
		setL10n(statusDiv, 'zotero-preview-lookup-status-clipboard-fallback', '无法直接读取剪贴板，请手动在输入框中粘贴 (Ctrl+V)。');
		input.focus();
	};
}

export function registerLookupSection(facade: PreviewFacade): string | false {
	if (typeof Zotero === 'undefined' || !Zotero.ItemPaneManager?.registerSection) return false;
	const title = { l10nID: 'zotero-preview-lookup-pane-title', icon: facade.rootURI + 'lookup.svg' };
	return (Zotero.ItemPaneManager.registerSection as unknown as (options: object) => string | false)({
		paneID: 'zotero-preview-lookup',
		pluginID: facade.id,
		header: title,
		sidenav: { ...title, orderable: true },
		onRender: ({ body, setEnabled }: { body: HTMLElement; setEnabled: (enabled: boolean) => void }) => {
			setEnabled(true); facade._queuePosition(body.closest('item-details') as Parameters<PreviewFacade['_queuePosition']>[0]);
		},
		onInit: ({ body }: { body: HTMLElement }) => {
			buildLookupSectionDOM(body.ownerDocument!, {
				stylesheetURI: facade.rootURI + 'style.css',
				cacheManager: facade._citationCache,
				log: msg => facade.log(msg),
				pref: n => facade.pref(n)
			}, body);
		},
		onDestroy: ({ body }: { body: HTMLElement }) => { cleanups.get(body)?.(); cleanups.delete(body); }
	});
}

export function unregisterLookupSection(sectionID: string | false | null | undefined): void {
	if (typeof Zotero === 'undefined' || !sectionID || !Zotero.ItemPaneManager?.unregisterSection) return;
	try {
		Zotero.ItemPaneManager.unregisterSection(sectionID as string);
	} catch (_) {}
}
