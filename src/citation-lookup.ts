/**
 * Zotero ViewFlow - Compact Citation Parser & Reverse Resolver
 *
 * Deconstructs compact citations (e.g. "Curr. Appl Phys., 2027, 94, 40-47")
 * and resolves original Zotero items via physical coordinate pruning and verification.
 */

export interface ParsedCitation {
	raw: string;
	journalText: string;
	year: number;
	volume?: string;
	issue?: string;
	firstPage?: string;
	lastPage?: string;
	pages?: string;
	doi?: string;
	arxiv?: string;
	authorPrefix?: string;
}

export interface LookupResult {
	item: Zotero.Item | null;
	candidates: Zotero.Item[];
	parsed: ParsedCitation | null;
	matchedByHistory: boolean;
	errorReason?: string;
}

/**
 * Extracts DOI or arXiv identifiers from a citation string.
 */
export function extractIdentifier(input: string): { doi?: string; arxiv?: string } {
	const doiMatch = input.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
	const arxivMatch =
		input.match(/\b(?:arXiv:\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?)\b/i) ||
		input.trim().match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
	return {
		doi: doiMatch ? doiMatch[1].replace(/[.,;)]+$/, '') : undefined,
		arxiv: arxivMatch ? arxivMatch[1] : undefined
	};
}

/**
 * Strips author prefix from compact citation if present.
 * e.g., "Zhang et al., Nature, 2024..." -> { authors: "Zhang et al.", rest: "Nature, 2024..." }
 */
export function stripAuthorPrefix(text: string): { authors?: string; rest: string } {
	const quoteMatch = text.match(/^(.+?)[,.\s]+["\u201c].+?["\u201d][,.\s]+(.+)$/);
	if (quoteMatch) {
		return { authors: quoteMatch[1].trim(), rest: quoteMatch[2].replace(/^in\s+/i, '').trim() };
	}
	const gbtMatch = text.match(/^([^.]+?)\.\s*.+?\[J\][.,\s]+(.+)$/i);
	if (gbtMatch) {
		return { authors: gbtMatch[1].trim(), rest: gbtMatch[2].trim() };
	}
	const etAlMatch = text.match(/^(.+?\bet\s+al\.?),?\s+(.+)$/i);
	if (etAlMatch) {
		return { authors: etAlMatch[1].trim(), rest: etAlMatch[2].trim() };
	}
	const semiMatch = text.match(/^([^;]+(?:;\s*[^;]+)+)[,;]\s+([A-Z].+)$/);
	if (semiMatch) {
		return { authors: semiMatch[1].trim(), rest: semiMatch[2].trim() };
	}
	return { rest: text };
}

/**
 * Normalizes journal text: removes periods, handles '&' as 'and', normalizes whitespace.
 */
