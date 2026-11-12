import Stripe from 'stripe';
import {neon} from '@neondatabase/serverless';
const allowance={starter:100,growth:300,pro:800};
const envPrice={starter:'HL_STUDIO_PRICE_STARTER',growth:'HL_STUDIO_PRICE_GROWTH',pro:'HL_STUDIO_PRICE_PRO'};
const noStore={'Cache-Control':'no-store'};
export default async function(req){
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:noStore});
 const secret=process.env.HL_STUDIO_WEBHOOK_SECRET;
 const key=process.env.STRIPE_SECRET_KEY;
 const db=process.env.HL_STUDIO_DATABASE_URL;
 if(!secret||!key||!db)return new Response('Not configured',{status:503,headers:noStore});
 const stripe=new Stripe(key);
 let event;
 try{event=stripe.webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature'),secret)}
 catch{return new Response('Invalid signature',{status:400,headers:noStore})}
 if(!['invoice.paid','customer.subscription.deleted','customer.subscription.updated'].includes(event.type))return new Response('ok',{headers:noStore});
 try{
 const sql=neon(db);
 if(event.type==='invoice.paid'){
   const invoice=event.data.object;
   const subId=typeof invoice.subscription==='string'?invoice.subscription:
      (typeof invoice.parent?.subscription_details?.subscription==='string'?invoice.parent.subscription_details.subscription:null);
   if(!subId)return new Response('ok',{headers:noStore});
   const sub=await stripe.subscriptions.retrieve(subId,{expand:['items.data.price']});
   const userId=sub.metadata?.studio_user_id;const plan=sub.metadata?.studio_plan;
   if(!userId||!Object.hasOwn(allowance,plan))return new Response('ok',{headers:noStore});
   const expectedPrice=process.env[envPrice[plan]];
   if(!expectedPrice||sub.items.data.length!==1||sub.items.data[0].price.id!==expectedPrice)throw Error('HUGS Studio plan/price mismatch');
   if(!['active','trialing'].includes(sub.status))throw Error('Subscription not active');
   const item=sub.items.data[0];
   // Use the actual paid invoice's subscription line period, never an untrusted browser date.
   const lines=invoice.lines?.data||[];
   const paidLine=lines.find(l=>l.pricing?.price_details?.price===expectedPrice||l.price?.id===expectedPrice);
   const start=paidLine?.period?.start ?? item.current_period_start;
   const end=paidLine?.period?.end ?? item.current_period_end;
   if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start)throw Error('Missing verified billing period');
   const customer=typeof sub.customer==='string'?sub.customer:sub.customer.id;
   // Single statement: create/update the subscription then grant one monthly period.
   // Concurrent webhook retries cannot duplicate the UNIQUE(subscription_id,period_start) allowance.
   await sql`
   WITH upserted AS (
     INSERT INTO hl_studio_subscriptions(user_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_start,current_period_end)
     VALUES(${userId},${customer},${sub.id},${plan},'active',to_timestamp(${start}),to_timestamp(${end}))
     ON CONFLICT(stripe_subscription_id) DO UPDATE
       SET plan=EXCLUDED.plan,status='active',current_period_start=EXCLUDED.current_period_start,
       current_period_end=EXCLUDED.current_period_end,updated_at=NOW()
       WHERE hl_studio_subscriptions.user_id=EXCLUDED.user_id
     RETURNING user_id,stripe_subscription_id
   )
   INSERT INTO hl_studio_periods(user_id,subscription_id,period_start,period_end,allowance,available,reserved,spent)
   SELECT user_id,stripe_subscription_id,to_timestamp(${start}),to_timestamp(${end}),${allowance[plan]},${allowance[plan]},0,0 FROM upserted
   ON CONFLICT(subscription_id,period_start) DO NOTHING`;
 }else{
   const payload=event.data.object;
   const sub=event.type==='customer.subscription.deleted'?payload:await stripe.subscriptions.retrieve(payload.id);
   const status=event.type==='customer.subscription.deleted'?'canceled':sub.status;
   await sql`UPDATE hl_studio_subscriptions SET status=${status},updated_at=NOW() WHERE stripe_subscription_id=${sub.id}`;
 }
 return new Response('ok',{headers:noStore});
 }catch(e){console.error('HL Studio subscription webhook processing error',e);return new Response('Webhook could not be processed',{status:500,headers:noStore})}
}
