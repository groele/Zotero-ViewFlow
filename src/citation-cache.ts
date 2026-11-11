/**
 * Zotero ViewFlow - Local Citation Cache & Eviction Manager
 *
 * Manages persistent on-disk citation history for reverse lookup.
 * Enforces atomic safe writing, disk budget, TTL retention, and LRU+Hit eviction.
 */

export interface CitationRecord {
	key: string;            // Normalized citation string hash or raw text
	text: string;           // Visible plain text
	libraryID: number;      // Target library ID
	itemKey: string;        // Zotero Item Key
	itemID: number;         // Zotero Item ID
	title: string;          // Item Title
	style: string;          // CSL Style ID
	copiedAt: number;       // Timestamp when copied
	lastAccessedAt: number; // Timestamp when looked up
	hitCount: number;       // Number of reverse lookup hits
}

export interface CacheConfig {
	maxEntries: number;     // e.g. 2000
	ttlDays: number;        // e.g. 90
	customDir?: string;     // Custom directory if overridden
}

export class CitationCacheManager {
	private _records: Map<string, CitationRecord> = new Map();
	private _initialized = false;
	private _loading: Promise<void> = Promise.resolve();
	private _generation = 0;
	private _writing: Promise<void> = Promise.resolve();
	private _writeTimer: ReturnType<typeof setTimeout> | null = null;
	private _config: CacheConfig = { maxEntries: 2000, ttlDays: 90 };
	private _dirty = false;
	private _lastError: Error | null = null;
	private _statusListeners: Set<() => void> = new Set();

	constructor(config?: Partial<CacheConfig>) {
		if (config) this.configure(config);
	}

	get count(): number {
		return this._records.size;
	}

	get config(): Readonly<CacheConfig> {
		return this._config;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	get lastError(): Error | null {
		return this._lastError;
	}

	get saveFailed(): boolean {
		return this._lastError !== null;
	}

	onStatusChange(listener: () => void): () => void {
		this._statusListeners.add(listener);
		return () => this._statusListeners.delete(listener);
	}

	private _emitStatus(): void {
		for (const fn of this._statusListeners) {
			try { fn(); } catch (_) {}
		}
	}

	/**
	 * Updates cache configuration dynamically and enforces new capacity/TTL limits.
	 */
	configure(config: Partial<CacheConfig>): void {
		const prevDir = this._config.customDir || '';
		if (typeof config.maxEntries === 'number' && Number.isFinite(config.maxEntries) && config.maxEntries > 0) {
			this._config.maxEntries = Math.max(1, Math.floor(config.maxEntries));
		}
		if (typeof config.ttlDays === 'number' && Number.isFinite(config.ttlDays) && config.ttlDays > 0) {
			this._config.ttlDays = config.ttlDays;
		}
		if (config.customDir !== undefined) {
			this._config.customDir = config.customDir.trim() || undefined;
		}
		const now = Date.now();
		const ttlMs = this._config.ttlDays * 86400000;
		for (const [k, r] of this._records.entries()) {
			if (now - (r.lastAccessedAt || r.copiedAt) >= ttlMs) {
				this._records.delete(k);
			}
		}
		this._enforceEviction();
		if (this._initialized && (this._config.customDir || '') !== prevDir) {
			this._initialized = false;
			this.init().then(() => this.scheduleSave()).catch(() => {});
		} else if (this._initialized) {
			this.scheduleSave();
		}
	}

	/**
	 * Resolves the cache directory path. Defaults to [Zotero.DataDirectory]/viewflow-cache
	 */
	getDirectoryPath(): string {
		if (this._config.customDir) return this._config.customDir;
		if (typeof Zotero !== 'undefined' && Zotero.DataDirectory?.dir) {
			return PathUtils.join(Zotero.DataDirectory.dir, 'viewflow-cache');
		}
		return 'viewflow-cache';
	}

	getFilePath(): string {
		return PathUtils.join(this.getDirectoryPath(), 'viewflow-history.json');
	}

	/**
	 * Loads persistent cache from disk with corruption self-healing.
	 */
	init(): Promise<void> {
        if (this._initialized || typeof IOUtils === 'undefined') return this._loading;
        this._initialized = true;
        const generation = ++this._generation;
        const filePath = this.getFilePath();
        this._loading = this.load(filePath, generation);
        return this._loading;
    }

    private async load(filePath: string, generation: number): Promise<void> {
        try {
            if (typeof IOUtils === 'undefined') return;
            const legacyCandidates = [
                filePath.replace(/viewflow-history\.json$/, 'Zotero-citation-history.json'),
                filePath.replace(/viewflow-history\.json$/, 'citation-history.json')
            ];
            let activePath = filePath;
            let migrated = false;
            if (!await IOUtils.exists(filePath)) {
                for (const candidate of legacyCandidates) {
                    if (await IOUtils.exists(candidate)) {
                        activePath = candidate;
                        migrated = true;
                        break;
                    }
                }
                if (!migrated) return;
            }
            const data: unknown = JSON.parse(await IOUtils.readUTF8(activePath));
            if (generation !== this._generation || !Array.isArray(data)) return;
            const ttlMs = this._config.ttlDays * 86400000;
            for (const r of data as CitationRecord[]) {
                if (!r || typeof r.text !== 'string' || typeof r.itemKey !== 'string' ||
                    !Number.isFinite(r.libraryID) || !Number.isFinite(r.lastAccessedAt) ||
                    !Number.isFinite(r.hitCount) || Date.now() - r.lastAccessedAt >= ttlMs) continue;
                const key = this.recordKey(r);
                const current = this._records.get(key);
                if (!current || current.lastAccessedAt < r.lastAccessedAt) this._records.set(key, r);
            }
            this._enforceEviction();
            if (migrated) this.scheduleSave();
        } catch (error) {
            if (typeof Zotero !== 'undefined') Zotero.debug('[ViewFlow] Cache load failed: ' + error);
        }
    }

	/**
	 * Records a copied citation entry, queuing debounced atomic write.
	 */
	record(entry: Omit<CitationRecord, 'key' | 'copiedAt' | 'lastAccessedAt' | 'hitCount'>): void {
		const normKey = this.recordKey(entry);
		if (!normKey) return;

		const existing = this._records.get(normKey);

		const record: CitationRecord = {
			...entry,
			key: normKey,
			copiedAt: existing?.copiedAt || Date.now(),
			lastAccessedAt: Date.now(),
			hitCount: (existing?.hitCount || 0)
		};

		this._records.delete(normKey); // Re-insert at the end of Map for LRU
		this._records.set(normKey, record);
		this._dirty = true;

		this._enforceEviction();
		this.scheduleSave();
	}

	/**
	 * Looks up a record by text, updating hit count and recency.
	 */
	private recordKey(entry: { text: string; libraryID: number; itemKey: string }): string {
        return JSON.stringify([this.normalizeKey(entry.text), entry.libraryID, entry.itemKey]);
    }

    lookup(rawText: string): CitationRecord | null {
        const records = this.lookupAll(rawText);
        return records.length === 1 ? records[0] : null;
    }

    lookupAll(rawText: string): CitationRecord[] {
        const key = this.normalizeKey(rawText);
        const records = [...this._records.values()].filter(record =>
            key && this.normalizeKey(record.text) === key && record.itemKey &&
            Date.now() - record.lastAccessedAt < this._config.ttlDays * 86400000);
        for (const record of records) {
            record.lastAccessedAt = Date.now();
            record.hitCount++;
        }
        if (records.length) this.scheduleSave();
        return records;
    }

	normalizeKey(text: string): string {
		return text
			.trim()
			.replace(/^(?:\[\d+\]\s*|\(\d+\)\s*|\d{1,3}[.)]\s+|•\s*)/, '')
			.replace(/\.+$/, '')
			.replace(/[\u2010-\u2015\u2212]/g, '-')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase();
	}

