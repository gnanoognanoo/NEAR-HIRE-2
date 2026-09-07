import { createClient } from 'npm:@supabase/supabase-js@2';
export const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
export function env(key: string) { const v = Deno.env.get(key); if (!v) throw new Error(`CONFIGURATION_REQUIRED:${key}`); return v; }
export const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
export function service() { return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }); }
export async function actor(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED');
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  const { data: profile } = await client.from('profiles').select('suspended').eq('id', data.user.id).single();
  if (!profile || profile.suspended) throw new Error('AUTH_REQUIRED');
  return { client, user: data.user };
}
export async function json(req: Request) { const raw = await req.text(); if (raw.length > 16384) throw new Error('PAYLOAD_TOO_LARGE'); return JSON.parse(raw); }
export function handle(fn: (req: Request) => Promise<Response>) { Deno.serve(async req => { if (req.method === 'OPTIONS') return new Response(null,{headers}); if(req.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405); try { return await fn(req); } catch(e) { const message = e instanceof Error ? e.message : 'REQUEST_FAILED'; const code = message.startsWith('CONFIGURATION_REQUIRED') ? 'SERVICE_NOT_CONFIGURED' : message==='AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'REQUEST_FAILED'; console.error(JSON.stringify({event:'request_failed',code})); return reply({error:code},code==='AUTH_REQUIRED'?401:code==='SERVICE_NOT_CONFIGURED'?503:400); } }); }
export async function validHmac(raw: string, signature: string, secret: string) { if(!/^[a-f0-9]{64}$/i.test(signature)) return false; const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']); const bytes=Uint8Array.from(signature.match(/.{2}/g)!.map(x=>parseInt(x,16))); return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw)); }
