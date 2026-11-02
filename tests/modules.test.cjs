const { test } = require('node:test');
const assert = require('node:assert/strict');

test('CacheManager: handles basic operations, LRU eviction and byte bounding', async () => {
	const { CacheManager } = await import('../src/cache.js');
	const cache = new CacheManager({ limit: 3, byteLimit: 1000, ttl: 50 });

	cache.put('a', { title: 'Paper A' }, [1]);
	cache.put('b', { title: 'Paper B' }, [2]);
	cache.put('c', { title: 'Paper C' }, [3]);

	assert.equal(cache.map.size, 3);
	assert.deepEqual(cache.get('a'), { title: 'Paper A' });

	// Adding 4th item should evict 'b' (since 'a' was touched most recently)
	cache.put('d', { title: 'Paper D' }, [4]);
	assert.equal(cache.map.size, 3);
	assert.equal(cache.map.has('b'), false);
	assert.ok(cache.map.has('a'));
	assert.ok(cache.map.has('c'));
	assert.ok(cache.map.has('d'));

	// Invalidate by item ID
	cache.invalidate(new Set([1]));
	assert.equal(cache.map.has('a'), false);

	// TTL expiration
	await new Promise(resolve => setTimeout(resolve, 60));
	assert.equal(cache.get('c'), null);
	assert.equal(cache.map.has('c'), false);

	// Clear
	cache.clear();
	assert.equal(cache.map.size, 0);
	assert.equal(cache.bytes, 0);
});

test('Position: resolvePosition falls back safely to header', async () => {
	const { resolvePosition } = await import('../src/position.js');
	assert.equal(resolvePosition('zotero-item-pane-header'), 'zotero-item-pane-header');
	assert.equal(resolvePosition('zotero-editpane-item-box'), 'zotero-editpane-item-box');
	assert.equal(resolvePosition('zotero-editpane-related'), 'zotero-editpane-related');
	assert.equal(resolvePosition('invalid'), 'zotero-item-pane-header');
	assert.equal(resolvePosition(undefined), 'zotero-item-pane-header');
});

test('Constants: parseNumber and createPreviewError work as expected', async () => {
	const { parseNumber, createPreviewError } = await import('../src/constants.js');
	assert.equal(parseNumber('1.5', 1, 0, 3), 1.5);
	assert.equal(parseNumber('5', 1, 0, 3), 3);
	assert.equal(parseNumber('-2', 1, 0, 3), 0);
	assert.equal(parseNumber('invalid', 1.2, 0, 3), 1.2);

	const err = createPreviewError('no-style', 'Style missing');
	assert.equal(err.previewCode, 'no-style');
	assert.equal(err.message, 'Style missing');
	assert.ok(err instanceof Error);
});

test('View: buildBlock constructs semantic markup with copy buttons', async () => {
	const { buildBlock } = await import('../src/view.js');
	const bibHtml = buildBlock('bibliography', { html: '<i>Smith 2020</i>' }, '<svg>icon</svg>');
	assert.match(bibHtml, /class="zotero-preview-block"/);
	assert.match(bibHtml, /data-copy-citation="false"/);
	assert.match(bibHtml, /<i>Smith 2020<\/i>/);

	const citeHtml = buildBlock('citation', { html: '(Smith, 2020)' }, '<svg>icon</svg>');
	assert.match(citeHtml, /data-copy-citation="true"/);
	assert.match(citeHtml, /\(Smith, 2020\)/);
});

test('CSL: normalizeItem resolves parents and prevents infinite loops', async () => {
	const { normalizeItem } = await import('../src/csl.js');
	globalThis.Zotero = {
		Items: {
			get: id => {
				if (id === 10) return { id: 10, isRegularItem: () => true };
				if (id === 20) return { id: 20, parentID: 10, isRegularItem: () => false };
				if (id === 30) return { id: 30, parentID: 40, isRegularItem: () => false };
				if (id === 40) return { id: 40, parentID: 30, isRegularItem: () => false }; // Cycle
				return null;
			}
		}
	};

	// Regular item
	const regular = { id: 1, isRegularItem: () => true };
	assert.equal(normalizeItem(regular), regular);

	// Attachment with regular parent
	const child = { id: 2, parentID: 10, isRegularItem: () => false };
	assert.equal(normalizeItem(child).id, 10);

	// Deleted item
	const deleted = { id: 3, deleted: true, isRegularItem: () => true };
	assert.equal(normalizeItem(deleted), null);

	// Cyclic attachment reference
	const cyclic = { id: 30, parentID: 40, isRegularItem: () => false };
	assert.equal(normalizeItem(cyclic), null);
});
