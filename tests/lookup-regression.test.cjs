const {test}=require('node:test');
const assert=require('node:assert/strict');
test('lookup rejects DOI prefixes, arXiv prefixes, missing end pages, deleted items and adjacent journal series', async()=>{
 const {verifyAndFilterCandidates,isJournalMatch,parseCompactCitation}=await import('../src/citation-lookup.ts');
 const make=fields=>({isRegularItem:()=>true,getField:key=>fields[key]||''});
 assert.equal(verifyAndFilterCandidates([make({DOI:'10.1000/test2'})],{doi:'10.1000/test',journalText:'',year:0}).length,0);
 assert.equal(verifyAndFilterCandidates([make({extra:'arXiv:2403.09876 [cond-mat]'})],parseCompactCitation('2403.0987')).length,0);
 assert.equal(verifyAndFilterCandidates([make({extra:'arXiv:2403.09876 [cond-mat]'})],parseCompactCitation('arXiv:2403.0987')).length,0);
 assert.equal(verifyAndFilterCandidates([make({extra:'arXiv:2403.09876 [cond-mat]'})],parseCompactCitation('2403.09876')).length,1);
 assert.equal(verifyAndFilterCandidates([make({pages:'40',publicationTitle:'Nature'})],{journalText:'Nature',year:2024,firstPage:'40',lastPage:'47'}).length,0);
 assert.equal(verifyAndFilterCandidates([{...make({DOI:'10.1000/test'}),deleted:true}],{doi:'10.1000/test',journalText:'',year:0}).length,0);
 assert.equal(isJournalMatch('Phys. Rev. B','Physical Review B','Phys. Rev. B'),true);
 assert.equal(isJournalMatch('Phys. Rev. B','Physical Review B Materials','Phys. Rev. B Materials'),false);
});
test('copy history retains colliding sources and refuses single-result shortcut',async()=>{
 const {CitationCacheManager}=await import('../src/citation-cache.ts');
 const cache=new CitationCacheManager();
 const entry={text:'Nature, 2024, 628, 512-518',libraryID:1,itemKey:'AAAA',itemID:1,title:'A',style:'test'};
 cache.record(entry);cache.record({...entry,itemID:2,itemKey:'BBBB'});
 assert.equal(cache.count,2);
 assert.equal(cache.lookup(entry.text),null);
 assert.equal(cache.lookupAll(entry.text).length,2);
 await cache.clear();
 assert.equal(cache.lookupAll(entry.text).length,0);
});
test('lookup registration satisfies host required hooks and has a distinct packaged icon',async()=>{
 const {registerLookupSection}=await import('../src/lookup-section.ts');
 let options;
 globalThis.Zotero={ItemPaneManager:{registerSection(value){
  for(const key of ['paneID','pluginID','onRender','header','sidenav']) assert.ok(value[key],key);
  assert.equal(typeof value.onRender,'function');
  options=value;return 'lookup-id';
 }}};
 try{
  assert.equal(registerLookupSection({id:'test',rootURI:'file:///plugin/',_queuePosition(){}}),'lookup-id');
  let enabled=false;options.onRender({body:{closest:()=>null},setEnabled:value=>enabled=value});assert.equal(enabled,true);
  assert.equal(options.sidenav.icon,'file:///plugin/lookup.svg');
  const fs=require('node:fs'),path=require('node:path');
  const root=path.join(__dirname,'..');
  assert.ok(fs.existsSync(path.join(root,'lookup.svg')));
  assert.match(fs.readFileSync(path.join(root,'scripts/build.ps1'),'utf8'),/'lookup.svg'/);
  assert.match(fs.readFileSync(path.join(root,'prefs.js'),'utf8'),/lookupEnabled", true/);
 } finally {delete globalThis.Zotero;}
});

test('lookup section falls back to getSelectedLibraryIDs when getSelectedLibraryID throws and surfaces recoverable cache write errors',async()=>{
 const {buildLookupSectionDOM}=await import('../src/lookup-section.ts');
 const {CitationCacheManager}=await import('../src/citation-cache.ts');
 const path=require('node:path');
 let searchCalls=0,lastLibraryID=null,failWrite=true;
 const written=new Map();
 globalThis.PathUtils={join:(...parts)=>path.join(...parts)};
 globalThis.IOUtils={
  exists:async(p)=>written.has(p),
  makeDirectory:async()=>{},
  writeUTF8:async(p,data)=>{if(failWrite)throw new Error('Disk full');written.set(p,data);},
  move:async(from,to)=>{written.set(to,written.get(from));written.delete(from);},
  remove:async(p)=>{written.delete(p);}
 };
 globalThis.Zotero={
  Libraries:{userLibraryID:1},
  debug(){},
  getMainWindow:()=>({ZoteroPane:{selectItem:async()=>true},document:{getElementById:()=>null}}),
  Search:class{
   constructor(opts){lastLibraryID=opts?.libraryID;}
   addCondition(){}
   async search(){searchCalls++;return [101];}
  },
  Items:{
   getAsync:async()=>[{
    id:101,deleted:false,isRegularItem:()=>true,
    getField:f=>({title:'Test Paper',publicationTitle:'Nature',year:'2024',volume:'628',pages:'512-518'}[f]||'')
   }]
  }
 };
 try{
  let doc;
  const makeEl=tag=>({
   tag,ownerDocument:doc,className:'',textContent:'',value:'',hidden:false,isConnected:true,children:[],attrs:{},
   setAttribute(k,v){this.attrs[k]=v;},
   removeAttribute(k){delete this.attrs[k];},
   appendChild(c){this.children.push(c);return c;},
   set innerHTML(_){this.children=[];this.textContent='';}
  });
  doc={
   defaultView:{
    ZoteroPane:{
     getSelectedLibraryID(){throw new Error('getSelectedLibraryID not supported in current view');},
     getSelectedLibraryIDs(){return [7];}
    }
   },
   createElementNS:(_,tag)=>makeEl(tag),
   createTextNode:text=>({textContent:text})
  };
  const body=makeEl('div');
  const cacheManager=new CitationCacheManager({customDir:'C:\\mock-cache'});
  buildLookupSectionDOM(doc,{cacheManager,stylesheetURI:'style.css',log(){},pref:()=>false},body);
  const container=body.children[1];
  const [input,btnRow,cacheNotice,statusDiv]=container.children;
  const searchBtn=btnRow.children[0];
  input.value='Nature, 2024, 628, 512-518';
  await searchBtn.onclick();
  assert.equal(searchCalls,1);
  assert.equal(lastLibraryID,7);
  assert.equal(statusDiv.children.length,1);

  cacheManager.record({text:'Nature, 2024, 628, 512-518',libraryID:7,itemKey:'K1',itemID:101,title:'Test Paper',style:'apa'});
  await assert.rejects(()=>cacheManager.flush(),/Disk full/);
  assert.equal(cacheManager.saveFailed,true);
  assert.equal(cacheNotice.hidden,false);
  assert.equal(cacheNotice.children[0].attrs['data-l10n-id'],'zotero-preview-cache-save-failed');

  failWrite=false;
  const retryBtn=cacheNotice.children[1];
  await retryBtn.onclick();
  assert.equal(cacheManager.saveFailed,false);
  assert.equal(cacheNotice.hidden,true);
  const previousSearches=searchCalls;
  input.onpaste();
  body.isConnected=false;
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(searchCalls,previousSearches,'detached pane must not start a pasted query');
  body.isConnected=true;
  input.onpaste();
  input.onkeydown({key:'Escape'});
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(searchCalls,previousSearches,'Escape cancels pending pasted query');
  input.value='Nature, 2024, 628, 512-518';
  let finish;
  const waiting=new Promise(resolve=>finish=resolve);
  globalThis.Zotero.Search.prototype.search=async()=>{searchCalls++;await waiting;return [101];};
  const pending=searchBtn.onclick();
  input.value='';
  input.oninput();
  assert.equal(statusDiv.children.length,0,'clearing input immediately removes all results');
  assert.equal(statusDiv.attrs['data-l10n-id'],undefined);
  finish();await pending;
  assert.equal(statusDiv.children.length,0,'late results cannot repopulate an empty input');
  const count=searchCalls;
  await searchBtn.onclick();
  assert.equal(searchCalls,count,'empty search does not query the library');
  assert.equal(statusDiv.children.length,0);
  await cacheManager.clear();
 } finally {
  delete globalThis.Zotero;
  delete globalThis.IOUtils;
  delete globalThis.PathUtils;
 }
});
