import { parseNumber, createPreviewError, STYLE_INIT_TIMEOUT } from './constants.ts';

export type Item = { id: number; deleted?: boolean; parentID?: number; isRegularItem(): boolean; isField?(field: string): boolean; getField(field: string, ...options: boolean[]): string };
type Format = { id?: string; mode?: string; locale?: string; contentType?: string };
export type PreviewConfig = { format: Format; show: string };
type SelectionPane = { getSelectedItems?(): Item[] };
type PreviewState = { tabType: string | null; doc: Document; item: Item | null; cancelStyles?: (() => void) | null };
type ResolveOptions = { getPref(key: string): string; layoutConfig(): {font:number;spacing:number}; parseNum?: typeof parseNumber; createError?: typeof createPreviewError };
type Host = {
 Items: { get(id: number): Item | null };
 getActiveZoteroPane?(): SelectionPane | null;
 QuickCopy: { getFormatFromURL(url: string): string; unserializeSetting(raw: string): Format; getContentFromItems(items: Item[], format: Format, unused: null, citation: boolean): { html?: string; text?: string } | null };
 Prefs: { get(key: string): string };
 Styles?: { get?(id: string): { updated?: string } | undefined; init?(): Promise<unknown> };
};
const host = Zotero as unknown as Host;


/**
 * Traverses parent attachments until reaching the primary regular item.
 * Guarded against circular parent references and trashed items.
 */
export function normalizeItem(item: Item | null) {
	const seen = new Set<number>();
	while (item?.id && !seen.has(item.id)) {
		seen.add(item.id);
		if (item.deleted) return null;
		if (item.isRegularItem()) return item;
		if (!item.parentID) return null;
		item = host.Items.get(item.parentID);
	}
	return null;
}

/**
 * Resolves item list to preview based on tab type (library vs reader).
 */
export function resolveItems(state: PreviewState, normalize = normalizeItem) {
	if (state.tabType === 'library') {
		const pane = (state.doc.defaultView as (Window & { ZoteroPane?: SelectionPane }) | null)?.ZoteroPane || host.getActiveZoteroPane?.();
		const selection = pane?.getSelectedItems?.() || [];
		const items = [
			...new Map(
				selection
					.map(item => normalize(item))
					.filter((item): item is Item => item !== null)
					.map(item => [item.id, item])
			).values()
		];
		return items.some(item => item.id === state.item?.id) ? items : [];
	}
	const item = normalize(state.item);
	return item ? [item] : [];
}

/**
 * Resolves QuickCopy or user-override CSL configuration.
 */
export function resolveConfig(item: Item | null, { getPref, layoutConfig, parseNum = parseNumber, createError = createPreviewError }: ResolveOptions) {
	const qc = host.QuickCopy;
	const override = getPref('citationstyle');
	let format;
	try {
		let url = '';
		if (item?.isField?.('url')) {
			try { url = item.getField('url', true, true) || ''; } catch { url = ''; }
		}
		let rawSetting;
		try {
			rawSetting = qc.getFormatFromURL(url);
		} catch {
			rawSetting = host.Prefs.get('export.quickCopy.setting') || '';
		}
		format = { ...qc.unserializeSetting(rawSetting) };
	} catch (error) {
		if (!override) throw createError('no-style', error instanceof Error ? error.message : String(error));
		format = {};
	}
	if (override) Object.assign(format, { id: override, mode: 'bibliography' });
	if (format.mode !== 'bibliography' || !format.id) {
		throw createError('no-style', 'No bibliography style configured');
	}
	if (host.Styles?.get && !host.Styles.get(format.id)) {
		throw createError('style-missing', 'Citation style is not installed');
	}
	format.locale = format.locale || host.Prefs.get('export.quickCopy.locale');
	const asHTML = format.contentType === 'html';
	format.contentType = 'text';
	const show = getPref('whatToShow');
	return {
		format,
		asHTML,
		show: ['zpboth', 'zpbib', 'zpintext'].includes(show) ? show : 'zpboth',
		...layoutConfig(),
		limit: Math.min(
			parseNum(getPref('maxPreviewItems'), 100, 1, 500),
			parseNum(host.Prefs.get('export.quickCopy.dragLimit'), 100, 1, 10000)
		)
	};
}

/**
 * Calculates a unique cache and validation key for given items and configuration.
 */
export function getPreviewKey(items: Item[], config: PreviewConfig) {
	return JSON.stringify([
		items.map(item => [item.id, item.getField('dateModified')]),
		config.format,
		config.show,
		(config.format.id ? host.Styles?.get?.(config.format.id) : undefined)?.updated || ''
	]);
}

/**
 * Generates HTML and plain text citations using host.QuickCopy.
 */
export function generateCSL(items: Item[], { format, show }: PreviewConfig, createError = createPreviewError) {
	const payload: Record<string, { html: string; text: string }> = {};
	for (const [kind, enabled, citation] of [
		['bibliography', show !== 'zpintext', false],
		['citation', show !== 'zpbib', true]
	] as const) {
		if (!enabled) continue;
		const result = host.QuickCopy.getContentFromItems(items, format, null, citation);
		if (!result?.html || typeof result.html !== 'string' || typeof result.text !== 'string') {
			throw createError('quickcopy-unavailable', `QuickCopy returned incomplete ${kind}`);
		}
		payload[kind] = { html: result.html, text: result.text };
	}
	return payload;
}

/**
 * Awaits style cache loading with cancellation and timeout guard.
 */
export function waitForStyles(state: PreviewState, timeout = STYLE_INIT_TIMEOUT) {
	return new Promise<boolean>((resolve, reject) => {
		let settled = false;
		const finish = (ready: boolean, error?: unknown) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (state.cancelStyles === cancel) state.cancelStyles = null;
			if (error) reject(error);
			else resolve(ready);
		};
		const cancel = () => finish(false);
		const timer = setTimeout(
			() => finish(false, new Error('Citation style initialization timed out')),
			timeout
		);
		state.cancelStyles = cancel;
		Promise.resolve()
			.then(() => {
				if (!settled) return host.Styles?.init?.();
			})
			.then(
				() => finish(true),
				error => finish(false, error)
			);
	});
}
