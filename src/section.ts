import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from './constants.ts';
import type {Item, PreviewConfig} from './csl.ts';
import type {PositionOwner} from './position.ts';

export type Payload = Record<string,{html:string;text:string}>;
export type Config = PreviewConfig & {limit:number;font:number;spacing:number;asHTML:boolean};
export type State = {doc:Document;body:HTMLElement;refresh:()=>void|Promise<void>;item:Item|null;tabType:string|null;ids:number[];generation:number;key:string|null;payload:Payload|null;timer:number|null;resolve:(()=>void)|null;refreshTimer:number|null;feedbackTimers:Set<number>;copyFeedback:Map<HTMLElement,number[]>;destroyed:boolean;controller:AbortController;handler?:EventListener;sizingOwner?:Element|null;widthObserver?:ResizeObserver;setEnabled?:(b:boolean)=>void;lastHTML?:string|null;failed?:boolean;renderTask?:Promise<void>|null;cancelStyles?:(()=>void)|null;config?:Config;omitted?:number;refreshTask?:Promise<void>|null;refreshAgain?:boolean;positionOwner?:PositionOwner|null};
export type Props = {body:HTMLElement;item:Item|null;tabType:string;setEnabled:(b:boolean)=>void};
export type Plugin = {initialized:boolean;rootURI:string;_states:Map<HTMLElement,State>;_stylesheets:Map<Document,{link:Element;count:number}>;_positionObservers:Map<PositionOwner,{observer:MutationObserver;count:number}>;_positionTimers:Map<PositionOwner,number>;_cacheBytes:number;_cache?:Map<unknown,unknown>;_cacheManager?:{get(k:string):unknown;clear():void};_stats:{cacheHits:number;generations:number};_ensureSectionHeader(b:HTMLElement):void;_cancelRender(s:State):void;_message(s:State,id:string,f:string,e?:boolean):void;_scheduleRefresh(s:State):void;copyCitation(c:boolean,b:HTMLElement,button:HTMLElement):void;_observePosition(o:PositionOwner|null,s:State):void;_queuePosition(o:PositionOwner|null):void;_fitWidth(s:State):void;_normalizeItem(i:Item|null):Item|null;_changeItem(p:Props):void;_runRender(s:State):Promise<void>;_waitForStyles(s:State):Promise<boolean>;_items(s:State):Item[];_config(i:Item):Config;_previewKey(i:Item[],c:Config):string;_cacheGet?(k:string):Payload|null;_cachePut(k:string,p:Payload,ids:number[]):void;_generate(i:Item[],c:Config):Payload;log(e:unknown):void;_renderPayload(s:State,p:Payload,n:number):void;_cleanup(a:()=>void):void;_cacheClear?():void;_layoutConfig():{font:number;spacing:number}};


/**
 * Initializes a new ItemPane section instance for a document and body.
 */
export function initSection(plugin: Plugin, { doc, body, refresh }: {doc:Document;body:HTMLElement;refresh:()=>void|Promise<void>}) {
	if (plugin._states.has(body)) return;
	doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');
	plugin._ensureSectionHeader(body);

	let sheet = plugin._stylesheets.get(doc);
	if (!sheet) {
		const link = doc.createElementNS('http://www.w3.org/1999/xhtml', 'link');
		Object.assign(link, { rel: 'stylesheet', href: plugin.rootURI + 'style.css' });
		doc.documentElement!.appendChild(link);
		sheet = { link, count: 0 };
		plugin._stylesheets.set(doc, sheet);
	}
	sheet.count++;

	body.classList.add('zotero-preview-root');
	const state: State = {
		doc,
		body,
		refresh,
		item: null,
		tabType: null,
		ids: [],
		generation: 0,
		key: null,
		payload: null,
		timer: null,
		resolve: null,
		refreshTimer: null,
		feedbackTimers: new Set(),
		copyFeedback: new Map(),
		destroyed: false,
		controller: new (doc.defaultView?.AbortController || AbortController)()
	};

	state.handler = (event: Event) => {
        const keyboard = event as KeyboardEvent;
		const button = (event.target as Element | null)?.closest?.('[data-copy-citation], [data-preview-retry]') as HTMLElement | null;
		if (!button || !body.contains(button)) return;
		if (event.type === 'keydown' && !['Enter', ' '].includes(keyboard.key)) return;
		if (keyboard.repeat) return;
		if ('previewRetry' in button.dataset && event.type === 'keydown' && button.localName === 'button') return;
		event.preventDefault();
		if ('previewRetry' in button.dataset) {
			plugin._cancelRender(state);
			plugin._message(state, 'zotero-preview-loading', 'Loading preview…');
			plugin._scheduleRefresh(state);
		} else {
			plugin.copyCitation(button.dataset.copyCitation === 'true', body, button);
		}
	};

	body.addEventListener('click', state.handler, { signal: state.controller.signal });
	body.addEventListener('keydown', state.handler, { signal: state.controller.signal });
	plugin._states.set(body, state);

	const owner = body.closest('item-details') as PositionOwner | null;
	plugin._observePosition(owner, state);
	plugin._queuePosition(owner);
	const RO = doc.defaultView?.ResizeObserver || globalThis.ResizeObserver;
	if (owner && RO) {
		state.sizingOwner = owner;
		state.widthObserver = new RO(() => plugin._fitWidth(state));
		state.widthObserver!.observe(owner);
	}
}

