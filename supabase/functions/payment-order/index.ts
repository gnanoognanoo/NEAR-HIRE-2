import { testCredentials } from '../_shared/payments.ts';
import { actor,handle,json,reply,service } from '../_shared/runtime.ts';
handle(async req=>{
 if(Deno.env.get('PAYMENTS_ENABLED')!=='true') return reply({error:'PAYMENTS_DISABLED'},503);
 const keys=testCredentials();
 const {client}=await actor(req); const input=await json(req);
 if(!/^[0-9a-f-]{36}$/i.test(input.request_id||'')) return reply({error:'INVALID_REQUEST'},400);
 const {data:order,error}=await client.rpc('prepare_payment',{p_package:input.package_id,p_request_id:input.request_id}); if(error) throw error;
 if(order.status==='paid') return reply({status:'paid'});
 if(order.status==='refunded') return reply({error:'ORDER_REFUNDED'},409);
 if(order.provider_order_id?.startsWith('order_')) return reply({order_id:order.provider_order_id,amount:order.amount_paise,currency:'INR',key_id:keys.id});
 // Compare-and-set prevents concurrent external order creation. Ambiguous requests stay reserved for reconciliation.
 const db=service(); const {data:claimed,error:claimError}=await db.from('payment_orders').update({provider_order_id:`reserved:${order.id}`}).eq('id',order.id).is('provider_order_id',null).select('id').maybeSingle();
 if(claimError||!claimed) return reply({error:'ORDER_PENDING_RECONCILIATION'},409);
 const response=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${btoa(keys.id+':'+keys.secret)}`,'Content-Type':'application/json'},body:JSON.stringify({amount:order.amount_paise,currency:'INR',receipt:order.id}),signal:AbortSignal.timeout(15000)});
 if(!response.ok) return reply({error:'ORDER_PENDING_RECONCILIATION'},502);
 const provider=await response.json(); if(!provider.id?.startsWith('order_')||provider.amount!==order.amount_paise||provider.currency!=='INR') throw new Error('INVALID_PROVIDER_RESPONSE');
 const {error:updateError}=await db.from('payment_orders').update({provider_order_id:provider.id}).eq('id',order.id); if(updateError) throw updateError;
 console.info(JSON.stringify({event:'payment_order_created',order_id:order.id}));
 return reply({order_id:provider.id,amount:order.amount_paise,currency:'INR',key_id:keys.id});
});
