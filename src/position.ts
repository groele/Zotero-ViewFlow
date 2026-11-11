type Pane = HTMLElement;
export type PositionOwner = Element & {
 getPanes(): Pane[];
 skipRender?: boolean;
 sidenav?: { container: PositionOwner; querySelectorAll(selector: string): NodeListOf<HTMLElement>; changePaneOrder(id: string, index: number, options: {persist: boolean; render: boolean}): Promise<void> };
 changePaneOrder?(id: string, index: number, options: {render: boolean}): Promise<void>;
};
export type PositionState = { positionOwner?: PositionOwner | null; body: HTMLElement; doc: Document; payload?: unknown; sizingOwner?: Element | null; destroyed: boolean };
export type PositionPlugin = {
 initialized: boolean; _lifecycle: symbol | null; _sectionID: string | false | null; _lookupSectionID?: string | false | null;
 _positionObservers: Map<PositionOwner, {observer: MutationObserver; count: number}>;
 _positionTimers: Map<PositionOwner, number>; _positionRuns: Map<PositionOwner, {dirty: boolean}>;
 _states: Map<unknown, PositionState>;
 _queuePosition(owner: PositionOwner | null): void; _applyPosition(owner: PositionOwner): Promise<void>;
 _scheduleRefresh(state: PositionState): void; getPosition(): string; log(error: unknown): void;
};

/**
 * Validates and returns the user-selected section position in item-details.
 */
export function resolvePosition(prefValue: string) {
	return ['zotero-item-pane-header', 'zotero-editpane-item-box', 'zotero-editpane-related'].includes(prefValue)
		? prefValue
		: 'zotero-item-pane-header';
}

/**
 * Observes the parent container of panes in item-details to re-apply section order on mutation.
 */
export function observePosition(plugin: PositionPlugin, owner: PositionOwner | null, state: PositionState) {
	if (state.positionOwner === owner) return;
	if (!owner?.getPanes) return;
	const parent = owner.getPanes().find(pane => pane.contains?.(state.body))?.parentNode;
	const Observer = state.doc.defaultView?.MutationObserver;
	if (!parent || !Observer) return;
	let entry = plugin._positionObservers.get(owner);
	if (!entry) {
		const observer = new Observer(() => plugin._queuePosition(owner));
		observer.observe(parent, { childList: true });
		entry = { observer, count: 0 };
		plugin._positionObservers.set(owner, entry);
	}
	entry.count++;
	state.positionOwner = owner;
}

/**
 * Debounces and queues a position check/reorder task for the given item-details owner.
 */
export function queuePosition(plugin: PositionPlugin, owner: PositionOwner | null) {
	if (!plugin.initialized || !owner?.getPanes || plugin._positionTimers.has(owner)) return;
	const run = plugin._positionRuns.get(owner);
	if (run) {
		run.dirty = true;
		return;
	}
	const lifecycle = plugin._lifecycle;
	const timer = setTimeout(() => {
		plugin._positionTimers.delete(owner);
		if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
		const task = { dirty: false };
		plugin._positionRuns.set(owner, task);
		plugin
			._applyPosition(owner)
			.catch(error => plugin.log(error))
			.finally(() => {
				if (plugin._positionRuns.get(owner) !== task) return;
				plugin._positionRuns.delete(owner);
				if (task.dirty && plugin.initialized && lifecycle === plugin._lifecycle) {
					plugin._queuePosition(owner);
				}
			});
	}, 0);
	plugin._positionTimers.set(owner, timer);
}

/**
 * Orders the Zotero ViewFlow section pane relative to other panes (header, after info, or bottom).
 */
