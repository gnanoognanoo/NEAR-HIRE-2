const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const en=require('../apps/mobile/src/live/locales/en.json'),ta=require('../apps/mobile/src/live/locales/ta.json');
test('bilingual package selection calculates savings and never fakes settlement',{timeout:120000},async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:390,height:844}});const requests=[];p.on('request',r=>{if(/supabase.co|api.razorpay.com/.test(new URL(r.url()).hostname))requests.push(r.method());});await p.goto('http://localhost:8093');
 const b=n=>p.getByRole('button',{name:n,exact:true});await b(en.find).click();
 for(const [language,d]of [['English',en],['தமிழ்',ta]]){
  await b(en.profile).last().click();await b(en.settings).click();await b(language).click();await b(d.profile).last().click();await b(d.profileCredits).click();
  for(const amount of ['₹9','₹39','₹69']) await p.getByText(amount,{exact:true}).waitFor();
  await p.getByText(d.packageSavings.replace('{amount}','6'),{exact:true}).waitFor();await p.getByText(d.packageSavings.replace('{amount}','21'),{exact:true}).waitFor();
  await p.getByRole('radio').nth(1).click();await b(d.continuePayment).click();await p.getByText(d.nativePaymentRequired,{exact:true}).waitFor();
  await p.getByText('12 '+d.availableCredits,{exact:true}).waitFor();
  for(const width of [360,390,412]){await p.setViewportSize({width,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 }
 assert.deepEqual(requests,[]);
 }finally{await browser.close();}
});
