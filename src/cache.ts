import { CACHE_LIMIT, CACHE_BYTE_LIMIT, CACHE_TTL } from './constants.ts';

type CacheEntry = { payload: unknown; ids: number[]; bytes: number; created: number };

/**
 * LRU cache manager with entry count limit, byte budget, and TTL expiration.
 */
export class CacheManager {
	limit: number;
	byteLimit: number;
	ttl: number;
	map: Map<string, CacheEntry>;
	bytes: number;
	constructor({ limit = CACHE_LIMIT, byteLimit = CACHE_BYTE_LIMIT, ttl = CACHE_TTL }: { limit?: number; byteLimit?: number; ttl?: number } = {}) {
		this.limit = limit;
		this.byteLimit = byteLimit;
		this.ttl = ttl;
		this.map = new Map();
		this.bytes = 0;
	}

	/**
	 * Retrieve payload by key if not expired.
	 * Touches the entry for LRU reordering.
	 */
	get(key: string) {
		const entry = this.map.get(key);
		if (!entry) return null;
		if (Date.now() - entry.created > this.ttl) {
			this.delete(key);
			return null;
		}
		this.map.delete(key);
		this.map.set(key, entry);
		return entry.payload;
	}

	/**
	 * Insert a payload into cache with item IDs.
	 * Evicts oldest entries if limit or byteLimit exceeded.
	 */
	put(key: string, payload: unknown, ids: number[]) {
		const bytes = JSON.stringify(payload).length * 2;
		if (bytes > this.byteLimit) return false;
		this.delete(key);
		while (
			this.map.size &&
			(this.map.size >= this.limit || this.bytes + bytes > this.byteLimit)
		) {
			const oldest = this.map.keys().next().value;
			if (oldest === undefined) break;
			this.delete(oldest);
		}
		this.map.set(key, { payload, ids, bytes, created: Date.now() });
		this.bytes += bytes;
		return true;
	}

	/**
	 * Delete entry by key and update byte accounting.
	 */
	delete(key: string) {
		const entry = this.map.get(key);
		if (!entry) return;
		this.bytes -= entry.bytes || 0;
		this.map.delete(key);
	}

	/**
	 * Clear all entries and reset byte counter.
	 */
	clear() {
		this.map.clear();
		this.bytes = 0;
	}

	/**
	 * Invalidate entries referencing specific item IDs, or all if changedIds is null.
	 */
	invalidate(changedIds: Set<number> | null) {
		for (const [key, entry] of this.map) {
			if (!changedIds || entry.ids.some(id => changedIds.has(id))) {
				this.delete(key);
			}
		}
	}
}
