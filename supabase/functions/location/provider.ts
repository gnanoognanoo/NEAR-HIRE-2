export type Place = { id: string; label: string; latitude?: number; longitude?: number; locality?: string; city?: string; district?: string; state?: string; country?: string; formatted_address?: string };
export interface LocationSearchProvider { search(query: string): Promise<Place[]>; resolve(id: string): Promise<Place>; reverse(latitude: number, longitude: number): Promise<Place>; }
function place(p: any, latitude?: number, longitude?: number): Place {
 const components = p.address_components || [];
 const part = (type: string, short = false) => {const c = components.find((c: any) => c.types?.includes(type)); return c?.[short ? 'short_name' : 'long_name'] || '';};
 const lat = latitude ?? Number(p.geometry?.location?.lat); const lng = longitude ?? Number(p.geometry?.location?.lng);
 if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) throw new Error('LOCATION_NOT_FOUND');
 return {id: String(p.place_id || `${lat},${lng}`), label: p.formatted_address || '', formatted_address: p.formatted_address || '', latitude: lat, longitude: lng, locality: part('sublocality_level_1') || part('sublocality') || part('locality'), city: part('locality'), district: part('administrative_area_level_2'), state: part('administrative_area_level_1'), country: part('country', true) || 'IN'};
}
export class OlaMapsProvider implements LocationSearchProvider {
 constructor(private key: string, private request: typeof fetch = fetch) {}
 private async get(path: string, params: Record<string,string>) {
  const url = new URL(`https://api.olamaps.io/places/v1/${path}`);
  Object.entries({...params,api_key:this.key}).forEach(([k,v])=>url.searchParams.set(k,v));
  const r = await this.request(url,{headers:{'X-Request-Id':crypto.randomUUID()},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('LOCATION_UNAVAILABLE'); return r.json();
 }
 async search(query: string) {const d=await this.get('autocomplete',{input:query}); return (d.predictions||[]).slice(0,8).map((p:any)=>({id:String(p.place_id),label:String(p.description)}));}
 async resolve(id: string) {const d=await this.get('details',{place_id:id}); if(!d.result)throw new Error('LOCATION_NOT_FOUND');return place(d.result);}
 async reverse(latitude:number,longitude:number) {const d=await this.get('reverse-geocode',{latlng:`${latitude},${longitude}`});if(!d.results?.[0])throw new Error('LOCATION_NOT_FOUND');return place(d.results[0],latitude,longitude);}
}
// Explicit fixture adapter for automated/local tests. Never selected by the hosted endpoint.
export class MockLocationProvider implements LocationSearchProvider {
 constructor(private fixtures: Place[]) {}
 async search(query:string) {return this.fixtures.filter(p=>p.label.toLowerCase().includes(query.toLowerCase())).slice(0,8);}
 async resolve(id:string) {const p=this.fixtures.find(p=>p.id===id);if(!p)throw new Error('LOCATION_NOT_FOUND');return p;}
 async reverse(latitude:number,longitude:number) {return {id:'mock',label:'DEVELOPMENT FIXTURE',latitude,longitude};}
}
