import { actor,handle,json,reply,service } from '../_shared/runtime.ts';
import { testCredentials,providerPayment,capturedMatches,verifyCheckout } from '../_shared/payments.ts';
handle(async req=>{
 const {client,user}=await actor(req);const input=await json(req);const keys=testCredentials();
 const {data:order,error}=await client.from('payment_orders').select('*').eq('provider_order_id',input.razorpay_order_id).eq('user_id',user.id).single();
 if(error||!order) return reply({error:'ORDER_NOT_FOUND'},404);
 if(!await verifyCheckout(order.provider_order_id,String(input.razorpay_payment_id),String(input.razorpay_signature),keys.secret)) {
   console.warn(JSON.stringify({event:'payment_verification_rejected',order_id:order.id}));return reply({error:'INVALID_SIGNATURE'},400);
 }
 // A valid checkout signature may describe an authorization, not captured funds.
 const p=await providerPayment(input.razorpay_payment_id);
 if(!capturedMatches(p,order,input.razorpay_payment_id)) return reply({status:'pending'},202);
 const {error:settle}=await service().rpc('settle_payment',{p_event_id:`verify:${p.id}`,p_payment_id:p.id,p_order_id:order.provider_order_id,p_amount:p.amount,p_currency:p.currency});
 if(settle) return reply({error:'SETTLEMENT_PENDING'},503);
 console.info(JSON.stringify({event:'payment_verified',order_id:order.id}));
 return reply({status:'paid'});
});
