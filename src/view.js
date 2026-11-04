import { CLIPBOARD_ICON_SVG } from './constants.js';

/**
 * Ensures the native collapsible section has a non-empty header label.
 */
export function ensureSectionHeader(body) {
	const section = body.closest('collapsible-section');
	if (section?.getAttribute && !section.getAttribute('label')?.trim()) {
		section.setAttribute('label', 'Zotero ViewFlow');
	}
}

/**
 * Generates HTML string for a citation or bibliography preview block.
 */
export function buildBlock(kind, content, clipboardSvg = CLIPBOARD_ICON_SVG) {
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
export function setHTML(state, html) {
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
		...Array.from(parsed.body.childNodes, node => state.doc.importNode(node, true))
	);
}

/**
 * Formats full preview payload into HTML and applies CSS custom properties.
 */
export function renderPayload(plugin, state, payload, omitted) {
	let html = Object.entries(payload)
		.map(([kind, content]) => plugin._block(kind, content))
		.join('<hr class="zotero-preview-separator"/>');
	if (omitted) {
		html += `<div class="zotero-preview-message" data-l10n-id="zotero-preview-truncated" data-l10n-args='${JSON.stringify({ count: omitted })}'>${omitted} additional items omitted.</div>`;
	}
	const { body, config } = state;
	body.style.setProperty('--zotero-preview-font-size', config.font + 'em');
	body.style.setProperty('--zotero-preview-line-height', config.spacing);
	const wrapped = `<div class="zotero-preview-content">${html}</div>`;
	if (state.lastHTML !== wrapped) {
		plugin._setHTML(state, wrapped);
		state.lastHTML = wrapped;
	}
	plugin._fitWidth(state);
}

/**
 * Displays a status or error message inside the section body.
 */
export function renderMessage(plugin, state, id, fallback, error = false) {
	const html =
		`<div class="zotero-preview-message${error ? ' zotero-preview-message-error' : ''}" role="status" data-l10n-id="${id}">${fallback}</div>` +
		(error
			? '<button type="button" class="zotero-preview-retry" data-preview-retry="" data-l10n-id="zotero-preview-retry">Retry preview</button>'
			: '');
	if (state.lastHTML === html) return;
	plugin._setHTML(state, html);
	state.lastHTML = html;
}
