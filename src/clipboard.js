import { CLIPBOARD_ICON_SVG, SUCCESS_ICON_SVG } from './constants.js';

/**
 * Triggers copy success feedback animation and icon restoration.
 */
export function showCopyFeedback(
	state,
	button,
	successSvg = SUCCESS_ICON_SVG,
	clipboardSvg = CLIPBOARD_ICON_SVG
) {
	if (state.destroyed) return;
	for (const timer of state.copyFeedback.get(button) || []) {
		clearTimeout(timer);
		state.feedbackTimers.delete(timer);
	}
	button.classList.add('zotero-preview-copy-success');
	button.innerHTML = successSvg;
	const scaleTimer = setTimeout(() => {
		state.feedbackTimers.delete(scaleTimer);
		button.classList.remove('zotero-preview-copy-success');
	}, 300);
	const iconTimer = setTimeout(() => {
		state.feedbackTimers.delete(iconTimer);
		state.copyFeedback.delete(button);
		button.innerHTML = clipboardSvg;
	}, 1000);
	state.feedbackTimers.add(scaleTimer);
	state.feedbackTimers.add(iconTimer);
	state.copyFeedback.set(button, [scaleTimer, iconTimer]);
}

/**
 * Writes HTML and text content to the system clipboard using XPCOM nsITransferable.
 */
export function writeToXPCOMClipboard(content, asHTML) {
	const { classes: Cc, interfaces: Ci } = Components;
	const transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
	transferable.init(null);
	for (const [flavor, value] of [
		['text/html', content.html],
		['text/plain', asHTML ? content.html : content.text]
	]) {
		const str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
		str.data = value;
		transferable.addDataFlavor(flavor);
		transferable.setTransferData(flavor, str);
	}
	Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
}

/**
 * Appends or updates a copy failure notice element in the section body.
 */
export function renderCopyError(state, body, log) {
	let status = body.querySelector('.zotero-preview-copy-status');
	if (!status) {
		status = state.doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		status.className = 'zotero-preview-copy-status';
		status.setAttribute('role', 'status');
		body.appendChild(status);
	}
	status.setAttribute('data-l10n-id', 'zotero-preview-copy-unavailable');
	status.textContent = 'Copy unavailable. Please try again.';
}
