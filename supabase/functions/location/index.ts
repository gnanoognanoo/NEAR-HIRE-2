import {actor,env,handle,json,reply} from '../_shared/runtime.ts';
import {OlaMapsProvider} from './provider.ts';
const cache=new Map<string,{expires:number;data:unknown}>();
handle(async req=>{const {client}=await actor(req);const {error}=await client.rpc('edge_rate_limit',{p_kind:'location'});if(error)throw error;const p=await json(req);const provider=new OlaMapsProvider(env('OLA_MAPS_API_KEY'));
 if(p.action==='search'){if(typeof p.query!=='string'||p.query.trim().length<3||p.query.length>120)return reply({error:'INVALID_QUERY'},400);const key=p.query.toLowerCase().trim();const cached=cache.get(key);if(cached&&cached.expires>Date.now())return reply(cached.data);const data=await provider.search(key);if(cache.size>200)cache.clear();cache.set(key,{expires:Date.now()+300000,data});return reply(data);}
 if(p.action==='resolve'&&typeof p.id==='string'&&p.id.length<500)return reply(await provider.resolve(p.id));
 if(p.action==='reverse'&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180)return reply(await provider.reverse(p.latitude,p.longitude));
 return reply({error:'INVALID_ACTION'},400);
});
