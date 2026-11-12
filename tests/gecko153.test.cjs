const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('preferences wait for style loading, initialize once, and clean up captured listeners', async () => {
 const nodes = new Map(), handlers = new Map(), values = new Map([['citationstyle','missing-style']]);
 const target = id => ({ id, value: '', isConnected: true, attributes:{},children:[],
  addEventListener(type, fn, options) { handlers.set(`${id}:${type}`, {fn, capture: options.capture}); options.signal.addEventListener('abort', () => handlers.delete(`${id}:${type}`), {once:true}); },
  removeEventListener(type) { handlers.delete(`${id}:${type}`); },
  setAttribute(key,value) {this.attributes[key]=value;}, appendChild(node) {this.children.push(node);}, replaceChildren() {this.children=[];} });
 const doc = Object.assign(target('document'), {
  getElementById: id => nodes.get(id),
  querySelector: () => nodes.get('popup'), createXULElement: () => target('entry')
 });
 const win = target('window');
 const preview = { initialized: true, _prefPrefix: 'extensions.zoteropreview.',
  _prefPaneCleanups: new Set(), pref: name => values.get(name), getPosition: () => 'zotero-item-pane-header',
  setPref: (key, value) => values.set(key.replace('extensions.zoteropreview.', ''), value),
  _queueAllPreviews: () => { values.set('refreshed', true); } };
 let resolveStyles, stylesLoaded = false;
 const stylesReady = new Promise(resolve => { resolveStyles = resolve; });
 const context = vm.createContext({ document: doc, window: win, AbortController,
  Zotero: { zoteropreview: preview, Styles: { init: () => stylesReady, getVisible: () => {
   assert.equal(stylesLoaded, true, 'must not read an unloaded style cache');
   return [{styleID:'style',title:'Style'}];
  } } } });
 // Gecko 153 freezes sandbox built-ins; the script must not monkey-patch them.
 vm.runInContext('Object.freeze(Array.prototype); Object.freeze(JSON); Object.freeze(Promise);', context);
 vm.runInContext(read('zoteropreview_prefs.js'), context);
 assert.equal(handlers.size, 3);
 assert.equal(handlers.get('document:load').capture, true);
 for (const id of ['zotero-prefpane-zotero-preview', 'popup', 'zotero-preview-style-menulist',
  'extensions-zoteropreview-position', 'extensions-zoteropreview-whatToShow',
  'zotero-preview-fontsize', 'zotero-preview-spacing', 'zotero-preview-max-items',
  'extensions-zoteropreview-debug', 'zotero-preview-clear-cache-btn']) nodes.set(id, target(id));
 const load = handlers.get('document:load').fn;
 load({target:{id:'other-plugin'}}); assert.equal(handlers.size, 3);
 load({target:nodes.get('zotero-prefpane-zotero-preview')});
 assert.equal(handlers.size, 3, 'control listeners must wait for the style cache');
 load({target:nodes.get('zotero-prefpane-zotero-preview')});
 stylesLoaded = true; resolveStyles();
 await new Promise(setImmediate);
 assert.equal(nodes.get('zotero-preview-style-menulist').value,'missing-style');
 const missing=nodes.get('popup').children.find(n=>n.attributes.value==='missing-style');
 assert.equal(missing.attributes['data-l10n-id'],'zotero-preview-settings-missing-style');
 assert.equal(values.get('citationstyle'),'missing-style','must preserve the saved style without silently switching to Quick Copy');
 const count = handlers.size;
 load({target:nodes.get('zotero-prefpane-zotero-preview')}); assert.equal(handlers.size, count);
 const menu = nodes.get('zotero-preview-style-menulist'); menu.value = 'new-style';
 handlers.get(`${menu.id}:command`).fn(); assert.equal(values.get('citationstyle'), 'new-style');
 const debug = nodes.get('extensions-zoteropreview-debug'); debug.checked = true;
 handlers.get(`${debug.id}:command`).fn(); assert.equal(values.get('debug'), true);
 const clearBtn = nodes.get('zotero-preview-clear-cache-btn');
 handlers.get(`${clearBtn.id}:command`).fn(); assert.equal(values.get('refreshed'), true);
 handlers.get('document:unload').fn({target:nodes.get('zotero-prefpane-zotero-preview')});
 assert.equal(handlers.size, 0); assert.equal(preview._prefPaneCleanups.size, 0);
});

