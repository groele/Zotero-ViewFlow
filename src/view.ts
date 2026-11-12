import { CLIPBOARD_ICON_SVG } from './constants.ts';

import type {State, Plugin, Payload} from './section.ts';
type ViewState = State;
type PreviewContent = { html: string; text: string };
type ViewPlugin = Pick<Plugin, '_fitWidth'> & { _block(kind:string, content:PreviewContent): string; _setHTML(state:State, html:string):void };

/**
 * Ensures the native collapsible section has a non-empty header label.
 */
export function ensureSectionHeader(body: Element) {
	const section = body.closest('collapsible-section');
	if (section?.getAttribute && !section.getAttribute('label')?.trim()) {
		section.setAttribute('label', 'Zotero ViewFlow');
	}
}

/**
 * Generates HTML string for a citation or bibliography preview block.
 */
export function buildBlock(kind: string, content: PreviewContent, clipboardSvg = CLIPBOARD_ICON_SVG) {
	const label = kind === 'citation' ? 'Copy in-text citation' : 'Copy bibliography';
	return (
		`<section class="zotero-preview-block"><div class="zotero-preview-block-row">` +
		`<div class="zotero-preview-block-body">${content.html}</div>` +
		`<div class="zotero-preview-block-toolbar">` +
		`<span class="zotero-preview-copy" role="button" tabindex="0" title="${label}" aria-label="${label}" data-l10n-id="zotero-preview-copy-${kind}" data-copy-citation="${kind === 'citation'}">${clipboardSvg}</span>` +
		`</div></div></section>`
	);
}

/**
 * Parses and safely sets HTML into the section body using DOMParser and importNode.
 */
export function setHTML(state: ViewState, html: string) {
	if (state.destroyed || state.body?.isConnected === false) return;
	for (const timer of state.feedbackTimers) clearTimeout(timer);
	state.feedbackTimers.clear();
	state.copyFeedback.clear();
	const win = state.doc?.defaultView || globalThis;
	const Parser = win?.DOMParser || globalThis.DOMParser;
	if (!Parser) return;
	const parsed = new Parser().parseFromString(html, 'text/html');
	if (!parsed?.body) return;
	state.body.replaceChildren(
		...Array.from(parsed.body.childNodes as NodeListOf<ChildNode>, node => state.doc.importNode(node as Node, true))
	);
}

/**
 * Formats full preview payload into HTML and applies CSS custom properties.
 */
export function renderPayload(plugin: ViewPlugin, state: ViewState, payload: Record<string, PreviewContent>, omitted: number) {
	let html = Object.entries(payload)
		.map(([kind, content]) => plugin._block(kind, content))
		.join('<hr class="zotero-preview-separator"/>');
	if (omitted) {
		html += `<div class="zotero-preview-message" data-l10n-id="zotero-preview-truncated" data-l10n-args='${JSON.stringify({ count: omitted })}'>${omitted} additional items omitted.</div>`;
	}
	const { body } = state;
	const config = state.config!;
	body.style.setProperty('--zotero-preview-font-size', config.font + 'em');
	body.style.setProperty('--zotero-preview-line-height', String(config.spacing));
	const wrapped = `<div class="zotero-preview-content">${html}</div>`;
	if (state.lastHTML !== wrapped) {
		plugin._setHTML(state, wrapped);
		state.lastHTML = wrapped;
	}
	plugin._fitWidth(state);
}

function escapeHTML(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Displays a status or error message inside the section body.
 */
export function renderMessage(plugin: ViewPlugin, state: ViewState, id: string, fallback: string, error = false, detail = '') {
	const cleanDetail = error ? detail.trim().slice(0, 240) : '';
	const detailHtml = cleanDetail
		? `<div class="zotero-preview-message-detail">${escapeHTML(cleanDetail)}</div>`
		: '';
	const html =
		`<div class="zotero-preview-message${error ? ' zotero-preview-message-error' : ''}" role="status" data-l10n-id="${id}">${fallback}</div>` +
		detailHtml +
		(error
			? '<button type="button" class="zotero-preview-retry" data-preview-retry="" data-l10n-id="zotero-preview-retry">Retry preview</button>'
			: '');
	if (state.lastHTML === html) return;
	plugin._setHTML(state, html);
	state.lastHTML = html;
}
