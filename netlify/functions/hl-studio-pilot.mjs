import { neon } from '@neondatabase/serverless';
import { randomUUID,createHash } from 'node:crypto';
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
const cookie=(raw,name)=>raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
export const handler=async event=>{
 const host=event.headers?.host||event.headers?.Host||'';
 if(!/^deploy-preview-14--hugslinks-web-build\.netlify\.app$/i.test(host))return json(403,{error:'Pilot intake is available in the authorized development preview only.'});
 if(!process.env.HL_STUDIO_DATABASE_URL)return json(503,{error:'Pilot request storage is not configured.'});
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 try{
  await sql`CREATE TABLE IF NOT EXISTS hl_studio_pilot_requests (
   id UUID PRIMARY KEY, contact_name TEXT NOT NULL, business_name TEXT NOT NULL,
   email TEXT NOT NULL, business_type TEXT NOT NULL, service TEXT NOT NULL,
   duration TEXT NOT NULL, objective TEXT NOT NULL, audience TEXT NOT NULL DEFAULT '',
   assets_url TEXT NOT NULL DEFAULT '', budget TEXT NOT NULL, deadline TEXT NOT NULL DEFAULT '',
   notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  const action=event.queryStringParameters?.action||'apply';
  if(action==='apply'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   if(Number(event.headers?.['content-length']||0)>14000)return json(413,{error:'Request too large'});
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid form data'})}
   if(body.website)return json(200,{message:'Request received for review.'});
   if(body.consent!==true)return json(400,{error:'Please agree to be contacted about your production request.'});
   const name=clean(body.name,100),business=clean(body.business,120),email=clean(body.email,254).toLowerCase(),type=clean(body.type,80),service=clean(body.service,30),duration=clean(body.duration,10),objective=clean(body.objective,1000),audience=clean(body.audience,250),assets=clean(body.assets,500),budget=clean(body.budget,50),deadline=clean(body.deadline,40),notes=clean(body.notes,1000);
   if(name.length<2||business.length<2||!validEmail(email)||objective.length<15)return json(400,{error:'Enter your name, business, valid email and a project description of at least 15 characters.'});
   if(!['social','business','premium','custom'].includes(service)||!['15','30','60','90+'].includes(duration)||!['under-100','100-199','200-399','400+','unsure'].includes(budget))return json(400,{error:'Select a valid production package, length and budget.'});
   if(assets){let url;try{url=new URL(assets)}catch{return json(400,{error:'Enter a valid HTTPS portfolio or asset link.'})}if(url.protocol!=='https:'||url.username||url.password)return json(400,{error:'Asset links must be HTTPS.'})}
   const recent=await sql`SELECT id FROM hl_studio_pilot_requests WHERE email=${email} AND created_at>NOW()-INTERVAL '20 minutes' LIMIT 1`;
   if(recent.length)return json(429,{error:'A request was recently submitted from this email. Please wait before sending another.'});
   const id=randomUUID();
   await sql`INSERT INTO hl_studio_pilot_requests(id,contact_name,business_name,email,business_type,service,duration,objective,audience,assets_url,budget,deadline,notes)
    VALUES(${id}::uuid,${name},${business},${email},${type},${service},${duration},${objective},${audience},${assets},${budget},${deadline},${notes})`;
   return json(200,{message:'Your pilot application has been saved for review. This is not an accepted booking or payment.',reference:id.slice(0,8).toUpperCase()});
  }
  if(!['list','status'].includes(action))return json(404,{error:'Not found'});
  if(!process.env.HL_STUDIO_AUTH_SECRET||!process.env.HL_STUDIO_PILOT_ADMIN_EMAIL)return json(403,{error:'Pilot administration is not configured.'});
  const session=cookie(event.headers?.cookie||event.headers?.Cookie,'hl_studio_session');
  if(!session||!/^[a-f0-9]{64}$/.test(session))return json(401,{error:'Sign in to HL Studio.'});
  const sessionHash=createHash('sha256').update(process.env.HL_STUDIO_AUTH_SECRET+session).digest('hex');
  const sessions=await sql`SELECT email FROM hl_studio_auth_sessions WHERE session_hash=${sessionHash} AND expires_at>NOW() AND last_activity_at>NOW()-INTERVAL '1 hour' LIMIT 1`;
  if(!sessions.length||sessions[0].email.toLowerCase()!==process.env.HL_STUDIO_PILOT_ADMIN_EMAIL.trim().toLowerCase())return json(403,{error:'Not authorized to view production applications.'});
  if(action==='list'&&event.httpMethod==='GET'){
   const rows=await sql`SELECT id,contact_name,business_name,email,business_type,service,duration,objective,audience,assets_url,budget,deadline,notes,status,created_at FROM hl_studio_pilot_requests ORDER BY created_at DESC LIMIT 100`;
   return json(200,{requests:rows});
  }
  if(action==='status'&&event.httpMethod==='POST'){
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   if(!/^[0-9a-f-]{36}$/i.test(body.id||'')||!['new','reviewing','accepted','declined','delivered'].includes(body.status))return json(400,{error:'Invalid request status'});
   const rows=await sql`UPDATE hl_studio_pilot_requests SET status=${body.status},updated_at=NOW() WHERE id=${body.id}::uuid RETURNING id`;
   if(!rows.length)return json(404,{error:'Application not found'});
   return json(200,{message:'Application status updated.'});
  }
  return json(405,{error:'Method not allowed'});
 }catch(error){console.error('HL Studio pilot intake error',{message:error?.message});return json(503,{error:'Pilot intake is temporarily unavailable. Please try again later.'})}
};
