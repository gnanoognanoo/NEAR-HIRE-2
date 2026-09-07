export type Place={id:string;label:string;latitude?:number;longitude?:number};
export interface LocationProvider { search(query:string):Promise<Place[]>; resolve(id:string):Promise<Place>; reverse(latitude:number,longitude:number):Promise<Place>; }
export class OlaMapsProvider implements LocationProvider {
 constructor(private key:string){}
 private async get(path:string,params:Record<string,string>){const url=new URL(`https://api.olamaps.io/places/v1/${path}`);Object.entries({...params,api_key:this.key}).forEach(([k,v])=>url.searchParams.set(k,v)); const r=await fetch(url,{headers:{'X-Request-Id':crypto.randomUUID()},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('LOCATION_UNAVAILABLE');return r.json();}
 async search(query:string){const data=await this.get('autocomplete',{input:query});return (data.predictions||[]).slice(0,8).map((p:any)=>({id:p.place_id,label:p.description}));}
 async resolve(id:string){const d=await this.get('details',{place_id:id});const p=d.result; if(!p?.geometry?.location)throw new Error('LOCATION_NOT_FOUND');return {id,label:p.formatted_address,latitude:p.geometry.location.lat,longitude:p.geometry.location.lng};}
 async reverse(latitude:number,longitude:number){const d=await this.get('reverse-geocode',{latlng:`${latitude},${longitude}`});const p=d.results?.[0];if(!p)throw new Error('LOCATION_NOT_FOUND');return {id:p.place_id,label:p.formatted_address,latitude,longitude};}
}
