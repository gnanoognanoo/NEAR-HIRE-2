import {actor,env,handle,json,reply} from '../_shared/runtime.ts';
import {OlaMapsProvider} from './provider.ts';
const cache=new Map<string,{expires:number;data:unknown}>();
handle(async req=>{
 const {client,user}=await actor(req);const {error}=await client.rpc('edge_rate_limit',{p_kind:'location'});if(error)return reply({error:'LOCATION_RATE_LIMIT'},429);
 const p=await json(req);if(Deno.env.get('LOCATION_PROVIDER') && Deno.env.get('LOCATION_PROVIDER')!=='ola')return reply({error:'LOCATION_UNAVAILABLE'},503);
 const provider=new OlaMapsProvider(env('OLA_MAPS_API_KEY'));let operation:()=>Promise<unknown>;let key:string;
 if(p.action==='search'&&typeof p.query==='string'&&p.query.trim().length>=3&&p.query.length<=120){key='s:'+p.query.trim().toLowerCase();operation=()=>provider.search(p.query.trim());}
 else if(p.action==='resolve'&&typeof p.id==='string'&&p.id.length>0&&p.id.length<500){key='p:'+p.id;operation=()=>provider.resolve(p.id);}
 else if(p.action==='reverse'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180){key='r:'+p.latitude+','+p.longitude;operation=()=>provider.reverse(p.latitude,p.longitude);}
 else return reply({error:'INVALID_LOCATION_QUERY'},400);
 // User-scoped, bounded, short-lived cache; no persistent exact-address logs.
 key=user.id+':'+key;const hit=cache.get(key);if(hit&&hit.expires>Date.now())return reply(hit.data);
 try {const data=await operation();if(cache.size>=200)cache.clear();cache.set(key,{expires:Date.now()+300000,data});return reply(data);}
 catch{return reply({error:'LOCATION_UNAVAILABLE'},503);}
});
