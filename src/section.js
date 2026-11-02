import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from './constants.js';

/**
 * Initializes a new ItemPane section instance for a document and body.
 */
export function initSection(plugin, { doc, body, refresh }) {
	if (plugin._states.has(body)) return;
	doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.('zotero-preview.ftl');
	plugin._ensureSectionHeader(body);

	let sheet = plugin._stylesheets.get(doc);
	if (!sheet) {
		const link = doc.createElementNS('http://www.w3.org/1999/xhtml', 'link');
		Object.assign(link, { rel: 'stylesheet', href: plugin.rootURI + 'style.css' });
		doc.documentElement.appendChild(link);
		sheet = { link, count: 0 };
		plugin._stylesheets.set(doc, sheet);
	}
	sheet.count++;

	body.classList.add('zotero-preview-root');
	const state = {
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
		destroyed: false
	};

	state.handler = event => {
		const button = event.target?.closest?.('[data-copy-citation], [data-preview-retry]');
		if (!button || !body.contains(button)) return;
		if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
		if (event.repeat) return;
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

	body.addEventListener('click', state.handler);
	body.addEventListener('keydown', state.handler);
	plugin._states.set(body, state);

	const owner = body.closest('item-details');
	plugin._observePosition(owner, state);
	plugin._queuePosition(owner);
	if (owner && doc.defaultView.ResizeObserver) {
		state.sizingOwner = owner;
		state.widthObserver = new doc.defaultView.ResizeObserver(() => plugin._fitWidth(state));
		state.widthObserver.observe(owner);
	}
}

/**
 * Handles an item change event dispatched from Zotero ItemPane.
 */
export function changeItem(plugin, { body, item, tabType, setEnabled }) {
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
export function prepareRender(plugin, props) {
	const state = plugin._states.get(props.body);
	if (!state) return;
	plugin._ensureSectionHeader(props.body);
	plugin._queuePosition(props.body.closest('item-details'));
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
export function cancelRender(state) {
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
export function renderSection(plugin, { body }) {
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
export async function runRender(plugin, state) {
	state.item = plugin._normalizeItem(state.item);
	if (!state.item) {
		state.payload = null;
		state.setEnabled?.(false);
		return;
	}
	const generation = state.generation;

	await new Promise(resolve => {
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
				state.config.font !== config.font || state.config.spacing !== config.spacing;
			state.config = config;
			if (layoutChanged) plugin._renderPayload(state, state.payload, omitted);
			return;
		}

		if (
			plugin._cache.has(key) &&
			Date.now() - plugin._cache.get(key).created > plugin._cacheTTL
		) {
			plugin._cacheDelete(key);
		}

		let payload = plugin._cache.get(key)?.payload;
		if (payload) {
			plugin._stats.cacheHits++;
			const entry = plugin._cache.get(key);
			plugin._cache.delete(key);
			plugin._cache.set(key, entry);
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
		plugin.log(error.stack || error);
		const [id, fallback] = ERROR_MESSAGES[error.previewCode] || DEFAULT_ERROR_MESSAGE;
		plugin._message(state, id, fallback, true);
	}
}

/**
 * Debounces and schedules a refresh task for the section when visible.
 */
export function scheduleRefresh(plugin, state) {
	if (!plugin.initialized || state.destroyed || state.failed || state.refreshTimer !== null) return;
	if (state.refreshTask) {
		state.refreshAgain = true;
		return;
	}
	state.refreshTimer = setTimeout(() => {
		state.refreshTimer = null;
		if (!plugin.initialized || state.destroyed) return;
		if (!state.body.getClientRects().length || state.body.closest('collapsible-section')?.open === false) {
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
export function destroySection(plugin, body) {
	const state = plugin._states.get(body);
	if (!state) return;
	state.destroyed = true;
	plugin._cancelRender(state);
	state.refreshAgain = false;
	state.refreshTask = null;
	plugin._cleanup(() => state.widthObserver?.disconnect());

	const positionEntry = plugin._positionObservers.get(state.positionOwner);
	if (positionEntry && --positionEntry.count === 0) {
		plugin._cleanup(() => positionEntry.observer.disconnect());
		plugin._positionObservers.delete(state.positionOwner);
		const timer = plugin._positionTimers.get(state.positionOwner);
		if (timer !== undefined) clearTimeout(timer);
		plugin._positionTimers.delete(state.positionOwner);
	}

	if (state.refreshTimer !== null) clearTimeout(state.refreshTimer);
	for (const timer of state.feedbackTimers) clearTimeout(timer);
	state.copyFeedback.clear();
	plugin._cleanup(() => body.removeEventListener('click', state.handler));
	plugin._cleanup(() => body.removeEventListener('keydown', state.handler));
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
export function queueAllPreviews(plugin) {
	plugin._cache.clear();
	plugin._cacheBytes = 0;
	for (const state of plugin._states.values()) {
		state.payload = null;
		plugin._cancelRender(state);
		plugin._scheduleRefresh(state);
	}
}

/**
 * Updates layout styles (font size, spacing) on all active states.
 */
export function updateLayout(plugin) {
	for (const state of plugin._states.values()) {
		if (!state.config || state.destroyed) continue;
		Object.assign(state.config, plugin._layoutConfig());
		state.body.style.setProperty('--zotero-preview-font-size', state.config.font + 'em');
		state.body.style.setProperty('--zotero-preview-line-height', state.config.spacing);
	}
}
