import {capturedMatches,verifyCheckout} from './payments.ts';
const assert=(v:boolean)=>{if(!v)throw new Error('Payment assertion failed');};
Deno.test('checkout signature uses stored order ID and rejects modified payment/order/signature',async()=>{
 const secret='fictional-unit-secret',order='order_test',payment='pay_test';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${order}|${payment}`)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 assert(await verifyCheckout(order,payment,signature,secret));
 assert(!await verifyCheckout('order_other',payment,signature,secret));
 assert(!await verifyCheckout(order,'pay_other',signature,secret));
 assert(!await verifyCheckout(order,payment,'0'.repeat(64),secret));
});
Deno.test('only captured matching provider payment is eligible for settlement',()=>{
 const order={provider_order_id:'order_test',amount_paise:3900,currency:'INR'};
 const p={id:'pay_test',order_id:'order_test',amount:3900,currency:'INR',status:'captured',captured:true};
 assert(capturedMatches(p,order,'pay_test'));
 for(const patch of [{status:'authorized'},{status:'failed'},{captured:false},{amount:900},{currency:'USD'},{order_id:'order_other'}]) assert(!capturedMatches({...p,...patch},order,'pay_test'));
});
