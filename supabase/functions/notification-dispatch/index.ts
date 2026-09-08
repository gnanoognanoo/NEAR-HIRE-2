import {importPKCS8,SignJWT} from 'npm:jose@6';
import {env,handle,reply,service} from '../_shared/runtime.ts';
handle(async req=>{
 if(req.headers.get('Authorization')!==`Bearer ${env('OUTBOX_SECRET')}`)return reply({error:'AUTH_REQUIRED'},401);
 const key=await importPKCS8(env('FIREBASE_PRIVATE_KEY').replace(/\\n/g,'\n'),'RS256');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/firebase.messaging'}).setProtectedHeader({alg:'RS256'}).setIssuer(env('FIREBASE_CLIENT_EMAIL')).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
 if(!tokenResponse.ok)throw new Error('FCM_AUTH_FAILED');const {access_token}=await tokenResponse.json();
 const db=service();const {data:events,error}=await db.rpc('claim_notifications');if(error)throw error;
 // Bound network concurrency; successful token deliveries are acknowledged individually.
 for(let offset=0;offset<events.length;offset+=5){await Promise.all(events.slice(offset,offset+5).map(async(event:any)=>{
  let failure:string|null=null;
  for(let t=0;t<event.tokens.length;t+=5){await Promise.all(event.tokens.slice(t,t+5).map(async(token:string)=>{
   try{
    const response=await fetch(`https://fcm.googleapis.com/v1/projects/${env('FIREBASE_PROJECT_ID')}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,android:{notification:{tag:event.id}},notification:{title:'NearHire',body:'You have a new update. Open NearHire to view it.'},data:{event:event.event,notification_id:event.id,job_id:event.job_id||''}}}),signal:AbortSignal.timeout(10000)});
    if(response.ok){const {error:ack}=await db.rpc('record_notification_delivery',{p_id:event.id,p_token:token});if(ack)failure='DELIVERY_ACK_FAILED';}
    else {const body=await response.json();if(body.error?.details?.some((d:any)=>d.errorCode==='UNREGISTERED')){const {error:cleanup}=await db.from('user_devices').delete().eq('token',token);if(cleanup)failure='TOKEN_CLEANUP_FAILED';}else failure='FCM_DELIVERY_FAILED';}
   }catch{failure='FCM_NETWORK_FAILED';}
  }));}
  const {error:finished}=await db.rpc('finish_notification',{p_id:event.id,p_error:failure});if(finished)throw new Error('OUTBOX_ACK_FAILED');
 }));}
 return reply({processed:events.length});
});