test('closing preferences while styles load prevents late DOM access and listeners', async () => {
 const handlers = new Map(); let resolveStyles, domReads = 0;
 const root = { id: 'zotero-prefpane-zotero-preview', isConnected: true };
 const target = id => ({ addEventListener(type, fn, options) { handlers.set(id + ':' + type, fn); options.signal.addEventListener('abort', () => handlers.delete(id + ':' + type), {once:true}); },
  removeEventListener(type) { handlers.delete(id + ':' + type); } });
 const doc = Object.assign(target('document'), { getElementById: () => root,
  querySelector() { domReads++; throw new Error('closed preference document accessed'); } });
 const preview = { initialized: true, _prefPaneCleanups: new Set() };
 const context = vm.createContext({ document: doc, window: target('window'), AbortController,
  Zotero: { zoteropreview: preview, Styles: { init: () => new Promise(resolve => { resolveStyles = resolve; }) },
   logError(error) { throw error; } } });
 vm.runInContext(read('zoteropreview_prefs.js'), context);
 handlers.get('window:unload')();
 root.isConnected = false; resolveStyles();
 await new Promise(setImmediate);
 assert.equal(domReads, 0); assert.equal(handlers.size, 0);
 assert.equal(preview._prefPaneCleanups.size, 0);
});

test('shutdown during initialization prevents late startup in a frozen sandbox', async () => {
 let resolve, loaded = 0;
 const context = vm.createContext({ Zotero: {initializationPromise: new Promise(r => resolve = r)},
  Services: {scriptloader: {loadSubScript() { loaded++; }}} });
 vm.runInContext('Object.freeze(Array.prototype); Object.freeze(JSON); Object.freeze(Promise);', context);
 vm.runInContext(read('bootstrap.js'), context);
 const pending = context.startup({id:'test',version:'test',rootURI:'test/'});
 context.shutdown(); resolve(); await pending;
 assert.equal(loaded, 0);
});

test('partial startup failure removes Fluent resources even if plugin cleanup throws', async () => {
 const errors = [], removed = [];
 const context = vm.createContext({ Zotero: {
  initializationPromise: Promise.resolve(), logError: e => errors.push(e.message),
  ftl: {addResourceIds() {}, removeResourceIds: ids => removed.push(...ids)},
  PreferencePanes: {register: () => {throw Error('host registration failed');}}
 }, Services: {scriptloader: {loadSubScript() {
  context.Zotero.zoteropreview = {init() {}, shutdown() {throw Error('cleanup failed');}};
 }}} });
 vm.runInContext(read('bootstrap.js'), context);
 await assert.rejects(context.startup({id:'test',version:'test',rootURI:'test/'}), /host registration failed/);
 assert.deepEqual(removed, ['zotero-preview.ftl']);
 assert.deepEqual(errors, ['cleanup failed']);
 assert.equal(context.Zotero.zoteropreview, undefined);
});

test('Gecko 153 audit excludes inline handlers and obsolete platform patterns', () => {
 const markup = read('prefs.xhtml');
 assert.doesNotMatch(markup, /\son\w+\s*=/i);
 assert.doesNotMatch(markup, /\b(?:hidden|collapsed|disabled|checked|selected|remote)="false"/);
 for (const file of ['bootstrap.js', 'zoteropreview.js', 'zoteropreview_prefs.js', 'style.css']) {
  assert.doesNotMatch(read(file), /\.ownerGlobal\b|CheckboxStateChange|\.oncommand\s*=|\[(?:hidden|collapsed|disabled|checked|selected)="true"\]/);
 }
 assert.match(read('bootstrap.js'), /defaultXUL:\s*true/);
});


test('shutdown invalidates script and string caches on disable', async () => {
 const calls = [];
 const context = vm.createContext({APP_SHUTDOWN: 1, ADDON_DISABLE: 2,
  Cu: {unload: uri => calls.push(['unload', uri])},
  Ci: {nsIStringBundleService: {}},
  Cc: {'@mozilla.org/intl/stringbundle;1': {getService: () => ({flushBundles: () => calls.push(['flush'])})}},
  Zotero: {initializationPromise: Promise.resolve(), PreferencePanes: {register() {}}},
  Services: {scriptloader: {loadSubScript() {context.Zotero.zoteropreview = {init(){}, start(){}, shutdown(){}};}},
    obs: {notifyObservers: (_subject, topic) => calls.push(['notify', topic])}}
 });
 vm.runInContext(read('bootstrap.js'), context);
 await context.startup({id:'test', version:'1', rootURI:'test/'});
 context.shutdown({}, 2);
 assert.deepEqual(calls, [['unload','test/zoteropreview.js'],['flush'],['notify','startupcache-invalidate']]);
});

