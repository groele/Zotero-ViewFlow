import { setupCachePreferences } from './cache-preferences.ts';
declare const document: Document;
declare const window: Window;
// Preference handlers are scoped to this preference-pane document.
(() => {
type PreferenceValue = string | number | boolean | undefined;
type PreferenceControl = HTMLElement & { value: string | number; checked: boolean };
type PreferencePreview = {
    initialized: boolean;
    version?: string;
    _prefPrefix: string;
    _prefPaneCleanups: Set<() => void>;
    _citationCache?: { clear(): Promise<void>; count: number; saveFailed?: boolean; lastError?: Error | null; getFilePath(): string; getDirectoryPath(): string };
    pref(name: string): PreferenceValue;
    setPref(name: string, value: PreferenceValue): void;
    getPosition(): string;
    _queueAllPreviews(): void;
};
type PreferencesHost = {
    zoteropreview: PreferencePreview;
    Styles: { init(): Promise<unknown>; getVisible(): Array<{styleID: string; title: string}> };
    Prefs?: {
        registerObserver?(pref: string, handler: () => void, owns?: boolean): symbol;
        unregisterObserver?(id: symbol): void;
    };
    logError(error: unknown): void;
};
type XULDocument = Document & { createXULElement(name: string): Element };
const host = Zotero as unknown as PreferencesHost;
const xulDocument = document as XULDocument;
const preview = host.zoteropreview;
const initializedRoots = new WeakSet<Element>();
const initializingRoots = new WeakSet<Element>();
let disposed = false;
const cacheCleanups: Array<() => void> = [];
const prefObservers: symbol[] = [];
const controller = new AbortController();
const listen = (target: EventTarget | null, type: string, handler: EventListener, capture = false) => {
    if (!target) return;
    target.addEventListener(type, handler, { capture, signal: controller.signal });
};
const prefs = {
    async init() {
        const root = document.getElementById('zotero-prefpane-zotero-preview');
        if (disposed || !preview.initialized || !root || initializedRoots.has(root) || initializingRoots.has(root)) return;
        initializingRoots.add(root);
        try {
        // A fresh profile can open Preferences before Zotero's style cache is ready.
        // Await the host's shared initialization promise before calling getVisible().
        await host.Styles.init();
        if (disposed || !root.isConnected || !preview.initialized) return;
        if (preview.version) {
            const badge = document.getElementById('viewflow-version-badge');
            if (badge) {
                badge.setAttribute('data-l10n-args', JSON.stringify({ version: preview.version }));
                badge.textContent = `v${preview.version}`;
            }
            const downloadLink = document.getElementById('viewflow-release-download-link');
            if (downloadLink) {
                downloadLink.setAttribute('data-l10n-args', JSON.stringify({ version: preview.version }));
                downloadLink.setAttribute(
                    'href',
                    `https://github.com/groele/Zotero-ViewFlow/releases/download/v${preview.version}/Zotero-ViewFlow-${preview.version}.xpi`
                );
            }
        }
        const popup = document.querySelector('#zotero-preview-style-menulist menupopup');
        if (popup) {
            popup.replaceChildren();
            const automatic = xulDocument.createXULElement('menuitem');
            automatic.setAttribute('value', '');
            automatic.setAttribute('data-l10n-id', 'zotero-preview-follow-quickcopy');
            popup.appendChild(automatic);
            const styles = host.Styles.getVisible();
            const selectedStyle = (preview.pref('citationstyle') || '') as string;
            if (selectedStyle && !styles.some(style => style.styleID === selectedStyle)) {
                const missing = xulDocument.createXULElement('menuitem');
                missing.setAttribute('value', selectedStyle);
                missing.setAttribute('data-l10n-id', 'zotero-preview-settings-missing-style');
                popup.appendChild(missing);
            }
            for (const style of styles) {
                const entry = xulDocument.createXULElement('menuitem');
                entry.setAttribute('value', style.styleID);
                entry.setAttribute('label', style.title);
                popup.appendChild(entry);
            }
            const menu = document.getElementById('zotero-preview-style-menulist') as PreferenceControl | null;
            if (menu) {
                menu.value = selectedStyle;
                listen(menu, 'command', () => preview.setPref(preview._prefPrefix + 'citationstyle', menu.value));
            }
        }
        const position = document.getElementById('extensions-zoteropreview-position') as PreferenceControl | null;
        if (position) {
            position.value = preview.getPosition();
            listen(position, 'command', () => preview.setPref(preview._prefPrefix + 'position', position.value));
        }
        const display = document.getElementById('extensions-zoteropreview-whatToShow') as PreferenceControl | null;
        if (display) {
            display.value = (preview.pref('whatToShow') || 'zpboth') as string;
            listen(display, 'command', () => preview.setPref(preview._prefPrefix + 'whatToShow', display.value));
        }
        for (const [id, name, fallback] of [
            ['zotero-preview-fontsize', 'fontsize', 1],
            ['zotero-preview-spacing', 'spacing', 1.5],
            ['zotero-preview-max-items', 'maxPreviewItems', 100],
            ['zotero-preview-cache-quota', 'cacheMaxEntries', 2000],
            ['zotero-preview-cache-ttl', 'cacheTtlDays', 90]
        ] as const) {
            const input = document.getElementById(id) as PreferenceControl | null;
            if (input) {
                input.value = (preview.pref(name) ?? fallback) as string | number;
                listen(input, 'change', () => {
                    preview.setPref(preview._prefPrefix + name, input.value);
                    input.value = String(preview.pref(name) ?? '');
                });
            }
        }
        const debug = document.getElementById('extensions-zoteropreview-debug') as PreferenceControl | null;
        if (debug) {
            debug.checked = !!preview.pref('debug');
            listen(debug, 'command', () => preview.setPref(preview._prefPrefix + 'debug', debug.checked));
        }
        const clearBtn = document.getElementById('zotero-preview-clear-cache-btn');
        if (clearBtn) {
            listen(clearBtn, 'command', () => preview._queueAllPreviews());
        }

        const updateDependencies = () => {
            const lookupEnabled = preview.pref('lookupEnabled') !== false;
            const historyPref = preview.pref('lookupHistoryEnabled') !== false;
            const historyEnabled = lookupEnabled && historyPref;
            const lookupEl = document.getElementById('extensions-zoteropreview-lookupEnabled') as (HTMLInputElement & { checked: boolean }) | null;
            if (lookupEl) lookupEl.checked = lookupEnabled;
            const histEl = document.getElementById('extensions-zoteropreview-lookupHistoryEnabled') as (HTMLInputElement & { checked: boolean; disabled: boolean }) | null;
            if (histEl) {
                histEl.checked = historyPref;
                histEl.disabled = !lookupEnabled;
            }
            for (const did of [
                'zotero-preview-cache-dir',
                'zotero-preview-cache-browse',
                'zotero-preview-cache-default',
                'zotero-preview-cache-recommend',
                'zotero-preview-cache-quota',
                'zotero-preview-cache-ttl',
                'zotero-preview-clear-history-btn'
            ]) {
                const el = document.getElementById(did) as (HTMLInputElement & { disabled: boolean }) | null;
                if (el) el.disabled = !historyEnabled;
            }
            const retryEl = document.getElementById('zotero-preview-cache-retry') as (HTMLInputElement & { disabled: boolean }) | null;
            if (retryEl) {
                const failed = !!(preview._citationCache?.saveFailed || preview._citationCache?.lastError);
                retryEl.disabled = !historyEnabled || !failed;
            }
        };
        for (const checkId of ['extensions-zoteropreview-lookupEnabled', 'extensions-zoteropreview-lookupHistoryEnabled']) {
            const checkEl = document.getElementById(checkId);
            if (checkEl) {
                listen(checkEl, 'command', () => {
                    setTimeout(updateDependencies, 0);
                });
            }
        }
        for (const name of ['lookupEnabled', 'lookupHistoryEnabled']) {
            const id = host.Prefs?.registerObserver?.(preview._prefPrefix + name, () => {
                if (!disposed) updateDependencies();
            }, true);
            if (id !== undefined) prefObservers.push(id);
        }
        updateDependencies();

        const resetBtn = document.getElementById('zotero-preview-reset-defaults-btn');
        if (resetBtn) {
            listen(resetBtn, 'command', () => {
                const defaults: Record<string, string | number | boolean> = {
                    citationstyle: '',
                    position: 'zotero-item-pane-header',
                    whatToShow: 'zpboth',
                    fontsize: '1',
                    spacing: '1.5',
                    debug: false,
                    maxPreviewItems: 100,
                    lookupEnabled: true,
                    lookupHistoryEnabled: true,
                    cacheDirectory: '',
                    cacheMaxEntries: 2000,
                    cacheTtlDays: 90
                };
                for (const [name, value] of Object.entries(defaults)) {
                    preview.setPref(preview._prefPrefix + name, value);
                }
                const menu = document.getElementById('zotero-preview-style-menulist') as PreferenceControl | null;
                if (menu) menu.value = '';
                if (position) position.value = 'zotero-item-pane-header';
                if (display) display.value = 'zpboth';
                if (debug) debug.checked = false;
                for (const [id, value] of [
                    ['zotero-preview-fontsize', '1'],
                    ['zotero-preview-spacing', '1.5'],
                    ['zotero-preview-max-items', '100'],
                    ['zotero-preview-cache-quota', '2000'],
                    ['zotero-preview-cache-ttl', '90']
                ] as const) {
                    const input = document.getElementById(id) as PreferenceControl | null;
                    if (input) input.value = value;
                }
                updateDependencies();
                preview._queueAllPreviews();
            });
        }

        const clearHistoryBtn = document.getElementById('zotero-preview-clear-history-btn');
        if (clearHistoryBtn) {
            listen(clearHistoryBtn, 'command', async () => {
                if (preview._citationCache) {
                    try { await preview._citationCache.clear(); }
                    catch (error) {
                        document.getElementById('zotero-preview-cache-status')?.setAttribute('data-l10n-id', 'zotero-preview-cache-clear-failed');
                        host.logError(error);
                        return;
                    }
                    const statsDesc = document.getElementById('zotero-preview-cache-stats');
                    if (statsDesc) {
                        statsDesc.setAttribute('data-l10n-id', 'zotero-preview-cache-usage');
                        statsDesc.setAttribute('data-l10n-args', JSON.stringify({count: 0, limit: Number(preview.pref('cacheMaxEntries') || 2000)}));
                    }
                }
            });
        }
        cacheCleanups.push(setupCachePreferences(preview, document, listen));
        initializedRoots.add(root);
        } catch (error) {
            if (!disposed) host.logError(error);
        } finally {
            initializingRoots.delete(root);
        }
    }
};
// Zotero loads pane scripts before inserting the fragment, then dispatches
// non-bubbling load events. Capture them without a CSP-blocked inline handler.
listen(document, 'load', event => {
    if ((event.target as Element | null)?.id === 'zotero-prefpane-zotero-preview') prefs.init();
}, true);
const dispose = () => {
    disposed = true;
    controller.abort();
    for (const id of prefObservers.splice(0)) host.Prefs?.unregisterObserver?.(id);
    for (const cleanup of cacheCleanups.splice(0)) cleanup();
    preview._prefPaneCleanups.delete(dispose);
};
preview._prefPaneCleanups.add(dispose);
listen(document, 'unload', event => {
    if ((event.target as Element | null)?.id === 'zotero-prefpane-zotero-preview') dispose();
}, true);
listen(window, 'unload', dispose);
prefs.init();
})();
