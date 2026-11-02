import {
	PREF_PREFIX,
	CACHE_LIMIT,
	CACHE_BYTE_LIMIT,
	CACHE_TTL,
	STYLE_INIT_TIMEOUT,
	CLIPBOARD_ICON_SVG,
	SUCCESS_ICON_SVG,
	parseNumber,
	createPreviewError
} from './constants.js';
import { CacheManager } from './cache.js';
import {
	normalizeItem,
	resolveItems,
	resolveConfig,
	getPreviewKey,
	generateCSL,
	waitForStyles
} from './csl.js';
import {
	showCopyFeedback,
	writeToXPCOMClipboard,
	renderCopyError
} from './clipboard.js';
import {
	resolvePosition,
	observePosition,
	queuePosition,
	applyPosition,
	fitWidth
} from './position.js';
import {
	ensureSectionHeader,
	buildBlock,
	setHTML,
	renderPayload,
	renderMessage
} from './view.js';
import {
	initSection,
	changeItem,
	prepareRender,
	cancelRender,
	renderSection,
	runRender,
	scheduleRefresh,
	destroySection,
	queueAllPreviews,
	updateLayout
} from './section.js';

/**
 * Zotero ViewFlow - Core Preview Plugin Object.
 * Preserves native item-pane lifecycle, shared LRU cache, and XPCOM clipboard integrations.
 */
