import {
	PREF_PREFIX,
	CACHE_LIMIT,
	CACHE_BYTE_LIMIT,
	CACHE_TTL,
	STYLE_INIT_TIMEOUT,
	parseNumber,
	createPreviewError
} from './constants.ts';
import { CacheManager } from './cache.ts';
import {
	normalizeItem,
	resolveItems,
	resolveConfig,
	waitForStyles
} from './csl.ts';
import {
	resolvePosition,
	observePosition,
	queuePosition,
	applyPosition,
	fitWidth
} from './position.ts';
import {
	ensureSectionHeader,
} from './view.ts';
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
} from './section.ts';

import type {Props} from './section.ts';
import type {PositionOwner} from './position.ts';
import type {PreviewFacade} from './contracts.ts';
import {previewActions} from './preview-actions.ts';

/**
 * Zotero ViewFlow - Core Preview Plugin Object.
 * Preserves native item-pane lifecycle, shared LRU cache, and XPCOM clipboard integrations.
 */
const core: Omit<PreviewFacade, keyof typeof previewActions> & ThisType<PreviewFacade> = {
 id: "", version: "", rootURI: "", _states: new Map(), _cacheManager: new CacheManager(), _cache: new Map(), _prefObservers: [], _prefPaneCleanups: new Set(), _stylesheets: new Map(), _positionTimers: new Map(), _positionObservers: new Map(), _positionRuns: new Map(), _lifecycle: null, _stats: {generations:0,cacheHits:0}, _sectionID: null, _notifierID: null,
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
		this._sectionID = (Zotero.ItemPaneManager.registerSection as unknown as (options: {paneID:string;pluginID:string;header:object;sidenav:object;onInit:(p:Parameters<typeof initSection>[1])=>void;onDestroy:(p:{body:HTMLElement})=>void;onItemChange:(p:Props)=>void;onRender:(p:Props)=>void;onAsyncRender:(p:{body:HTMLElement})=>Promise<void>;onToggle:(p:{body:HTMLElement})=>void})=>string | false)({
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
						this._queuePosition(state.body.closest('item-details') as PositionOwner | null);
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
		return resolvePosition(this.pref('position') as string);
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
			getPref: n => this.pref(n) as string,
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

	notify(event, type, ids) {
		if (this.initialized && type === 'tab' && event === 'select') {
			for (const state of this._states.values()) {
				this._queuePosition(state.body.closest('item-details') as PositionOwner | null);
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
		const bounds: Record<string,[number,number,number]> = {
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
			Zotero.logError?.(error as Error);
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

		const cleanup = (action: () => void) => this._cleanup(action);
		for (const dispose of [...this._prefPaneCleanups]) cleanup(dispose);
		this._prefPaneCleanups.clear();
		if (this._notifierID != null) {
			cleanup(() => Zotero.Notifier.unregisterObserver(this._notifierID!));
		}
		for (const observer of this._prefObservers) {
			cleanup(() => Zotero.Prefs.unregisterObserver(observer));
		}
		if (this._sectionID) {
			cleanup(() => Zotero.ItemPaneManager.unregisterSection(this._sectionID as string));
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

const actionDescriptors = Object.getOwnPropertyDescriptors(previewActions);
for (const name of Reflect.ownKeys(actionDescriptors)) {
	if (Object.hasOwn(core, name)) throw new Error(`Duplicate preview facade method: ${String(name)}`);
}
export const preview = Object.defineProperties(core, actionDescriptors) as PreviewFacade;

// Bind to global Zotero object
if (typeof Zotero !== 'undefined') {
	(Zotero as unknown as {zoteropreview: PreviewFacade}).zoteropreview = preview;
}
