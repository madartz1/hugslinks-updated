import Stripe from 'stripe';
import {neon} from '@neondatabase/serverless';
const reply=(status,message)=>new Response(JSON.stringify({message}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async function handler(request){
 if(request.method!=='POST')return reply(405,'Method not allowed');
 const secret=process.env.HUGS_MUSIC_STRIPE_WEBHOOK_SECRET;
 const key=process.env.HL_STUDIO_STRIPE_SECRET_KEY;
 const db=process.env.HL_STUDIO_DATABASE_URL;
 if(!secret||!key||!db)return reply(503,'Music order webhook not configured');
 let event;
 try{
  const raw=await request.text();
  event=new Stripe(key).webhooks.constructEvent(raw,request.headers.get('stripe-signature'),secret);
 }catch{return reply(400,'Invalid webhook signature')}
 if(event.type!=='checkout.session.completed'&&event.type!=='checkout.session.async_payment_succeeded'&&event.type!=='checkout.session.async_payment_failed')return reply(200,'Event ignored');
 const session=event.data.object;
 if(session.mode!=='payment'||session.metadata?.product!=='hugs-custom-music')return reply(200,'Not a music order');
 const orderId=session.metadata?.order_id;
 if(!/^[a-f0-9-]{36}$/i.test(orderId||''))return reply(400,'Invalid order reference');
 const paid=session.payment_status==='paid'&&event.type!=='checkout.session.async_payment_failed';
 try{
  const sql=neon(db);
  await sql`CREATE TABLE IF NOT EXISTS hugs_music_orders (
    id UUID PRIMARY KEY,
    stripe_checkout_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    occasion TEXT NOT NULL,
    genre TEXT NOT NULL,
    description TEXT NOT NULL,
    customer_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // Checkout creates the pending row first; a webhook must never create arbitrary orders.
  const rows=await sql`UPDATE hugs_music_orders SET
    stripe_checkout_session_id=${session.id},
    stripe_payment_intent_id=${typeof session.payment_intent==='string'?session.payment_intent:null},
    customer_email=COALESCE(${session.customer_details?.email||null},customer_email),
    status=CASE WHEN status IN ('generating','delivered','refunded') THEN status WHEN ${paid} THEN 'paid' ELSE 'payment_pending' END,
    updated_at=NOW()
    WHERE id=${orderId}::uuid AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=${session.id})
    RETURNING id`;
  if(!rows.length)return reply(409,'Order not found or session mismatch');
  return reply(200,'Order payment synchronized');
 }catch(e){console.error('Music webhook failure',{category:e?.name||'unknown'});return reply(500,'Unable to update order')}
}
export const config={path:'/api/hugs-music/stripe-webhook'};