export const preview = {
	initialized: false,
	_prefPrefix: PREF_PREFIX,
	_cacheLimit: CACHE_LIMIT,
	_cacheByteLimit: CACHE_BYTE_LIMIT,
	_cacheTTL: CACHE_TTL,
	_styleInitTimeout: STYLE_INIT_TIMEOUT,

	init({ id, version, rootURI }) {
		if (this.initialized) return;
		Object.assign(this, { id, version, rootURI });
		this._states = new Map();
		this._cacheManager = new CacheManager({
			limit: this._cacheLimit,
			byteLimit: this._cacheByteLimit,
			ttl: this._cacheTTL
		});
		this._cache = this._cacheManager.map;
		this._prefObservers = [];
		this._prefPaneCleanups = new Set();
		this._stylesheets = new Map();
		this._positionTimers = new Map();
		this._positionObservers = new Map();
		this._positionRuns = new Map();
		this._lifecycle = Symbol('preview-lifecycle');
		this._stats = { generations: 0, cacheHits: 0 };
		this.initialized = true;
	},

	get _cacheBytes() {
		return this._cacheManager?.bytes || 0;
	},
	set _cacheBytes(val) {
		if (this._cacheManager) this._cacheManager.bytes = val;
	},

	log(message) {
		if (this.pref('debug')) Zotero.debug(`ZoteroPreview: ${message}`);
	},

	pref(name) {
		return Zotero.Prefs.get(this._prefPrefix + name, true);
	},

	start() {
		if (!Zotero.ItemPaneManager?.registerSection) {
			throw new Error('Native ItemPaneManager API required');
		}
		if (this.pref('positionPolicyVersion') !== 1) {
			this.setPref(this._prefPrefix + 'position', 'zotero-item-pane-header');
			this.setPref(this._prefPrefix + 'positionPolicyVersion', 1);
		}
		const title = { l10nID: 'zotero-preview-pane-title', icon: this.rootURI + 'view.svg' };
		this._sectionID = Zotero.ItemPaneManager.registerSection({
			paneID: 'zotero-preview',
			pluginID: this.id,
			header: title,
			sidenav: { ...title, orderable: true },
			onInit: props => this._initSection(props),
			onDestroy: ({ body }) => this._destroySection(body),
			onItemChange: props => this._changeItem(props),
			onRender: props => this._prepareRender(props),
			onAsyncRender: props => this._renderSection(props),
			onToggle: ({ body }) => {
				const state = this._states.get(body);
				if (state && !state.payload) this._scheduleRefresh(state);
			}
		});
		if (!this._sectionID) throw new Error('Could not register ZoteroPreview section');
		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'zoteropreview');
		this._prefObservers.push(
			Zotero.Prefs.registerObserver(
				this._prefPrefix + 'position',
				() => {
					for (const state of this._states.values()) {
						this._queuePosition(state.body.closest('item-details'));
					}
				},
				true
			)
		);
		for (const name of ['fontsize', 'spacing']) {
			this._prefObservers.push(
				Zotero.Prefs.registerObserver(
					this._prefPrefix + name,
					() => this._updateLayout(),
					true
				)
			);
		}
		for (const name of ['citationstyle', 'whatToShow', 'maxPreviewItems']) {
			this._prefObservers.push(
				Zotero.Prefs.registerObserver(
					this._prefPrefix + name,
					() => this._queueAllPreviews(),
					true
				)
			);
		}
		for (const name of [
			'export.quickCopy.setting',
			'export.quickCopy.locale',
			'export.quickCopy.dragLimit'
		]) {
			this._prefObservers.push(
				Zotero.Prefs.registerObserver(name, () => this._queueAllPreviews())
			);
		}
	},

	_initSection(props) {
		initSection(this, props);
	},

	getPosition() {
		return resolvePosition(this.pref('position'));
	},

	_observePosition(owner, state) {
		observePosition(this, owner, state);
	},

	_queuePosition(owner) {
		queuePosition(this, owner);
	},

	_applyPosition(owner) {
		return applyPosition(this, owner);
	},

	_fitWidth(state) {
		fitWidth(state);
	},

	_normalizeItem(item) {
		return normalizeItem(item);
	},

	_changeItem(props) {
		changeItem(this, props);
	},

	_items(state) {
		return resolveItems(state, item => this._normalizeItem(item));
	},

	_config(item) {
		return resolveConfig(item, {
			getPref: n => this.pref(n),
			layoutConfig: () => this._layoutConfig(),
			parseNum: (v, fb, min, max) => this._number(v, fb, min, max),
			createError: (c, m) => this._previewError(c, m)
		});
	},

	_previewError(code, message) {
		return createPreviewError(code, message);
	},

	_layoutConfig() {
		return {
			font: this._number(this.pref('fontsize'), 1, 0.2, 3),
			spacing: this._number(this.pref('spacing'), 1.5, 1, 3)
		};
	},

	_updateLayout() {
		updateLayout(this);
	},

	_number(value, fallback, min, max) {
		return parseNumber(value, fallback, min, max);
	},

	_ensureSectionHeader(body) {
		ensureSectionHeader(body);
	},

	_prepareRender(props) {
		prepareRender(this, props);
	},

	_cancelRender(state) {
		cancelRender(state);
	},

	_renderSection(props) {
		return renderSection(this, props);
	},

	_waitForStyles(state) {
		return waitForStyles(state, this._styleInitTimeout);
	},

	_runRender(state) {
		return runRender(this, state);
	},

	_previewKey(items, config) {
		return getPreviewKey(items, config);
	},

	_generate(items, config) {
		return generateCSL(items, config, (c, m) => this._previewError(c, m));
	},

	_cachePut(key, payload, ids) {
		this._cacheManager.put(key, payload, ids);
	},

	_cacheDelete(key) {
		this._cacheManager.delete(key);
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
			const config = this._config(state.item);
			const items = this._items(state).slice(0, Math.floor(config.limit));
			if (
				this._previewKey(items, config) !== state.key ||
				config.asHTML !== state.config.asHTML
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
			writeToXPCOMClipboard(content, state.config.asHTML);
			body.querySelector?.('.zotero-preview-copy-status')?.remove();
			if (button) this._showCopyFeedback(state, button);
			return true;
		} catch (error) {
			this.log(`Clipboard: ${error}`);
			renderCopyError(state, body, msg => this.log(msg));
			return false;
		}
	},

	notify(event, type, ids) {
		if (this.initialized && type === 'tab' && event === 'select') {
			for (const state of this._states.values()) {
				this._queuePosition(state.body.closest('item-details'));
				if (!state.payload) this._scheduleRefresh(state);
			}
			return;
		}
		if (
			!this.initialized ||
			type !== 'item' ||
			!['modify', 'delete', 'trash', 'refresh', 'add'].includes(event)
		) {
			return;
		}
		const changed =
			event === 'refresh' && !ids?.length ? null : new Set((ids || []).map(Number));
		if (changed && event === 'add') return;
		this._cacheManager.invalidate(changed);
		for (const state of this._states.values()) {
			if (!changed || state.ids.some(id => changed.has(id))) {
				state.payload = null;
				this._cancelRender(state);
				this._scheduleRefresh(state);
				if (!this._normalizeItem(state.item)) state.setEnabled?.(false);
			}
		}
	},

	_scheduleRefresh(state) {
		scheduleRefresh(this, state);
	},

	_queueAllPreviews() {
		queueAllPreviews(this);
	},

	setPref(pref, value) {
		const name = pref.replace(this._prefPrefix, '');
		const bounds = {
			fontsize: [1, 0.2, 3],
			spacing: [1.5, 1, 3],
			maxPreviewItems: [100, 1, 500]
		};
		if (bounds[name]) {
			value = this._number(value, ...bounds[name]);
			if (name === 'maxPreviewItems') value = Math.floor(value);
		}
		Zotero.Prefs.set(pref, value, true);
	},

	_destroySection(body) {
		destroySection(this, body);
	},

	_cleanup(action) {
		try {
			action();
		} catch (error) {
			Zotero.logError?.(error);
		}
	},

	shutdown() {
		if (!this.initialized) return;
		this.initialized = false;
		this._lifecycle = null;
		for (const timer of this._positionTimers.values()) clearTimeout(timer);
		this._positionTimers.clear();
		for (const { observer } of this._positionObservers.values()) {
			this._cleanup(() => observer.disconnect());
		}
		this._positionObservers.clear();
		this._positionRuns.clear();

		const cleanup = action => this._cleanup(action);
		for (const dispose of [...this._prefPaneCleanups]) cleanup(dispose);
		this._prefPaneCleanups.clear();
		if (this._notifierID != null) {
			cleanup(() => Zotero.Notifier.unregisterObserver(this._notifierID));
		}
		for (const observer of this._prefObservers) {
			cleanup(() => Zotero.Prefs.unregisterObserver(observer));
		}
		if (this._sectionID) {
			cleanup(() => Zotero.ItemPaneManager.unregisterSection(this._sectionID));
		}
		for (const body of [...this._states.keys()]) cleanup(() => this._destroySection(body));
		for (const { link } of this._stylesheets.values()) cleanup(() => link.remove());
		this._stylesheets.clear();
		this._cacheManager.clear();
		this._sectionID = null;
		this._notifierID = null;
		this._prefObservers = [];
	}
};

// Bind to global Zotero object
if (typeof Zotero !== 'undefined') {
	Zotero.zoteropreview = preview;
}
