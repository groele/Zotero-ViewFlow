export type CachePreferencesHost = {
    _prefPrefix: string;
    pref(name: string): string | number | boolean | undefined;
    setPref(name: string, value: string | number | boolean | undefined): void;
    _citationCache?: {
        count: number;
        saveFailed?: boolean;
        lastError?: Error | null;
        flush?(): Promise<void>;
        retrySave?(): Promise<void>;
        onStatusChange?(listener: () => void): () => void;
        getFilePath(): string;
        getDirectoryPath(): string;
    };
};

/** Displays resolved paths, validates custom folders, and refreshes cache usage. */
export function setupCachePreferences(
    preview: CachePreferencesHost,
    doc: Document,
    listen: (target: EventTarget | null, type: string, handler: EventListener) => void
): () => void {
    const field = doc.getElementById('zotero-preview-cache-dir') as HTMLInputElement | null;
    const status = doc.getElementById('zotero-preview-cache-status');
    const stats = doc.getElementById('zotero-preview-cache-stats');
    const retryBtn = doc.getElementById('zotero-preview-cache-retry') as (HTMLElement & { disabled?: boolean }) | null;
    const message = (id: string) => status?.setAttribute('data-l10n-id', id);
    const refresh = () => {
        const cache = preview._citationCache;
        const failed = !!(cache?.saveFailed || cache?.lastError);
        const historyEnabled = preview.pref('lookupEnabled') !== false && preview.pref('lookupHistoryEnabled') !== false;
        if (field) {
            field.value = cache?.getFilePath() || '';
            field.placeholder = cache?.getDirectoryPath() || '';
        }
        if (failed) {
            message('zotero-preview-cache-save-failed');
        }
        if (retryBtn) {
            retryBtn.disabled = !historyEnabled || !failed;
        }
        if (stats) {
            stats.setAttribute('data-l10n-id', 'zotero-preview-cache-usage');
            stats.setAttribute('data-l10n-args', JSON.stringify({
                count: cache?.count || 0, limit: Number(preview.pref('cacheMaxEntries') || 2000)
            }));
        }
    };
    let applying = false;
    const applyDirectory = async (value: string) => {
        if (applying) return;
        applying = true;
        try {
            let path = value.trim();
            if (/\.json$/i.test(path)) {
                if (!/(?:^|[\\/])viewflow-history\.json$/i.test(path)) throw new Error('Unsupported cache filename');
                const parent = PathUtils.parent(path);
                if (!parent) throw new Error('Parent directory required');
                path = parent;
            }
            if (path && !PathUtils.isAbsolute(path)) throw new Error('Absolute path required');
            if (path) {
                await IOUtils.makeDirectory(path, {ignoreExisting: true});
                const probe = PathUtils.join(path, '.viewflow-write-check-' + Date.now());
                await IOUtils.writeUTF8(probe, '');
                await IOUtils.remove(probe);
            }
            preview.setPref(preview._prefPrefix + 'cacheDirectory', path);
            message('zotero-preview-cache-path-saved');
        } catch {
            message('zotero-preview-cache-path-failed');
        } finally {
            applying = false;
            refresh();
        }
    };
    listen(field, 'change', () => { void applyDirectory(field?.value || ''); });
    listen(doc.getElementById('zotero-preview-cache-default'), 'command', () => { void applyDirectory(''); });
    listen(doc.getElementById('zotero-preview-cache-browse'), 'command', async () => {
        try {
            type Picker = { init(win: Window, title: string, mode: number): void;
                modeGetFolder: number; returnOK: number; file: string; show(): Promise<number> };
            const module = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs') as {FilePicker: new () => Picker};
            const picker = new module.FilePicker();
            const localized = await (doc as Document & {l10n?: {formatValue(id: string): Promise<string>}})
                .l10n?.formatValue('zotero-preview-cache-choose');
            picker.init(doc.defaultView!, localized || 'ViewFlow', picker.modeGetFolder);
            if (await picker.show() === picker.returnOK) await applyDirectory(picker.file);
        } catch { message('zotero-preview-cache-path-failed'); }
    });
    listen(doc.getElementById('zotero-preview-cache-recommend'), 'command', () => {
        preview.setPref(preview._prefPrefix + 'cacheMaxEntries', 2000);
        preview.setPref(preview._prefPrefix + 'cacheTtlDays', 90);
        for (const [id, value] of [['zotero-preview-cache-quota', '2000'], ['zotero-preview-cache-ttl', '90']]) {
            const input = doc.getElementById(id) as HTMLInputElement | null;
            if (input) input.value = value;
        }
        refresh();
    });
    listen(retryBtn, 'command', async () => {
        try {
            const cache = preview._citationCache;
            await (cache?.retrySave ? cache.retrySave() : cache?.flush?.());
            message('zotero-preview-cache-path-saved');
        } catch {
            message('zotero-preview-cache-save-failed');
        } finally {
            refresh();
        }
    });
    const unsubscribe = preview._citationCache?.onStatusChange?.(refresh);
    // Observe mutations from this pane after the preference bindings have run.
    listen(doc, 'change', refresh);
    listen(doc, 'command', refresh);
    refresh();
    return () => { unsubscribe?.(); };
}
