import { importPKCS8, SignJWT } from 'npm:jose@6';
import {env,handle,reply,service} from '../_shared/runtime.ts';
handle(async req=>{
 if(req.headers.get('Authorization')!==`Bearer ${env('OUTBOX_SECRET')}`)return reply({error:'AUTH_REQUIRED'},401);
 const key=await importPKCS8(env('FIREBASE_PRIVATE_KEY').replace(/\\n/g,'\n'),'RS256');
 const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/firebase.messaging'}).setProtectedHeader({alg:'RS256'}).setIssuer(env('FIREBASE_CLIENT_EMAIL')).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});if(!tokenResponse.ok)throw new Error('FCM_AUTH_FAILED');const {access_token}=await tokenResponse.json();
 const db=service();const {data:events,error}=await db.rpc('claim_notifications');if(error)throw error;
 for(const event of events){let failure:string|null=null;for(const token of event.tokens){try{const r=await fetch(`https://fcm.googleapis.com/v1/projects/${env('FIREBASE_PROJECT_ID')}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,notification:{title:'NearHire',body:'You have a new update. Open NearHire to view it.'},data:{event:event.event,notification_id:event.id,job_id:event.job_id||''}}}),signal:AbortSignal.timeout(10000)});if(!r.ok){const body=await r.json();if(body.error?.details?.some((d:any)=>d.errorCode==='UNREGISTERED'))await db.from('user_devices').delete().eq('token',token);else failure='FCM_DELIVERY_FAILED';}}catch{failure='FCM_NETWORK_FAILED';}}await db.rpc('finish_notification',{p_id:event.id,p_error:failure});}
 return reply({processed:events.length});
});
