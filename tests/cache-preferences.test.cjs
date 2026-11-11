const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path').win32;
test('cache preferences show resolved file and validate custom paths without losing previous value',async()=>{
 const {setupCachePreferences}=await import('../src/cache-preferences.ts');
 const ids=['zotero-preview-cache-dir','zotero-preview-cache-status','zotero-preview-cache-stats','zotero-preview-cache-default','zotero-preview-cache-browse','zotero-preview-cache-recommend','zotero-preview-cache-quota','zotero-preview-cache-ttl'];
 const nodes=new Map(ids.map(id=>[id,{value:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}}]));
 const handlers=new Map();
 const prefs={cacheMaxEntries:2000,cacheTtlDays:90,cacheDirectory:''};
 const dir=()=>prefs.cacheDirectory||'D:\\Library\\viewflow-cache';
 const host={_prefPrefix:'test.',pref:k=>prefs[k],setPref:(k,v)=>prefs[k.slice(5)]=v,_citationCache:{count:12,getDirectoryPath:dir,getFilePath:()=>path.join(dir(),'viewflow-history.json')}};
 globalThis.PathUtils={join:path.join,isAbsolute:path.isAbsolute,parent:path.dirname};
 const writes=[];
 globalThis.IOUtils={makeDirectory:async()=>{},writeUTF8:async(p)=>writes.push(p),remove:async()=>{}};
 try{
  setupCachePreferences(host,{getElementById:id=>nodes.get(id)},(target,type,fn)=>{if(target)handlers.set(target.value===undefined?type:[...nodes].find(([,n])=>n===target)?.[0]+type,fn);});
  assert.equal(nodes.get(ids[0]).value,'D:\\Library\\viewflow-cache\\viewflow-history.json');
  const field=nodes.get(ids[0]);
  field.value='relative';handlers.get(ids[0]+'change')();await new Promise(setImmediate);
  assert.equal(prefs.cacheDirectory,'');assert.equal(writes.length,0);
  assert.equal(nodes.get('zotero-preview-cache-status').attrs['data-l10n-id'],'zotero-preview-cache-path-failed');
  field.value='E:\\History';handlers.get(ids[0]+'change')();await new Promise(setImmediate);
  assert.equal(prefs.cacheDirectory,'E:\\History');
  assert.equal(nodes.get(ids[0]).value,'E:\\History\\viewflow-history.json');
  field.value='F:\\NewHistory\\viewflow-history.json';handlers.get(ids[0]+'change')();await new Promise(setImmediate);
  assert.equal(prefs.cacheDirectory,'F:\\NewHistory');
  prefs.cacheMaxEntries=9000;handlers.get('zotero-preview-cache-recommendcommand')();
  assert.equal(prefs.cacheMaxEntries,2000);
 }finally{delete globalThis.PathUtils;delete globalThis.IOUtils;}
});
