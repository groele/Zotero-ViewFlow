import { CLIPBOARD_ICON_SVG, SUCCESS_ICON_SVG } from './constants.ts';

type FeedbackState = {
 destroyed: boolean;
 copyFeedback: Map<HTMLElement, ReturnType<typeof setTimeout>[]>;
 feedbackTimers: Set<ReturnType<typeof setTimeout>>;
};
type CopyErrorState = { doc: Document };
type ClipboardContent = { html: string; text: string };
type TransferableWithLength = nsITransferable & {
	setTransferData(aFlavor: string, aData: nsISupports, aDataLen?: number): void;
};

/**
 * Triggers copy success feedback animation and icon restoration.
 */
export function showCopyFeedback(
	state: FeedbackState,
	button: HTMLElement,
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
 * Writes HTML and plain-text content to the system clipboard using XPCOM nsITransferable.
 */
export function writeToXPCOMClipboard(content: ClipboardContent, _asHTML = false) {
	const transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable) as TransferableWithLength;
	transferable.init(null as unknown as nsILoadContext);
	for (const [flavor, value] of [
		['text/html', content.html],
		['text/plain', content.text]
	]) {
		const str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString) as nsISupportsString;
		str.data = value;
		transferable.addDataFlavor(flavor);
		// Pass UTF-16 byte length for 3-arg nsITransferable hosts; extra arg is ignored on 2-arg Gecko 140+.
		transferable.setTransferData(flavor, str, value.length * 2);
	}
	// Gecko permits a null owner, although the bundled host typings do not.
	Services.clipboard.setData(transferable, null as unknown as nsIClipboardOwner, Ci.nsIClipboard.kGlobalClipboard);
}

/**
 * Appends or updates a copy failure notice element in the section body.
 */
export function renderCopyError(state: CopyErrorState, body: HTMLElement, _log: (error: unknown) => void) {
	let status = body.querySelector<HTMLElement>('.zotero-preview-copy-status');
	if (!status) {
		status = state.doc.createElementNS('http://www.w3.org/1999/xhtml', 'div') as HTMLDivElement;
		status.className = 'zotero-preview-copy-status';
		status.setAttribute('role', 'status');
		body.appendChild(status);
	}
	status.setAttribute('data-l10n-id', 'zotero-preview-copy-unavailable');
	status.textContent = 'Copy unavailable. Please try again.';
}