test('preferences sync runtime version, observe lookup/cache dependencies, and restore defaults cleanly', async () => {
 const nodes = new Map(), handlers = new Map(), prefObservers = new Map(), values = new Map([
  ['citationstyle', 'apa'],
  ['position', 'zotero-editpane-related'],
  ['whatToShow', 'zpintext'],
  ['fontsize', '1.2'],
  ['spacing', '1.8'],
  ['debug', true],
  ['maxPreviewItems', 50],
  ['lookupEnabled', true],
  ['lookupHistoryEnabled', true],
  ['cacheMaxEntries', 500],
  ['cacheTtlDays', 30]
 ]);
 const target = id => ({ id, value: '', textContent: '', checked: false, disabled: false, isConnected: true, attributes: {}, children: [],
  addEventListener(type, fn, options) { handlers.set(`${id}:${type}`, fn); options.signal.addEventListener('abort', () => handlers.delete(`${id}:${type}`), {once: true}); },
  removeEventListener(type) { handlers.delete(`${id}:${type}`); },
  setAttribute(key, value) { this.attributes[key] = value; }, appendChild(node) { this.children.push(node); }, replaceChildren() { this.children = []; } });
 const doc = Object.assign(target('document'), {
  getElementById: id => nodes.get(id),
  querySelector: () => nodes.get('popup'), createXULElement: () => target('entry')
 });
 const win = target('window');
 let nextObs = 0, refreshed = 0;
 const preview = {
  initialized: true, version: '16.3.1', _prefPrefix: 'extensions.zoteropreview.',
  _prefPaneCleanups: new Set(), _citationCache: { saveFailed: true, count: 0, getFilePath: () => '/mock/viewflow-history.json', getDirectoryPath: () => '/mock' },
  pref: name => values.get(name), getPosition: () => String(values.get('position') || 'zotero-item-pane-header'),
  setPref: (key, value) => values.set(key.replace('extensions.zoteropreview.', ''), value),
  _queueAllPreviews: () => { refreshed++; }
 };
 const context = vm.createContext({
  document: doc, window: win, AbortController, setTimeout, clearTimeout,
  Zotero: {
   zoteropreview: preview,
   logError(error) { throw error; },
   Styles: { init: () => Promise.resolve(), getVisible: () => [{styleID: 'apa', title: 'APA'}] },
   Prefs: {
    registerObserver(key, cb) { const id = ++nextObs; prefObservers.set(id, {key, cb}); return id; },
    unregisterObserver(id) { prefObservers.delete(id); }
   }
  }
 });
 for (const id of [
  'zotero-prefpane-zotero-preview', 'popup', 'zotero-preview-style-menulist',
  'extensions-zoteropreview-position', 'extensions-zoteropreview-whatToShow',
  'zotero-preview-fontsize', 'zotero-preview-spacing', 'zotero-preview-max-items',
  'extensions-zoteropreview-debug', 'zotero-preview-clear-cache-btn',
  'extensions-zoteropreview-lookupEnabled', 'extensions-zoteropreview-lookupHistoryEnabled',
  'zotero-preview-cache-dir', 'zotero-preview-cache-browse', 'zotero-preview-cache-default',
  'zotero-preview-cache-recommend', 'zotero-preview-cache-quota', 'zotero-preview-cache-ttl',
  'zotero-preview-clear-history-btn', 'zotero-preview-cache-retry', 'zotero-preview-reset-defaults-btn',
  'viewflow-version-badge', 'viewflow-release-download-link'
 ]) nodes.set(id, target(id));
 vm.runInContext(read('zoteropreview_prefs.js'), context);
 handlers.get('document:load')({ target: nodes.get('zotero-prefpane-zotero-preview') });
 await new Promise(setImmediate);

 assert.equal(nodes.get('viewflow-version-badge').textContent, 'v16.3.1');
 assert.equal(nodes.get('viewflow-version-badge').attributes['data-l10n-args'], '{"version":"16.3.1"}');
 assert.equal(nodes.get('viewflow-release-download-link').attributes.href, 'https://github.com/groele/Zotero-ViewFlow/releases/download/v16.3.1/Zotero-ViewFlow-16.3.1.xpi');
 assert.equal(nodes.get('zotero-preview-cache-retry').disabled, false);

 // External pref change disables history + retry controls
 values.set('lookupHistoryEnabled', false);
 for (const obs of prefObservers.values()) {
  if (obs.key.endsWith('lookupHistoryEnabled')) obs.cb();
 }
 assert.equal(nodes.get('zotero-preview-cache-quota').disabled, true);
 assert.equal(nodes.get('zotero-preview-cache-retry').disabled, true);

 // Reset defaults restores all prefs, re-enables dependencies, and refreshes previews
 handlers.get('zotero-preview-reset-defaults-btn:command')();
 assert.equal(values.get('citationstyle'), '');
 assert.equal(values.get('position'), 'zotero-item-pane-header');
 assert.equal(values.get('lookupEnabled'), true);
 assert.equal(values.get('lookupHistoryEnabled'), true);
 assert.equal(values.get('cacheMaxEntries'), 2000);
 assert.equal(nodes.get('zotero-preview-cache-quota').disabled, false);
 assert.equal(nodes.get('zotero-preview-cache-retry').disabled, false);
 assert.equal(refreshed, 1);

 handlers.get('document:unload')({ target: nodes.get('zotero-prefpane-zotero-preview') });
 assert.equal(prefObservers.size, 0);
 assert.equal(preview._prefPaneCleanups.size, 0);
});
