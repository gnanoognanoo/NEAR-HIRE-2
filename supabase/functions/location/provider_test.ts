import {OlaMapsProvider,MockLocationProvider} from './provider.ts';
const assert=(ok:unknown)=>{if(!ok)throw new Error('Assertion failed');};
Deno.test('Ola adapter normalizes search, details, reverse and rejects provider failures',async()=>{
 const payload={place_id:'fixture',formatted_address:'Fixture locality',geometry:{location:{lat:13,lng:80}},address_components:[{types:['locality'],long_name:'Chennai'},{types:['country'],short_name:'IN'}]};
 const request:typeof fetch=async(input)=>{
 const url=new URL(String(input));assert(url.origin==='https://api.olamaps.io');assert(url.searchParams.get('api_key')==='fictional');
 return new Response(JSON.stringify(url.pathname.endsWith('autocomplete')?{predictions:[{place_id:'fixture',description:'Fixture locality'}]}:url.pathname.endsWith('details')?{result:payload}:{results:[payload]}));
 };
 const provider=new OlaMapsProvider('fictional',request);
 assert((await provider.search('Fixture')).length===1);const p=await provider.resolve('fixture');assert(p.latitude===13&&p.locality==='Chennai'&&p.country==='IN');
 assert((await provider.reverse(12,79)).latitude===12);
 const failing=new OlaMapsProvider('fictional',async()=>new Response('',{status:503}));let rejected=false;try{await failing.search('abc');}catch{rejected=true;}assert(rejected);
 const mock=new MockLocationProvider([p]);assert((await mock.search('Fixture')).length===1);assert((await mock.reverse(1,2)).label.includes('DEVELOPMENT'));
});
