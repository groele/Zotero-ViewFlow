import { parseNumber, createPreviewError, STYLE_INIT_TIMEOUT } from './constants.js';

/**
 * Traverses parent attachments until reaching the primary regular item.
 * Guarded against circular parent references and trashed items.
 */
export function normalizeItem(item) {
	const seen = new Set();
	while (item?.id && !seen.has(item.id)) {
		seen.add(item.id);
		if (item.deleted) return null;
		if (item.isRegularItem()) return item;
		if (!item.parentID) return null;
		item = Zotero.Items.get(item.parentID);
	}
	return null;
}

/**
 * Resolves item list to preview based on tab type (library vs reader).
 */
export function resolveItems(state, normalize = normalizeItem) {
	if (state.tabType === 'library') {
		const selection = state.doc.defaultView?.ZoteroPane?.getSelectedItems() || [];
		const items = [
			...new Map(
				selection
					.map(item => normalize(item))
					.filter(Boolean)
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
export function resolveConfig(item, { getPref, layoutConfig, parseNum = parseNumber, createError = createPreviewError }) {
	const qc = Zotero.QuickCopy;
	const override = getPref('citationstyle');
	let format;
	try {
		format = { ...qc.unserializeSetting(qc.getFormatFromURL(item?.getField('url') || '')) };
	} catch (error) {
		if (!override) throw createError('no-style', error.message);
		format = {};
	}
	if (override) Object.assign(format, { id: override, mode: 'bibliography' });
	if (format.mode !== 'bibliography' || !format.id) {
		throw createError('no-style', 'No bibliography style configured');
	}
	if (Zotero.Styles?.get && !Zotero.Styles.get(format.id)) {
		throw createError('style-missing', 'Citation style is not installed');
	}
	format.locale = format.locale || Zotero.Prefs.get('export.quickCopy.locale');
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
			parseNum(Zotero.Prefs.get('export.quickCopy.dragLimit'), 100, 1, 10000)
		)
	};
}

/**
 * Calculates a unique cache and validation key for given items and configuration.
 */
export function getPreviewKey(items, config) {
	return JSON.stringify([
		items.map(item => [item.id, item.getField('dateModified')]),
		config.format,
		config.show,
		Zotero.Styles?.get(config.format.id)?.updated || ''
	]);
}

/**
 * Generates HTML and plain text citations using Zotero.QuickCopy.
 */
export function generateCSL(items, { format, show }, createError = createPreviewError) {
	const payload = {};
	for (const [kind, enabled, citation] of [
		['bibliography', show !== 'zpintext', false],
		['citation', show !== 'zpbib', true]
	]) {
		if (!enabled) continue;
		const result = Zotero.QuickCopy.getContentFromItems(items, format, null, citation);
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
export function waitForStyles(state, timeout = STYLE_INIT_TIMEOUT) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (ready, error) => {
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
				if (!settled) return Zotero.Styles?.init?.();
			})
			.then(
				() => finish(true),
				error => finish(false, error)
			);
	});
}