export function normalizeJournal(name: string): string {
	return name
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[.,]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Parses a compact citation string into structured slots.
 */
export function parseCompactCitation(input: string): ParsedCitation | null {
	if (!input || typeof input !== 'string') return null;
	const clean = input
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(?:\[\d+\]\s*|\(\d+\)\s*|\d{1,3}[.)]\s+|•\s*)/, '')
		.replace(/\.+$/, '')
		.replace(/[\u2010-\u2015\u2212]/g, '-');
	const ids = extractIdentifier(clean);

	let stripped = clean;
	if (ids.doi) {
		stripped = stripped.replace(/(?:doi:?\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i, '').trim().replace(/[.,;:]+$/, '');
	}
	if (ids.arxiv) {
		stripped = stripped.replace(/(?:https?:\/\/)?(?:arXiv:\s*|arxiv\.org\/(?:abs|pdf)\/)?\b\d{4}\.\d{4,5}(?:v\d+)?\b/i, '').trim().replace(/[.,;:]+$/, '');
	}
	const { authors, rest: target } = stripAuthorPrefix(stripped);

	// Pattern 1: [Journal], [Year], [Volume]([Issue]), [Pages]
	// Supports ",", ";", ":", and optional "Vol." / "pp." prefixes
	const m1 = target.match(/^(.+?)[,\s;:]+(\d{4})[,\s;:]+(?:vol\.?\s*)?(\d+)(?:\s*\(([\w-]+)\))?[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?$/i);
	if (m1) {
		return {
			raw: input,
			journalText: m1[1].trim(),
			year: parseInt(m1[2], 10),
			volume: m1[3].trim(),
			issue: m1[4] || undefined,
			firstPage: m1[5].trim(),
			lastPage: m1[6] ? m1[6].trim() : undefined,
			pages: m1[6] ? `${m1[5].trim()}-${m1[6].trim()}` : m1[5].trim(),
			authorPrefix: authors,
			...ids
		};
	}

	// Pattern 2: [Journal] [Volume] ([Year]) [Pages]
	// Example: "Phys. Rev. B 105 (2022) 125101"
	const m2 = target.match(/^(.+?)[,\s]+(?:vol\.?\s*)?(\d+)(?:\s*\(([\w-]+)\))?\s*\((\d{4})\)[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?$/i);
	if (m2) {
		return {
			raw: input,
			journalText: m2[1].trim(),
			volume: m2[2].trim(),
			issue: m2[3] || undefined,
			year: parseInt(m2[4], 10),
			firstPage: m2[5].trim(),
			lastPage: m2[6] ? m2[6].trim() : undefined,
			pages: m2[6] ? `${m2[5].trim()}-${m2[6].trim()}` : m2[5].trim(),
			authorPrefix: authors,
			...ids
		};
	}

	// Pattern 3: [Journal] [Volume], [Pages] ([Year]) or IEEE vol. V, no. I, pp. P, YYYY
	// Example: "Appl. Phys. Lett. 120, 051102 (2022)" or "Appl. Phys. Lett., vol. 120, no. 5, pp. 051102, 2022"
	const m3 = target.match(/^(.+?)[,\s]+(?:vol\.?\s*)?(\d+)(?:(?:\s*\(([\w-]+)\))|[,\s]+(?:no\.?|issue)\s*([\w-]+))?[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?(?:\s*\((\d{4})\)|[,\s]+(?:[A-Za-z]+\.?\s+)?(\d{4}))$/i);
	if (m3) {
		return {
			raw: input,
			journalText: m3[1].trim(),
			volume: m3[2].trim(),
			issue: m3[3] || m3[4] || undefined,
			year: parseInt(m3[7] || m3[8], 10),
			firstPage: m3[5].trim(),
			lastPage: m3[6] ? m3[6].trim() : undefined,
			pages: m3[6] ? `${m3[5].trim()}-${m3[6].trim()}` : m3[5].trim(),
			authorPrefix: authors,
			...ids
		};
	}

	// Pattern 4: Pure DOI / arXiv or fallback with identifier present
	if (ids.doi || ids.arxiv) {
		return {
			raw: input,
			journalText: '',
			year: 0,
			authorPrefix: authors,
			...ids
		};
	}

	return null;
}

/**
 * Checks if candidate journal matches parsed query journal stem.
 * Preserves sub-journal letters (e.g. Physical Review B vs Physical Review).
 */
export function isJournalMatch(queryJournal: string, pubTitle: string, abbr: string): boolean {
	const qNorm = normalizeJournal(queryJournal);
	const pubNorm = normalizeJournal(pubTitle);
	const abbrNorm = normalizeJournal(abbr);

	if (pubNorm === qNorm || abbrNorm === qNorm) return true;
	if (!qNorm) return false;

	// Acronym check (e.g. JACS for Journal of the American Chemical Society, PNAS, PRL)
	const stopwords = new Set(['of', 'the', 'and', 'for', 'in', 'on', 'a', 'an']);
	const pubAcronym = pubNorm.split(' ').filter(w => !stopwords.has(w)).map(w => w[0]).join('');
	if (pubAcronym && pubAcronym === qNorm) return true;
	const abbrAcronym = abbrNorm.split(' ').filter(w => !stopwords.has(w)).map(w => w[0]).join('');
	if (abbrAcronym && abbrAcronym === qNorm) return true;

	// Check token containment while respecting trailing section letters (e.g., 'b', 'c')
	const qTokens = qNorm.split(' ').filter(t => t.length > 0 && !stopwords.has(t));
	if (!qTokens.length) return false;
	const lastToken = qTokens[qTokens.length - 1];
	if (lastToken && lastToken.length === 1 && /[a-z]/i.test(lastToken)) {
		// Sub-journal letter must explicitly match
		const pubLast = pubNorm.split(' ').pop();
		const abbrLast = abbrNorm.split(' ').pop();
		if (pubLast !== lastToken && abbrLast !== lastToken) return false;
	}

	const matchTokens = (targetNorm: string) => {
		if (!targetNorm) return false;
		const tokens = targetNorm.split(' ').filter(token => token.length > 0 && !stopwords.has(token));
		return tokens.length === qTokens.length && qTokens.every((token, index) => tokens[index].startsWith(token));
	};
	return matchTokens(pubNorm) || matchTokens(abbrNorm);
}

/**
 * Queries Zotero local database for candidates matching physical coordinates.
 */
export async function queryPhysicalCandidates(parsed: ParsedCitation, libraryID?: number): Promise<Zotero.Item[]> {
	if (typeof Zotero === 'undefined') return [];
	const runSearch = async (libID?: number): Promise<number[]> => {
		const s = new Zotero.Search(libID !== undefined ? { libraryID: libID } : undefined);
		if (parsed.doi) {
			s.addCondition('DOI', 'is', parsed.doi);
		} else if (parsed.arxiv && !parsed.journalText) {
			s.addCondition('quicksearch-everything', 'contains', parsed.arxiv.replace(/v\d+$/, ''));
		} else {
			s.addCondition('itemType', 'is', 'journalArticle');
			if (parsed.year) s.addCondition('date', 'contains', String(parsed.year));
			if (parsed.volume) s.addCondition('volume', 'is', parsed.volume);
		}
		return (await s.search()) || [];
	};
	let ids = await runSearch(libraryID);
	if (!ids.length && libraryID !== undefined) ids = await runSearch(undefined);
	return ids.length ? Zotero.Items.getAsync(ids) : [];
}

function expandEndPage(first?: string, last?: string): string | undefined {
	if (!first || !last) return last;
	if (/^\d+$/.test(first) && /^\d+$/.test(last) && first.length > last.length) {
		const expanded = first.slice(0, first.length - last.length) + last;
		if (parseInt(expanded, 10) > parseInt(first, 10)) return expanded;
	}
	return last;
}

/**
 * Verifies and filters candidates against pages, article numbers, and journal stem.
 */
export function verifyAndFilterCandidates(candidates: Zotero.Item[], parsed: ParsedCitation): Zotero.Item[] {
	const matched = candidates.filter(item => {
		if (item.deleted || !item.isRegularItem()) return false;
		if (parsed.doi) {
			const itemDoi = (item.getField('DOI') as string || '').trim().toLowerCase();
			return itemDoi === parsed.doi.toLowerCase();
		}
		if (parsed.arxiv && !parsed.journalText) {
			const [, qBase = '', qVer] = parsed.arxiv.toLowerCase().match(/^(\d{4}\.\d{4,5})(?:v(\d+))?$/) || [
				'',
				parsed.arxiv.toLowerCase().replace(/v\d+$/, ''),
				undefined
			];
			const fields = ['archiveID', 'extra', 'DOI', 'url', 'callNumber'].map(f => String(item.getField(f) || '').toLowerCase());
			return fields.some(val => {
				for (const m of val.matchAll(/(?:^|[^0-9])(\d{4}\.\d{4,5})(?:v(\d+))?(?=$|[^0-9])/g)) {
					if (m[1] === qBase && (!qVer || !m[2] || m[2] === qVer)) return true;
				}
				return false;
			});
		}

		const rawPages = (item.getField('pages') as string || '').replace(/[\u2010-\u2015\u2212]/g, '-').trim();
		const [first, last] = rawPages.split('-');
		const normItemLast = expandEndPage(first, last);
		const normParsedLast = expandEndPage(parsed.firstPage, parsed.lastPage);

		if (parsed.firstPage && first !== parsed.firstPage) return false;
		if (normParsedLast && normItemLast !== normParsedLast) return false;

		if (parsed.issue) {
			const itemIssue = item.getField('issue') as string || '';
			if (itemIssue !== parsed.issue) return false;
		}

		const pubTitle = item.getField('publicationTitle') as string || '';
		const abbr = item.getField('journalAbbreviation') as string || '';
		return isJournalMatch(parsed.journalText, pubTitle, abbr);
	});

	if (matched.length > 1 && parsed.authorPrefix) {
		const surname = parsed.authorPrefix.replace(/\bet\s+al\.?/i, '').trim().split(/[,;\s]+/)[0]?.toLowerCase();
		if (surname && surname.length >= 2) {
			const byAuthor = matched.filter(it => {
				const creators = (it as unknown as { getCreators?: () => Array<{ lastName?: string; name?: string }> }).getCreators?.() || [];
				const firstCreator = String(it.getField('firstCreator') || '').toLowerCase();
				return firstCreator.includes(surname) || creators.some(c => (c.lastName || c.name || '').toLowerCase().includes(surname));
			});
			if (byAuthor.length > 0) return byAuthor;
		}
	}
	return matched;
}

/**
 * Navigates Zotero view to select and highlight the target item.
 */
export async function locateItemInZotero(item: Zotero.Item): Promise<boolean> {
	if (typeof Zotero === 'undefined') return false;
	const win = Zotero.getMainWindow();
	if (!win || !win.ZoteroPane) return false;

	try {
		if (item.deleted) return false;
		(win as unknown as { Zotero_Tabs?: { select?: (id: string) => void } }).Zotero_Tabs?.select?.('zotero-pane');
		const selected = await win.ZoteroPane.selectItem(item.id);
		if (selected === false) return false;
		const itemsView = win.document.getElementById('zotero-items-tree') as unknown as {
			ensureRowIsVisible?: (index: number) => void;
			selection?: { currentIndex: number };
		};
		if (itemsView && itemsView.ensureRowIsVisible && itemsView.selection) {
			itemsView.ensureRowIsVisible(itemsView.selection.currentIndex);
		}
		return true;
	} catch (e) {
		Zotero.debug(`[ViewFlow] Locate item failed: ${e}`);
		return false;
	}
}

/**
 * Opens the main attachment (e.g. PDF) of an item in Zotero Reader.
 */
export async function openItemAttachment(item: Zotero.Item): Promise<boolean> {
	if (typeof Zotero === 'undefined') return false;
	try {
		const attachmentIDs = item.getAttachments();
		for (const id of attachmentIDs) {
			const att = await Zotero.Items.getAsync(id);
			if (att && att.isPDFAttachment && att.isPDFAttachment()) {
				const reader = (Zotero as unknown as { Reader?: { open: (itemID: number) => Promise<void> } }).Reader;
				if (reader?.open) {
					await reader.open(att.id);
					return true;
				}
			}
		}
	} catch (e) {
		Zotero.debug(`[ViewFlow] Open attachment failed: ${e}`);
	}
	return false;
}
