import { env, handle, reply, service, validHmac } from '../_shared/runtime.ts';
handle(async req => {
 const raw=await req.text(); if(raw.length>100000) return reply({error:'PAYLOAD_TOO_LARGE'},413);
 if(!await validHmac(raw,req.headers.get('x-razorpay-signature')||'',env('RAZORPAY_WEBHOOK_SECRET'))) return reply({error:'INVALID_SIGNATURE'},401);
 const event=JSON.parse(raw); if(event.event!=='payment.captured') return reply({received:true});
 const p=event.payload?.payment?.entity; const eventId=req.headers.get('x-razorpay-event-id');
 if(!eventId||!p?.id||!p?.order_id||p.status!=='captured'||!Number.isInteger(p.amount)) return reply({error:'INVALID_EVENT'},400);
 const {error}=await service().rpc('settle_payment',{p_event_id:eventId,p_payment_id:p.id,p_order_id:p.order_id,p_amount:p.amount,p_currency:p.currency});
 if(error) return reply({error:'SETTLEMENT_PENDING'},500);
 return reply({received:true});
});