async function applyPreviewPosition(plugin: PositionPlugin, owner: PositionOwner) {
	if (!plugin.initialized) return;
	const lifecycle = plugin._lifecycle;
	const sectionID = plugin._sectionID;
	if (!sectionID) return;
	const panes = owner.getPanes();
	const current = panes.findIndex(pane => pane.dataset.pane === plugin._sectionID);
	if (current < 0 || owner.skipRender) return;
	const position = plugin.getPosition();
	if (position === 'zotero-editpane-related' && current === panes.length - 2 && panes.at(-1)?.dataset.pane === plugin._lookupSectionID) return;
	let index = position === 'zotero-editpane-related' ? panes.length : 0;
	if (position === 'zotero-editpane-item-box') {
		const info = panes.findIndex(pane => pane.dataset.pane === 'info');
		index = info < 0 ? 0 : info + 1;
	}
	if (current === index || current === index - 1) return;

	const sidenav = owner.sidenav;
	if (sidenav?.container === owner && sidenav.changePaneOrder) {
		const wrappers = Array.from(sidenav.querySelectorAll?.('.inherit-flex > .pin-wrapper') || []) as HTMLElement[];
		const targetID = panes[index]?.dataset.pane;
		const targetIndex = targetID
			? wrappers.findIndex(wrapper => wrapper.querySelector<HTMLElement>('.btn[data-pane]')?.dataset.pane === targetID)
			: wrappers.length;
		await sidenav.changePaneOrder(
			sectionID,
			wrappers.length && targetIndex >= 0 ? targetIndex : index,
			{ persist: false, render: false }
		);
		if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
		const updated = owner.getPanes();
		const actual = updated.findIndex(pane => pane.dataset.pane === plugin._sectionID);
		const target = targetID ? updated.findIndex(pane => pane.dataset.pane === targetID) : updated.length;
		if (actual >= 0 && target >= 0 && actual !== target && actual !== target - 1) {
			await owner.changePaneOrder?.(sectionID, target, { render: false });
		}
	} else if (owner.changePaneOrder) {
		await owner.changePaneOrder(sectionID, index, { render: false });
	}

	if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
	for (const state of plugin._states.values()) {
		if (state.body.closest('item-details') === owner && !state.payload) {
			plugin._scheduleRefresh(state);
		}
	}
}

/** Keeps the lookup pane and its navigation button directly after the preview. */
export async function applyPosition(plugin: PositionPlugin, owner: PositionOwner) {
    const lifecycle = plugin._lifecycle;
    await applyPreviewPosition(plugin, owner);
    if (!plugin.initialized || lifecycle !== plugin._lifecycle || owner.skipRender) return;
    const lookupID = plugin._lookupSectionID;
    if (!lookupID) return;
    const panes = owner.getPanes();
    const preview = panes.findIndex(pane => pane.dataset.pane === plugin._sectionID);
    const lookup = panes.findIndex(pane => pane.dataset.pane === lookupID);
    if (preview < 0 || lookup < 0) return;
    const sidenav = owner.sidenav;
    const wrappers = Array.from(sidenav?.querySelectorAll?.('.inherit-flex > .pin-wrapper') || []) as HTMLElement[];
    const navIDs = wrappers.map(wrapper => wrapper.querySelector<HTMLElement>('.btn[data-pane]')?.dataset.pane);
    const navPreview = navIDs.indexOf(plugin._sectionID || '');
    const navLookup = navIDs.indexOf(lookupID);
    if (lookup === preview + 1 && (navPreview < 0 || navLookup === navPreview + 1)) return;
    if (sidenav?.container === owner && navPreview >= 0) {
        await sidenav.changePaneOrder(lookupID, navPreview + 1, {persist: false, render: false});
    }
    if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
    const updated = owner.getPanes();
    const eye = updated.findIndex(pane => pane.dataset.pane === plugin._sectionID);
    const magnifier = updated.findIndex(pane => pane.dataset.pane === lookupID);
    if (eye >= 0 && magnifier >= 0 && magnifier !== eye + 1) {
        await owner.changePaneOrder?.(lookupID, eye + 1, {render: false});
    }
}

/**
 * Adjusts section maxWidth to avoid XUL intrinsic width expansion overflowing sidebars.
 */
export function fitWidth(state: PositionState) {
	if (!state.sizingOwner || state.destroyed || state.body?.isConnected === false) return;
	const bounds = state.sizingOwner.getBoundingClientRect();
	if (!bounds.width) return;
	const width = Math.max(0, Math.min(bounds.width, bounds.right - state.body.getBoundingClientRect().left - 8));
	const maxWidth = `${width}px`;
	if (state.body.style.maxWidth !== maxWidth) state.body.style.maxWidth = maxWidth;
}
