import { testCredentials, providerPayment } from '../_shared/payments.ts';
import { env, handle, reply, service, validHmac } from '../_shared/runtime.ts';
handle(async req => {
 testCredentials();
 const raw=await req.text(); if(raw.length>100000) return reply({error:'PAYLOAD_TOO_LARGE'},413);
 if(!await validHmac(raw,req.headers.get('x-razorpay-signature')||'',env('RAZORPAY_WEBHOOK_SECRET'))) return reply({error:'INVALID_SIGNATURE'},401);
 const event=JSON.parse(raw);
 if(['payment.failed','refund.processed'].includes(event.event)) {
   const entity=event.event==='refund.processed' ? event.payload?.refund?.entity : event.payload?.payment?.entity;
   const paymentId=event.event==='refund.processed' ? entity?.payment_id : entity?.id;
   const eventId=req.headers.get('x-razorpay-event-id');
   if(!paymentId||!eventId) return reply({error:'INVALID_EVENT'},400);
   const p=await providerPayment(paymentId);
   const {error}=await service().rpc('record_payment_event',{p_event_id:eventId,p_payment_id:paymentId,p_order_id:p.order_id,p_kind:event.event==='refund.processed'?'refunded':'failed'});
   return error?reply({error:'EVENT_PENDING'},503):reply({received:true});
 }
 if(!['payment.captured','order.paid'].includes(event.event)) return reply({received:true});
 const p=event.payload?.payment?.entity; const eventId=req.headers.get('x-razorpay-event-id');
 if(!eventId||!p?.id||!p?.order_id||p.status!=='captured'||!Number.isInteger(p.amount)) return reply({error:'INVALID_EVENT'},400);
 const {error}=await service().rpc('settle_payment',{p_event_id:eventId,p_payment_id:p.id,p_order_id:p.order_id,p_amount:p.amount,p_currency:p.currency});
 if(error) return reply({error:'SETTLEMENT_PENDING'},500);
 console.info(JSON.stringify({event:'webhook_settled',payment_id:p.id}));
 return reply({received:true});
});