/**
 * Handles an item change event dispatched from Zotero ItemPane.
 */
export function changeItem(plugin: Plugin, { body, item, tabType, setEnabled }: Props) {
	const state = plugin._states.get(body);
	if (!state) return;
	const normalized = plugin._normalizeItem(item);
	if (state.item?.id === normalized?.id && state.tabType === tabType) {
		state.item = normalized;
		state.setEnabled = setEnabled;
		return;
	}
	plugin._cancelRender(state);
	state.item = normalized;
	state.tabType = tabType;
	state.setEnabled = setEnabled;
	state.ids = state.item ? [state.item.id] : [];
	state.key = null;
	state.payload = null;
	state.lastHTML = null;
	setEnabled(!!state.item);
}

/**
 * Prepares the section DOM before async rendering starts.
 */
export function prepareRender(plugin: Plugin, props: Props) {
	const state = plugin._states.get(props.body);
	if (!state) return;
	plugin._ensureSectionHeader(props.body);
	plugin._queuePosition(props.body.closest('item-details') as PositionOwner | null);
	if (
		state.item?.id !== plugin._normalizeItem(props.item)?.id ||
		state.tabType !== props.tabType
	) {
		plugin._changeItem(props);
	}
	if (!state.payload && !state.lastHTML) {
		plugin._message(state, 'zotero-preview-loading', 'Loading preview…');
	}
}

/**
 * Cancels any active or pending render pipeline for a given section state.
 */
export function cancelRender(state: State) {
	state.generation++;
	state.failed = false;
	state.renderTask = null;
	state.cancelStyles?.();
	if (state.timer !== null) clearTimeout(state.timer);
	state.timer = null;
	state.resolve?.();
	state.resolve = null;
}

/**
 * Initiates or joins an asynchronous preview render operation.
 */
export function renderSection(plugin: Plugin, { body }: {body:HTMLElement}) {
	const state = plugin._states.get(body);
	if (!plugin.initialized || !state || state.destroyed || !state.item || state.failed) {
		return Promise.resolve();
	}
	if (state.renderTask) return state.renderTask;
	const task = plugin._runRender(state).finally(() => {
		if (state.renderTask === task) state.renderTask = null;
	});
	state.renderTask = task;
	return task;
}

/**
 * Executes full render pipeline including style check, cache lookup, CSL formatting, and rendering.
 */
export async function runRender(plugin: Plugin, state: State) {
	state.item = plugin._normalizeItem(state.item);
	if (!state.item) {
		state.payload = null;
		state.setEnabled?.(false);
		return;
	}
	const generation = state.generation;

	await new Promise<void>(resolve => {
		state.resolve = resolve;
		state.timer = setTimeout(() => {
			state.timer = null;
			state.resolve = null;
			resolve();
		}, 40);
	});
	if (state.destroyed || generation !== state.generation || !plugin.initialized) return;

	try {
		if (!(await plugin._waitForStyles(state))) return;
		if (state.destroyed || generation !== state.generation || !plugin.initialized) return;

		const allItems = plugin._items(state);
		state.ids = allItems.map(item => item.id);
		if (!allItems.length) {
			state.payload = null;
			plugin._message(state, 'zotero-preview-select-items', 'Select one or more items to preview.');
			return;
		}

		const config = plugin._config(state.item);
		const items = allItems.slice(0, Math.floor(config.limit));
		const key = plugin._previewKey(items, config);
		const omitted = allItems.length - items.length;

		if (state.payload && state.key === key && state.omitted === omitted) {
			const layoutChanged =
				state.config?.font !== config.font || state.config?.spacing !== config.spacing;
			state.config = config;
			if (layoutChanged) plugin._renderPayload(state, state.payload, omitted);
			return;
		}

		let payload = (plugin._cacheGet ? plugin._cacheGet(key) : plugin._cacheManager?.get(key)) as Payload | null | undefined;
		if (payload) {
			plugin._stats.cacheHits++;
		} else {
			const started = Date.now();
			payload = plugin._generate(items, config);
			plugin._stats.generations++;
			plugin._cachePut(key, payload, items.map(item => item.id));
			plugin.log(`CSL ${Date.now() - started}ms, ${items.length} items`);
		}

		if (state.destroyed || generation !== state.generation) return;
		state.key = key;
		state.payload = payload;
		state.config = config;
		state.omitted = omitted;
		plugin._renderPayload(state, payload, omitted);
	} catch (error) {
		if (state.destroyed || generation !== state.generation || !plugin.initialized) return;
		state.payload = null;
		state.failed = true;
		plugin.log(error instanceof Error ? error.stack || error : error);
		const [id, fallback] = ERROR_MESSAGES[(error as {previewCode?: keyof typeof ERROR_MESSAGES})?.previewCode as keyof typeof ERROR_MESSAGES] || DEFAULT_ERROR_MESSAGE;
		plugin._message(state, id, fallback, true);
	}
}

