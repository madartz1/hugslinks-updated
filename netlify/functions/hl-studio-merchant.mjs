import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';
import { createHash, randomUUID } from 'node:crypto';
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(raw,name)=>raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export const handler=async event=>{
 if(!process.env.HL_STUDIO_DATABASE_URL||!process.env.HL_STUDIO_AUTH_SECRET||!process.env.HL_STUDIO_STRIPE_SECRET_KEY)return reply(503,{error:'Merchant dashboard is not configured'});
 const host=event.headers?.host||event.headers?.Host||'';
 if(!/^deploy-preview-14--hugslinks-web-build\.netlify\.app$/i.test(host))return reply(403,{error:'Unsupported host'});
 const raw=cookie(event.headers?.cookie||event.headers?.Cookie,'hl_studio_session');
 if(!raw||!/^[a-f0-9]{64}$/.test(raw))return reply(401,{error:'Sign in to manage your campaigns'});
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 try{
 const sessionHash=hash(process.env.HL_STUDIO_AUTH_SECRET+raw);
 const sessions=await sql`SELECT email FROM hl_studio_auth_sessions WHERE session_hash=${sessionHash} AND expires_at>NOW() LIMIT 1`;
 if(!sessions.length)return reply(401,{error:'Your session has expired. Sign in again.'});
 const email=sessions[0].email;
 const stripe=new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
 const customers=await stripe.customers.list({email,limit:20});
 let plan=null;
 for(const c of customers.data){
  const rows=await sql`SELECT plan FROM hl_studio_subscriptions WHERE stripe_customer_id=${c.id} AND is_entitled=TRUE ORDER BY updated_at DESC LIMIT 1`;
  if(rows.length){plan=rows[0].plan;break}
 }
 if(!['starter','growth','pro'].includes(plan))return reply(403,{error:'An active HL Studio subscription is required'});
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_merchants (email TEXT PRIMARY KEY,business_name TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT '',website TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_campaigns (id UUID PRIMARY KEY,owner_email TEXT NOT NULL,title TEXT NOT NULL,business_name TEXT NOT NULL,category TEXT NOT NULL,message TEXT NOT NULL,cta TEXT NOT NULL,format TEXT NOT NULL,video_url TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 const action=event.queryStringParameters?.action||'dashboard';
 const method=event.httpMethod;
 if(action==='dashboard'&&method==='GET'){
  const profiles=await sql`SELECT business_name,category,website,description FROM hl_studio_merchants WHERE email=${email} LIMIT 1`;
  const projects=await sql`SELECT id,title,business_name,category,message,cta,format,video_url,updated_at FROM hl_studio_campaigns WHERE owner_email=${email} ORDER BY updated_at DESC LIMIT 50`;
  return reply(200,{email,plan,profile:profiles[0]||null,projects});
 }
 if(method!=='POST')return reply(405,{error:'Method not allowed'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Invalid JSON'})}
 if(action==='profile'){
  const business=clean(body.business_name,100),category=clean(body.category,80),website=clean(body.website,250),description=clean(body.description,500);
  if(!business)return reply(400,{error:'Business name is required'});
  if(website){try{const url=new URL(website);if(!['https:','http:'].includes(url.protocol))throw Error()}catch{return reply(400,{error:'Enter a valid website URL'})}}
  await sql`INSERT INTO hl_studio_merchants(email,business_name,category,website,description) VALUES(${email},${business},${category},${website},${description}) ON CONFLICT(email) DO UPDATE SET business_name=EXCLUDED.business_name,category=EXCLUDED.category,website=EXCLUDED.website,description=EXCLUDED.description,updated_at=NOW()`;
  return reply(200,{message:'Business profile saved'});
 }
 if(action==='save'){
  const id=clean(body.id,40),title=clean(body.title,100),business=clean(body.business_name,100),category=clean(body.category,80),message=clean(body.message,250),cta=clean(body.cta,60),format=clean(body.format,10),video=clean(body.video_url,500);
  if(!title||!business||!message||!['9/16','1/1','16/9'].includes(format))return reply(400,{error:'Complete the campaign title, business, message and format'});
  if(video){try{const url=new URL(video);if(url.protocol!=='https:')throw Error()}catch{return reply(400,{error:'Video URL must be HTTPS'})}}
  if(id){
   if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid project'});
   const rows=await sql`UPDATE hl_studio_campaigns SET title=${title},business_name=${business},category=${category},message=${message},cta=${cta},format=${format},video_url=${video},updated_at=NOW() WHERE id=${id}::uuid AND owner_email=${email} RETURNING id`;
   if(!rows.length)return reply(404,{error:'Project not found'});
   return reply(200,{message:'Campaign updated',id:rows[0].id});
  }
  const newId=randomUUID();
  await sql`INSERT INTO hl_studio_campaigns(id,owner_email,title,business_name,category,message,cta,format,video_url) VALUES(${newId}::uuid,${email},${title},${business},${category},${message},${cta},${format},${video})`;
  return reply(200,{message:'Campaign saved',id:newId});
 }
 if(action==='delete'){
  const id=clean(body.id,40);
  if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid project'});
  const rows=await sql`DELETE FROM hl_studio_campaigns WHERE id=${id}::uuid AND owner_email=${email} RETURNING id`;
  return rows.length?reply(200,{message:'Campaign deleted'}):reply(404,{error:'Project not found'});
 }
 return reply(404,{error:'Unknown action'});
 }catch(e){console.error('HL Studio merchant error',{category:e?.name||'unknown',code:e?.code||undefined});return reply(500,{error:'Unable to load merchant dashboard'})}
};