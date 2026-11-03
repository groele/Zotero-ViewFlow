// Preference handlers are scoped to this preference-pane document.
(() => {
const preview = Zotero.zoteropreview;
const initializedRoots = new WeakSet();
const initializingRoots = new WeakSet();
let disposed = false;
const listeners = [];
const listen = (target, type, handler, capture = false) => {
    if (!target) return;
    target.addEventListener(type, handler, capture);
    listeners.push(() => target.removeEventListener(type, handler, capture));
};
const prefs = {
    async init() {
        const root = document.getElementById('zotero-prefpane-zotero-preview');
        if (disposed || !preview.initialized || !root || initializedRoots.has(root) || initializingRoots.has(root)) return;
        initializingRoots.add(root);
        try {
        // A fresh profile can open Preferences before Zotero's style cache is ready.
        // Await the host's shared initialization promise before calling getVisible().
        await Zotero.Styles.init();
        if (disposed || !root.isConnected || !preview.initialized) return;
        const popup = document.querySelector('#zotero-preview-style-menulist menupopup');
        if (popup) {
            popup.replaceChildren();
            const automatic = document.createXULElement('menuitem');
            automatic.setAttribute('value', '');
            automatic.setAttribute('data-l10n-id', 'zotero-preview-follow-quickcopy');
            popup.appendChild(automatic);
            const styles = Zotero.Styles.getVisible();
            const selectedStyle = preview.pref('citationstyle') || '';
            if (selectedStyle && !styles.some(style => style.styleID === selectedStyle)) {
                const missing = document.createXULElement('menuitem');
                missing.setAttribute('value', selectedStyle);
                missing.setAttribute('data-l10n-id', 'zotero-preview-settings-missing-style');
                popup.appendChild(missing);
            }
            for (const style of styles) {
                const entry = document.createXULElement('menuitem');
                entry.setAttribute('value', style.styleID);
                entry.setAttribute('label', style.title);
                popup.appendChild(entry);
            }
            const menu = document.getElementById('zotero-preview-style-menulist');
            if (menu) {
                menu.value = selectedStyle;
                listen(menu, 'command', () => preview.setPref(preview._prefPrefix + 'citationstyle', menu.value));
            }
        }
        const position = document.getElementById('extensions-zoteropreview-position');
        if (position) {
            position.value = preview.getPosition();
            listen(position, 'command', () => preview.setPref(preview._prefPrefix + 'position', position.value));
        }
        const display = document.getElementById('extensions-zoteropreview-whatToShow');
        if (display) {
            display.value = preview.pref('whatToShow') || 'zpboth';
            listen(display, 'command', () => preview.setPref(preview._prefPrefix + 'whatToShow', display.value));
        }
        for (const [id, name, fallback] of [
            ['zotero-preview-fontsize', 'fontsize', 1],
            ['zotero-preview-spacing', 'spacing', 1.5],
            ['zotero-preview-max-items', 'maxPreviewItems', 100]
        ]) {
            const input = document.getElementById(id);
            if (input) {
                input.value = preview.pref(name) || fallback;
                listen(input, 'change', () => {
                    preview.setPref(preview._prefPrefix + name, input.value);
                    input.value = preview.pref(name);
                });
            }
        }
        const debug = document.getElementById('extensions-zoteropreview-debug');
        if (debug) {
            debug.checked = !!preview.pref('debug');
            listen(debug, 'command', () => preview.setPref(preview._prefPrefix + 'debug', debug.checked));
        }
        const clearBtn = document.getElementById('zotero-preview-clear-cache-btn');
        if (clearBtn) {
            listen(clearBtn, 'command', () => preview._queueAllPreviews());
        }
        initializedRoots.add(root);
        } catch (error) {
            if (!disposed) Zotero.logError(error);
        } finally {
            initializingRoots.delete(root);
        }
    }
};
// Zotero loads pane scripts before inserting the fragment, then dispatches
// non-bubbling load events. Capture them without a CSP-blocked inline handler.
listen(document, 'load', event => {
    if (event.target?.id === 'zotero-prefpane-zotero-preview') prefs.init();
}, true);
const dispose = () => {
    disposed = true;
    for (const remove of listeners.splice(0)) remove();
    preview._prefPaneCleanups.delete(dispose);
};
preview._prefPaneCleanups.add(dispose);
listen(document, 'unload', event => {
    if (event.target?.id === 'zotero-prefpane-zotero-preview') dispose();
}, true);
listen(window, 'unload', dispose);
prefs.init();
})();
