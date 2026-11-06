import {getPreviewKey, generateCSL} from './csl.ts';
import {CLIPBOARD_ICON_SVG, SUCCESS_ICON_SVG} from './constants.ts';
import {showCopyFeedback, writeToXPCOMClipboard, renderCopyError} from './clipboard.ts';
import {buildBlock, setHTML, renderPayload, renderMessage} from './view.ts';
import type {Payload} from './section.ts';
import type {PreviewFacade} from './contracts.ts';

type PreviewActions = Pick<PreviewFacade, '_previewKey' | '_generate' | '_cacheGet' | '_cachePut' | '_cacheDelete' | '_cacheClear' | '_clipboardIconSVG' | '_successIconSVG' | '_showCopyFeedback' | '_block' | '_renderPayload' | '_setHTML' | '_message' | 'copyCitation'>;
export const previewActions: PreviewActions & ThisType<PreviewFacade> = {
	_previewKey(items, config) {
		return getPreviewKey(items, config);
	},

	_generate(items, config) {
		return generateCSL(items, config, (c, m) => this._previewError(c, m));
	},

	_cacheGet(key) {
		return this._cacheManager.get(key) as Payload | null;
	},

	_cachePut(key, payload, ids) {
		this._cacheManager.put(key, payload, ids);
	},

	_cacheDelete(key) {
		this._cacheManager.delete(key);
	},

	_cacheClear() {
		this._cacheManager.clear();
	},

	_clipboardIconSVG() {
		return CLIPBOARD_ICON_SVG;
	},

	_successIconSVG() {
		return SUCCESS_ICON_SVG;
	},

	_showCopyFeedback(state, button) {
		showCopyFeedback(state, button, this._successIconSVG(), this._clipboardIconSVG());
	},

	_block(kind, content) {
		return buildBlock(kind, content, this._clipboardIconSVG());
	},

	_renderPayload(state, payload, omitted) {
		renderPayload(this, state, payload, omitted);
	},

	_setHTML(state, html) {
		setHTML(state, html);
	},

	_message(state, id, fallback, error = false) {
		renderMessage(this, state, id, fallback, error);
	},

	copyCitation(asCitations, body, button) {
		const state = this._states.get(body);
		const content = state?.payload?.[asCitations ? 'citation' : 'bibliography'];
		if (!content) return false;
		const ids = this._items(state).map(item => item.id);
		if (
			state.destroyed ||
			!this.initialized ||
			!ids.length ||
			ids.length !== state.ids.length ||
			ids.some((id, index) => id !== state.ids[index])
		) {
			state.payload = null;
			this._cancelRender(state);
			this._scheduleRefresh(state);
			return false;
		}
		try {
			const config = this._config(state.item!);
			const items = this._items(state).slice(0, Math.floor(config.limit));
			if (
				this._previewKey(items, config) !== state.key ||
				config.asHTML !== state.config!.asHTML
			) {
				throw new Error('Preview inputs changed');
			}
		} catch (error) {
			state.payload = null;
			this._cancelRender(state);
			this._scheduleRefresh(state);
			return false;
		}
		try {
			writeToXPCOMClipboard(content, state.config!.asHTML);
			body.querySelector?.('.zotero-preview-copy-status')?.remove();
			if (button) this._showCopyFeedback(state, button);
			return true;
		} catch (error) {
			this.log(`Clipboard: ${error}`);
			renderCopyError(state, body, msg => this.log(msg));
			return false;
		}
	},

};
