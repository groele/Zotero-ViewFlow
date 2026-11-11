const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('Citation Cache: handles in-memory and disk persistence with LRU+Hit eviction', async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewflow-cache-test-'));

	// Mock Gecko XPCOM IOUtils and PathUtils for Node environment
	globalThis.PathUtils = {
		join: (...parts) => path.join(...parts)
	};
	globalThis.IOUtils = {
		exists: async (p) => fs.existsSync(p),
		makeDirectory: async (p) => fs.mkdirSync(p, { recursive: true }),
		readUTF8: async (p) => fs.readFileSync(p, 'utf8'),
		writeUTF8: async (p, content) => fs.writeFileSync(p, content, 'utf8'),
		move: async (from, to) => fs.renameSync(from, to),
		remove: async (p) => fs.unlinkSync(p)
	};

	try {
		const { CitationCacheManager } = await import('../src/citation-cache.ts');
		const manager = new CitationCacheManager({
			customDir: tempDir,
			maxEntries: 3,
			ttlDays: 1
		});

		// Record 3 entries
		manager.record({ text: 'Citation 1', libraryID: 1, itemKey: 'K1', itemID: 101, title: 'Title 1', style: 'apa' });
		manager.record({ text: 'Citation 2', libraryID: 1, itemKey: 'K2', itemID: 102, title: 'Title 2', style: 'apa' });
		manager.record({ text: 'Citation 3', libraryID: 1, itemKey: 'K3', itemID: 103, title: 'Title 3', style: 'apa' });

		assert.equal(manager.count, 3);
		assert.equal(manager.lookup('Citation 1')?.itemID, 101);

		// Record hits: lookup increments hitCount
		manager.lookup('Citation 1');
		assert.equal(manager.lookup('Citation 1')?.hitCount, 3);

		// Adding 4th entry triggers LRU/Hit eviction: Citation 2 should be evicted first
		manager.record({ text: 'Citation 4', libraryID: 1, itemKey: 'K4', itemID: 104, title: 'Title 4', style: 'apa' });
		assert.equal(manager.count, 3);
		assert.equal(manager.lookup('Citation 2'), null);
		assert.ok(manager.lookup('Citation 1'));
		assert.ok(manager.lookup('Citation 3'));
		assert.ok(manager.lookup('Citation 4'));

		// Persist to disk
		await manager.flush();
		const cacheFile = path.join(tempDir, 'Zotero-citation-history.json');
		assert.ok(fs.existsSync(cacheFile));

		const diskData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
		assert.equal(diskData.length, 3);

		// Re-initialize from disk
		const manager2 = new CitationCacheManager({
			customDir: tempDir,
			maxEntries: 10,
			ttlDays: 30
		});
		await manager2.init();
		assert.equal(manager2.count, 3);
		assert.equal(manager2.lookup('Citation 1')?.itemID, 101);

		// Clear cache
		await manager2.clear();
		assert.equal(manager2.count, 0);
		assert.equal(fs.existsSync(cacheFile), false);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
});

test('Citation Cache: evicts expired entries based on TTL', async () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewflow-cache-ttl-'));

	try {
		const { CitationCacheManager } = await import('../src/citation-cache.ts');
		const manager = new CitationCacheManager({
			customDir: tempDir,
			maxEntries: 10,
			ttlDays: 1 / 86400 // 1 second TTL
		});

		manager.record({ text: 'Citation 1', libraryID: 1, itemKey: 'K1', itemID: 101, title: 'Title 1', style: 'apa' });
		assert.equal(manager.count, 1);

		// Wait 1.1s and re-init from disk to trigger TTL purge
		await manager.flush();
		await new Promise(resolve => setTimeout(resolve, 1100));

		const manager2 = new CitationCacheManager({
			customDir: tempDir,
			maxEntries: 10,
			ttlDays: 1 / 86400
		});
		await manager2.init();
		assert.equal(manager2.count, 0);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
});

test('Citation Cache: dynamic configure() enforces updated quota and normalizeKey strips list prefixes', async () => {
	const { CitationCacheManager } = await import('../src/citation-cache.ts');
	const manager = new CitationCacheManager({ maxEntries: 5, ttlDays: 90 });

	manager.record({ text: 'Curr. Appl Phys., 2027, 94, 40–47.', libraryID: 1, itemKey: 'K1', itemID: 101, title: 'Title 1', style: 'apa' });
	manager.record({ text: 'Phys. Rev. B 105 (2022) 125101', libraryID: 1, itemKey: 'K2', itemID: 102, title: 'Title 2', style: 'apa' });
	manager.record({ text: 'Nature, 2024, 628, 512-518', libraryID: 1, itemKey: 'K3', itemID: 103, title: 'Title 3', style: 'apa' });

	// Lookup with leading [1] and regular hyphen matches recorded en-dash entry
	const hit = manager.lookup('[1] Curr. Appl Phys., 2027, 94, 40-47');
	assert.ok(hit);
	assert.equal(hit.itemID, 101);

	// Dynamically shrink maxEntries to 2 -> lowest scored entry should be evicted immediately
	manager.configure({ maxEntries: 2 });
	assert.equal(manager.count, 2);
	assert.ok(manager.lookup('Curr. Appl Phys., 2027, 94, 40-47'));
	await manager.clear();
});
test('cache directory switch merges destination records and persists reduced quota', async()=>{
 const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'viewflow-switch-'));
 try {
  const {CitationCacheManager}=await import('../src/citation-cache.ts');
  const source=path.join(tempDir,'a'),destination=path.join(tempDir,'b');
  const first=new CitationCacheManager({customDir:source,maxEntries:10});
  await first.init();
  first.record({text:'one',libraryID:1,itemKey:'ONE',itemID:1,title:'One',style:'test'});
  await first.flush();
  fs.mkdirSync(destination,{recursive:true});
  const record={key:'old-format',text:'two',libraryID:1,itemKey:'TWO',itemID:2,title:'Two',style:'test',copiedAt:Date.now(),lastAccessedAt:Date.now(),hitCount:0};
  fs.writeFileSync(path.join(destination,'citation-history.json'),JSON.stringify([record]));
  first.configure({customDir:destination});
  await first.flush();
  assert.equal(first.count,2);
  assert.equal(fs.existsSync(path.join(destination,'citation-history.json')),true);
  assert.equal(fs.existsSync(path.join(destination,'Zotero-citation-history.json')),true);
  assert.equal(fs.existsSync(path.join(source,'Zotero-citation-history.json')),true);
  assert.equal(JSON.parse(fs.readFileSync(first.getFilePath(),'utf8')).length,2);
  first.configure({maxEntries:1});
  await first.flush();
  const reopened=new CitationCacheManager({customDir:destination,maxEntries:10});
  await reopened.init();assert.equal(reopened.count,1);
  await first.clear();
  const cleared=new CitationCacheManager({customDir:destination});await cleared.init();assert.equal(cleared.count,0);
 } finally {fs.rmSync(tempDir,{recursive:true,force:true});}
});
