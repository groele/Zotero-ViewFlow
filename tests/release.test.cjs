const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,'');
const manifest=JSON.parse(read('manifest.json'));
const product=JSON.parse(read('docs/brand/product.json'));
const feed=JSON.parse(read('zotero-viewflow-updates.json'));
const update=feed.addons[manifest.applications.zotero.id].updates[0];
const isLocalCandidate=product.releaseStatus==='candidate'&&product.version===manifest.version;
test('manifest keeps an unpublished local candidate separate from the maintained update feed',()=>{
 assert.match(manifest.version,/^\d+\.\d+\.\d+$/);
 assert.equal(manifest.name,'Zotero ViewFlow');
 assert.equal(manifest.applications.zotero.id,'zotero-viewflow@groele');
 assert.equal(manifest.applications.zotero.strict_min_version,'8.0');
 assert.equal(manifest.applications.zotero.strict_max_version,'11.0.*');
 assert.deepEqual(manifest.icons,{'32':'view.svg','64':'view.svg'});
 assert.ok(fs.existsSync(path.join(root,'view.svg')));
 assert.ok(!feed.addons['zoteropreview@carter-tod.com']);
 if(isLocalCandidate)assert.notEqual(update.version,manifest.version);
 else assert.equal(update.version,manifest.version);
 assert.equal(manifest.applications.zotero.update_url,'https://raw.githubusercontent.com/groele/Zotero-ViewFlow/main/zotero-viewflow-updates.json');
 const publishedVersion=isLocalCandidate?update.version:manifest.version;
 assert.equal(update.update_link,`https://github.com/groele/Zotero-ViewFlow/releases/download/v${publishedVersion}/Zotero-ViewFlow-${publishedVersion}.xpi`);
 assert.deepEqual(update.applications.zotero,{strict_min_version:manifest.applications.zotero.strict_min_version,strict_max_version:manifest.applications.zotero.strict_max_version});
 assert.match(update.update_hash,/^sha256:[a-f0-9]{64}$/);
});

test('candidate installer builds without changing published metadata',()=>{
 const feedBefore=fs.readFileSync(path.join(root,'zotero-viewflow-updates.json'));
 const supplied=process.env.VIEWFLOW_XPI_PATH;
 const temporary=supplied ? null : fs.mkdtempSync(path.join(os.tmpdir(),'viewflow-release-test-'));
 const packagePath=supplied ? path.resolve(supplied) : path.join(temporary,`Zotero-ViewFlow-${manifest.version}.xpi`);
 try {
  if(supplied){
   assert.ok(fs.existsSync(packagePath),`Release artifact does not exist: ${packagePath}`);
  }
  const args=['-NoProfile','-File',path.join(root,'scripts/build.ps1'),'-OutputPath',packagePath];
  if(supplied)args.push('-VerifyOnly');
  const result=spawnSync('pwsh',args,{cwd:root,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.ok(fs.statSync(packagePath).size>0);
  const bytes=fs.readFileSync(packagePath);
  if(!isLocalCandidate)assert.equal(update.update_hash,'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),'Installer checksum differs from the maintained feed; prepare a release explicitly with build.ps1 -UpdateFeed');
  assert.deepEqual(fs.readFileSync(path.join(root,'zotero-viewflow-updates.json')),feedBefore,'Test builds must not rewrite the published update feed');
 } finally {
  if(temporary){
   const resolved=path.resolve(temporary);
   assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
   assert.ok(path.basename(resolved).startsWith('viewflow-release-test-'));
   fs.rmSync(resolved,{recursive:true,force:true});
  }
 }
});
test('all Fluent resources provide the ViewFlow pane branding',()=>{
 for(const locale of fs.readdirSync(path.join(root,'locale')))assert.match(read(`locale/${locale}/zotero-preview.ftl`),/\.label = Zotero ViewFlow/);
});
test('all Fluent resources provide unique required runtime and copy messages',()=>{
 for(const locale of fs.readdirSync(path.join(root,'locale'))){
  const text=read(`locale/${locale}/zotero-preview.ftl`);
  const keys=[...text.matchAll(/^([a-z][\w-]*)\s*=/gm)].map(m=>m[1]);
  assert.equal(keys.length,new Set(keys).size,locale);
  for(const key of ['zotero-preview-pane-title','zotero-preview-loading','zotero-preview-native-position','zotero-preview-copy-bibliography','zotero-preview-copy-citation','zotero-preview-truncated',
   'zotero-preview-retry','zotero-preview-style-missing','zotero-preview-settings-missing-style',
   ...[...read('prefs.xhtml').matchAll(/data-l10n-id="([^"]+)"/g)].map(m=>m[1])])assert.ok(keys.includes(key),`${locale}: ${key}`);
 }
});