/**
 * Debounces and schedules a refresh task for the section when visible.
 */
export function scheduleRefresh(plugin: Plugin, state: State) {
	if (!plugin.initialized || state.destroyed || state.failed || state.refreshTimer !== null) return;
	if (state.refreshTask) {
		state.refreshAgain = true;
		return;
	}
	state.refreshTimer = setTimeout(() => {
		state.refreshTimer = null;
		if (!plugin.initialized || state.destroyed) return;
		if (!state.body.getClientRects().length || (state.body.closest('collapsible-section') as (Element & {open?:boolean}) | null)?.open === false) {
			return;
		}
		const task = Promise.resolve()
			.then(() => {
				if (plugin.initialized && !state.destroyed) return state.refresh();
			})
			.catch(error => plugin.log(error))
			.finally(() => {
				if (state.refreshTask !== task) return;
				state.refreshTask = null;
				if (state.refreshAgain) {
					state.refreshAgain = false;
					plugin._scheduleRefresh(state);
				}
			});
		state.refreshTask = task;
	}, 80);
}

/**
 * Cleans up and unbinds a single section instance.
 */
export function destroySection(plugin: Plugin, body: HTMLElement) {
	const state = plugin._states.get(body);
	if (!state) return;
	state.destroyed = true;
	plugin._cancelRender(state);
	state.refreshAgain = false;
	state.refreshTask = null;
	plugin._cleanup(() => state.widthObserver?.disconnect());

	const positionEntry = plugin._positionObservers.get(state.positionOwner!);
	if (positionEntry && --positionEntry.count === 0) {
		plugin._cleanup(() => positionEntry.observer.disconnect());
		plugin._positionObservers.delete(state.positionOwner!);
		const timer = plugin._positionTimers.get(state.positionOwner!);
		if (timer !== undefined) clearTimeout(timer);
		plugin._positionTimers.delete(state.positionOwner!);
	}

	if (state.refreshTimer !== null) clearTimeout(state.refreshTimer);
	for (const timer of state.feedbackTimers) clearTimeout(timer);
	state.copyFeedback.clear();
	plugin._cleanup(() => state.controller.abort());
	plugin._states.delete(body);

	const sheet = plugin._stylesheets.get(state.doc);
	if (sheet && --sheet.count === 0) {
		plugin._cleanup(() => sheet.link.remove());
		plugin._stylesheets.delete(state.doc);
	}
}

/**
 * Clears cache and schedules preview refresh across all registered sections.
 */
export function queueAllPreviews(plugin: Plugin) {
	if (typeof plugin._cacheClear === 'function') {
		plugin._cacheClear();
	} else if (plugin._cacheManager) {
		plugin._cacheManager.clear();
	} else {
		plugin._cache?.clear();
		plugin._cacheBytes = 0;
	}
	for (const state of plugin._states.values()) {
		state.payload = null;
		plugin._cancelRender(state);
		plugin._scheduleRefresh(state);
	}
}

/**
 * Updates layout styles (font size, spacing) on all active states.
 */
export function updateLayout(plugin: Plugin) {
	for (const state of plugin._states.values()) {
		if (!state.config || state.destroyed) continue;
		Object.assign(state.config, plugin._layoutConfig());
		state.body.style.setProperty('--zotero-preview-font-size', state.config.font + 'em');
		state.body.style.setProperty('--zotero-preview-line-height', String(state.config.spacing));
	}
}
