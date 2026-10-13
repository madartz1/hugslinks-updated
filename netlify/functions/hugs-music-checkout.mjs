import Stripe from 'stripe';
import {neon} from '@neondatabase/serverless';
import {randomUUID} from 'node:crypto';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const styles=new Set(['R&B / Soul','Gospel','Hip-hop','Lo-fi','Latin / Salsa','Reggae','Instrumental']);
const occasions=new Set(['Birthday','Love and romance','Encouragement','Congratulations','Other']);
export default async function handler(request){
 if(request.method!=='POST')return json(405,{error:'Method not allowed'});
 // Fail closed until the entire fulfillment pipeline has been verified.
 if(process.env.HUGS_MUSIC_CHECKOUT_ENABLED!=='true'||process.env.HUGS_MUSIC_ORDER_PIPELINE_READY!=='true')return json(503,{error:'Music checkout is not live yet'});
 const key=process.env.HL_STUDIO_STRIPE_SECRET_KEY,price=process.env.HUGS_MUSIC_STRIPE_PRICE_ID,db=process.env.HL_STUDIO_DATABASE_URL;
 if(!key||!db||!/^price_[A-Za-z0-9]+$/.test(price||''))return json(503,{error:'Music checkout is not configured'});
 let input;try{input=await request.json()}catch{return json(400,{error:'Invalid request'})}
 const description=typeof input.description==='string'?input.description.trim():'';
 const genre=typeof input.genre==='string'?input.genre.trim():'';
 const occasion=typeof input.occasion==='string'?input.occasion.trim():'';
 if(!description||description.length>1500||!styles.has(genre)||!occasions.has(occasion)||input.acceptedTerms!==true)return json(400,{error:'Complete the song details and acknowledge the terms'});
 // Do not trust caller-provided redirect URLs.
 const origin=process.env.HUGS_MUSIC_CHECKOUT_ORIGIN;
 if(!origin||!/^https:\/\/[a-z0-9.-]+$/i.test(origin))return json(503,{error:'Checkout return address not configured'});
 const orderId=randomUUID();
 try{
  const sql=neon(db);
  await sql`CREATE TABLE IF NOT EXISTS hugs_music_orders (
   id UUID PRIMARY KEY,stripe_checkout_session_id TEXT UNIQUE,stripe_payment_intent_id TEXT,
   status TEXT NOT NULL DEFAULT 'pending',occasion TEXT NOT NULL,genre TEXT NOT NULL,
   description TEXT NOT NULL,customer_email TEXT,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO hugs_music_orders (id,occasion,genre,description,status)
    VALUES (${orderId}::uuid,${occasion},${genre},${description},'pending')`;
  const stripe=new Stripe(key);
  const session=await stripe.checkout.sessions.create({
   mode:'payment',line_items:[{price,quantity:1}],customer_creation:'always',
   success_url:origin+'/custom-hug-music.html?checkout=return',
   cancel_url:origin+'/custom-hug-music.html?checkout=cancel',
   metadata:{product:'hugs-custom-music',order_id:orderId},
   payment_intent_data:{metadata:{product:'hugs-custom-music',order_id:orderId}}
  },{idempotencyKey:'hugs-music-'+orderId});
  await sql`UPDATE hugs_music_orders SET stripe_checkout_session_id=${session.id},updated_at=NOW()
    WHERE id=${orderId}::uuid`;
  return json(200,{url:session.url});
 }catch(e){
  console.error('Music checkout failure',{category:e?.type||e?.name||'unknown'});
  return json(502,{error:'Unable to start music checkout'});
 }
}
export const config={path:'/api/hugs-music/checkout'};
