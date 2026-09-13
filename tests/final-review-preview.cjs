const {test}=require('node:test'), assert=require('node:assert/strict'), {chromium}=require('playwright');
const en=require('../apps/mobile/src/live/locales/en.json');
test('consumer review: hidden diagnostics, apply, withdraw, worker profile, acceptance and preserved repost history', {timeout:180000}, async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const p=await browser.newPage({viewport:{width:390,height:844}}); const writes=[];
  p.on('request',r=>{if(new URL(r.url()).hostname.endsWith('supabase.co')) writes.push(r.method());});
  await p.goto('http://localhost:8093'); const b=(name)=>p.getByRole('button',{name,exact:true});
  await b(en.find).click(); assert.equal(await p.getByText('DEV',{exact:true}).count(),0);
  const map=p.getByTestId('map-discovery-surface');await map.getByRole('button',{name:en.list,exact:true}).click();
  await map.getByRole('button',{name:en.viewJob,exact:true}).first().click();await b(en.apply).click();await b(en.submit).click();
  await p.getByText(en.pending,{exact:true}).last().waitFor();await b(en.withdraw).click();await p.getByText(en.withdrawn,{exact:true}).last().waitFor();
  await b(en.profile).last().click();await b(en.post).click();const workers=p.getByTestId('worker-discovery');
  await workers.getByRole('button',{name:en.list,exact:true}).click();await b(en.viewWorkerProfile).first().click();await p.getByText(en.notShared,{exact:false}).first().waitFor();await b(en.close).click();
  await b(en.myPosts).last().click();await b(en.repost).click();await p.getByText(en.reviewRepost,{exact:true}).waitFor();await b(en.publishJob).click();
  await b(en.profile).last().click();await b(en.profileCredits).click();await p.getByText('4 '+en.availableCredits,{exact:true}).waitFor();
  await b(en.myPosts).last().click();await b(en.expired).click();assert.equal(await b(en.repost).count(),1);
  await b(en.applicants).last().click();await b(en.accept).click();assert.equal(await b(en.accept).count(),0);await p.getByText(en.accepted,{exact:true}).waitFor();
  await b(en.myPosts).last().click();await b(en.start).click();await b(en.complete).click();
  for(const width of [360,390,412]) {await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await p.screenshot({path:'C:/Users/gnano/Documents/Codex/2026-09-06/referenced-chatgpt-conversation-this-is-an/work/final-review-posts.png'});
  assert.deepEqual(writes,[]);
 } finally {await browser.close();}
});
