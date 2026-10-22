const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PROJECT_ID,validateTarget,validateEnvironment,parseCliJson}=require('../scripts/update-policy.cjs');
const root=path.resolve(__dirname,'..');
const base=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/app.json'))).expo;
const profiles=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/eas.json'))).build;
const binary={app:{id:PROJECT_ID},status:'FINISHED',platform:'ANDROID',buildProfile:'preview',appIdentifier:'app.nearhire.mobile.preview',updateChannel:{name:'preview'},runtime:{version:'native-runtime'}};
const channel={currentPage:{name:'preview',isPaused:false,updateBranches:[{id:'branch-id',name:'preview'}],branchMapping:JSON.stringify({data:[{branchId:'branch-id',branchMappingLogic:'true'}]})}};
test('EAS machine output tolerates progress notices and fails closed on missing JSON',()=>{
  assert.deepEqual(parseCliJson('Environment variables loaded.\n[1/2] progress\n{\n"hash":"native-runtime"\n}'),{hash:'native-runtime'});
  assert.deepEqual(parseCliJson('\u001b[32mDone\u001b[0m\n[{"group":"id"}]'),[{group:'id'}]);
  assert.throws(()=>parseCliJson('Environment variables loaded.\nNot authenticated'));
});
test('Release OTA keeps the existing project, fingerprint safety, packages and distinct channels',()=>{
  assert.equal(base.extra.eas.projectId,PROJECT_ID);
  assert.equal(base.updates.url,'https://u.expo.dev/'+PROJECT_ID);
  assert.equal(base.runtimeVersion.policy,'fingerprint');
  assert.equal(base.updates.checkAutomatically,'ON_LOAD');
  for(const name of ['preview','production']) {
    assert.equal(profiles[name].channel,name);
    assert.equal(profiles[name].environment || 'production',name);
    assert.equal(profiles[name].env.EXPO_PUBLIC_DEMO_MODE,'false');
    // Shared EAS release flags are checked by validateEnvironment before every publish.
  }
  assert.equal(profiles.development.developmentClient,true);
  assert.ok(base.plugins.includes('@maplibre/maplibre-react-native'));
});
test('OTA publication rejects incompatible native runtime, wrong project/package/channel and unready binary',()=>{
  assert.equal(validateTarget('preview',binary,{hash:'native-runtime'},channel),'native-runtime');
  assert.throws(()=>validateTarget('preview',binary,{hash:'new-native-runtime'},channel),/NATIVE_RUNTIME_CHANGED/);
  for(const change of [{status:'IN_PROGRESS'},{app:{id:'another-project'}},{appIdentifier:'app.nearhire.mobile'},
    {buildProfile:'development'},{updateChannel:{name:'production'}},{runtime:null}])
    assert.throws(()=>validateTarget('preview',{...binary,...change},{hash:'native-runtime'},channel));
  assert.throws(()=>validateTarget('preview',binary,{hash:'native-runtime'},{currentPage:{...channel.currentPage,isPaused:true}}));
  assert.throws(()=>validateTarget('preview',binary,{hash:'native-runtime'},{currentPage:{...channel.currentPage,updateBranches:[{id:'other',name:'production'}]}}));
});
test('Release environment rejects fixture modes, wrong backend and privileged client credentials',()=>{
  const env={APP_VARIANT:'preview',EXPO_PUBLIC_DEMO_MODE:'false',EXPO_PUBLIC_UI_PREVIEW:'false',EXPO_PUBLIC_PAYMENT_TEST_AUTH:'false',
    EXPO_PUBLIC_SUPABASE_URL:'https://mxsltkyebhboaglbspse.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fixture'};
  assert.doesNotThrow(()=>validateEnvironment('preview',env));
  for(const change of [{APP_VARIANT:'production'},{EXPO_PUBLIC_UI_PREVIEW:'true'},{EXPO_PUBLIC_PAYMENT_TEST_AUTH:'true'},
    {EXPO_PUBLIC_SUPABASE_URL:'https://wrong.example'},{EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_fixture'},
    {EXPO_PUBLIC_FIREBASE_PRIVATE_KEY:'fixture-private-value'}]) assert.throws(()=>validateEnvironment('preview',{...env,...change}));
});
test('Production publisher fails closed in CI before touching EAS',()=>{
  const {spawnSync}=require('node:child_process');
  const r=spawnSync(process.execPath,[path.join(root,'scripts/publish-update.cjs'),'--channel','production','--confirm-production'],
    {encoding:'utf8',env:{...process.env,CI:'true'}});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/CI production publishing is disabled/);
});