	/**
	 * Enforces capacity budget using LRU + HitCount priority.
	 */
	private _enforceEviction(): void {
		if (this._records.size <= this._config.maxEntries) return;

		// Convert to array and sort: lowest score evicted first
		const entries = Array.from(this._records.values());
		entries.sort((a, b) => {
			const scoreA = a.lastAccessedAt + (a.hitCount * 86400000);
			const scoreB = b.lastAccessedAt + (b.hitCount * 86400000);
			return scoreA - scoreB;
		});

		const toRemove = entries.slice(0, entries.length - this._config.maxEntries);
		for (const r of toRemove) {
			this._records.delete(this.recordKey(r));
		}
	}

	scheduleSave(): void {
		if (this._writeTimer) clearTimeout(this._writeTimer);
		this._writeTimer = setTimeout(() => {
			this.flush().catch(err => {
				if (typeof Zotero !== 'undefined') Zotero.debug(`[ViewFlow] Flush error: ${err}`);
			});
		}, 1000);
	}

	/**
	 * Atomically flushes cache to disk. Rejects on disk write errors while keeping records in memory for retry.
	 */
	flush(): Promise<void> {
		const loading = this._loading;
		const run = this._writing.catch(() => {}).then(async () => {
			await loading;
			await this.writeSnapshot();
		});
		this._writing = run.catch(() => {});
		return run;
	}

	retrySave(): Promise<void> {
		return this.flush();
	}

	private async writeSnapshot(): Promise<void> {
		if (this._writeTimer) clearTimeout(this._writeTimer);
		this._writeTimer = null;
		if (typeof IOUtils === 'undefined') {
			this._dirty = false;
			this._lastError = null;
			this._emitStatus();
			return;
		}
		try {
			const dirPath = this.getDirectoryPath();
			if (!(await IOUtils.exists(dirPath))) {
				await IOUtils.makeDirectory(dirPath, { ignoreExisting: true });
			}
			const filePath = PathUtils.join(dirPath, 'viewflow-history.json');
			const tmpPath = filePath + '.tmp';
			const data = Array.from(this._records.values());
			const json = JSON.stringify(data, null, 2);

			await IOUtils.writeUTF8(tmpPath, json, { tmpPath: tmpPath + '.bak' });
			await IOUtils.move(tmpPath, filePath, { noOverwrite: false });
			this._dirty = false;
			this._lastError = null;
			this._emitStatus();
		} catch (error) {
			this._dirty = true;
			this._lastError = error instanceof Error ? error : new Error(String(error));
			this._emitStatus();
			if (typeof Zotero !== 'undefined') {
				Zotero.debug(`[ViewFlow] Atomic cache write failed: ${error}`);
			}
			throw this._lastError;
		}
	}

	async clear(): Promise<void> {
		if (this._writeTimer) clearTimeout(this._writeTimer);
		this._writeTimer = null;
		this._generation++;
		await this._loading;
		this._records.clear();
		this._dirty = false;
		this._lastError = null;
		this._emitStatus();
		await this._writing;
		if (typeof IOUtils !== 'undefined') {
			try {
				const filePath = this.getFilePath();
				const paths = [
					filePath,
					filePath.replace(/viewflow-history\.json$/, 'Zotero-citation-history.json'),
					filePath.replace(/viewflow-history\.json$/, 'citation-history.json')
				];
				for (const path of paths) {
					if (await IOUtils.exists(path)) await IOUtils.remove(path);
				}
			} catch (_) {}
		}
	}
}
