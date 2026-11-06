export const PREF_PREFIX = 'extensions.zoteropreview.';
export const CACHE_LIMIT = 64;
export const CACHE_BYTE_LIMIT = 2 * 1024 * 1024;
export const CACHE_TTL = 60000;
export const STYLE_INIT_TIMEOUT = 10000;

export const CLIPBOARD_ICON_SVG =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V0H1V13H4V16H15V3H12ZM2 1H11V12H2V1ZM14 15H5V13H12V4H14V15Z" fill="#cc9200"/></svg>';

export const SUCCESS_ICON_SVG =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1L5.5 9.5L2 6" stroke="#009900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const ERROR_MESSAGES = {
	'no-style': ['zotero-preview-no-style', 'Choose a bibliography style in ViewFlow or Zotero Quick Copy settings.'],
	'style-missing': ['zotero-preview-style-missing', 'This citation style is not installed. Install it or choose another style in ViewFlow settings.'],
	'quickcopy-unavailable': ['zotero-preview-quickcopy-unavailable', 'Quick Copy could not format these items. Check the style and try again.']
};

export const DEFAULT_ERROR_MESSAGE = [
	'zotero-preview-unavailable',
	'Preview unavailable. Check the selected citation style and retry.'
];

export function parseNumber(value: string | number | boolean | undefined, fallback: number, min: number, max: number) {
	const parsed = Number.parseFloat(value as string);
	return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function createPreviewError(code: string, message: string) {
	return Object.assign(new Error(message), { previewCode: code });
}
