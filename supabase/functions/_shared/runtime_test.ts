import {validHmac} from './runtime.ts';
Deno.test('webhook accepts the signed raw body and rejects tampering',async()=>{
 const secret='fictional-test-secret';const raw='{"event":"payment.captured","amount":1000}';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(!await validHmac(raw,signature,secret))throw new Error('Valid signature rejected');
 for(const [body,sig,s] of [[raw+' ',signature,secret],[raw,signature,'wrong-secret'],[raw,'invalid',secret],[raw,'0'.repeat(64),secret]]){
  if(await validHmac(body,sig,s))throw new Error('Invalid signature accepted');
 }
});
