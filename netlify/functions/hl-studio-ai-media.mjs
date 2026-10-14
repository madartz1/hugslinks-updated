import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';
import { createHash, randomUUID } from 'node:crypto';
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const hash=s=>createHash('sha256').update(s).digest('hex');
const getCookie=(raw,name)=>raw?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const models={video:'fal-ai/fast-svd/text-to-video',music:'fal-ai/stable-audio'};
// Preview-only test: maximum one paid generation of each type per member.
// Do not expand limits until separately approved.
const tiers={starter:{video:1,music:1},growth:{video:1,music:1},pro:{video:1,music:1}};
const validId=id=>/^[a-zA-Z0-9_-]{12,100}$/.test(id||'');
const providerUrl=value=>{const url=new URL(value,'https://queue.fal.run/');if(url.protocol!=='https:'||url.hostname!=='queue.fal.run'||url.username||url.password)throw Error('Invalid provider URL');return url.toString()};
const fal=async(path,method='GET',body)=>{
 const res=await fetch(providerUrl(path),{method,headers:{Authorization:'Key '+process.env.HL_STUDIO_FAL_KEY,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error('Media provider error ('+res.status+'): '+String(data.detail||data.message||'Please retry').slice(0,180));
 return data;
};
export const handler=async event=>{
 const host=event.headers?.host||event.headers?.Host||'';
 if(!/^deploy-preview-14--hugslinks-web-build\.netlify\.app$/i.test(host))return reply(403,{error:'Unsupported host'});
 if(!process.env.HL_STUDIO_DATABASE_URL||!process.env.HL_STUDIO_AUTH_SECRET||!process.env.HL_STUDIO_STRIPE_SECRET_KEY)return reply(503,{error:'Studio membership system is not configured'});
 const raw=getCookie(event.headers?.cookie||event.headers?.Cookie,'hl_studio_session');
 if(!raw||!/^[a-f0-9]{64}$/.test(raw))return reply(401,{error:'Sign in to HL Studio first'});
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 try{
 const sh=hash(process.env.HL_STUDIO_AUTH_SECRET+raw);
 const sessions=await sql`UPDATE hl_studio_auth_sessions SET last_activity_at=NOW() WHERE session_hash=${sh} AND expires_at>NOW() AND last_activity_at>NOW()-INTERVAL '1 hour' RETURNING email`;
 if(!sessions.length)return reply(401,{error:'Session expired. Sign in again'});
 const email=sessions[0].email,stripe=new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
 // Require an explicitly designated test account; no other preview member can incur charges.
 const isTestAccount=!!process.env.HL_STUDIO_AI_TEST_EMAIL && email.toLowerCase()===process.env.HL_STUDIO_AI_TEST_EMAIL.trim().toLowerCase();
 const customers=await stripe.customers.list({email,limit:20});let plan=null;
 for(const customer of customers.data){const rows=await sql`SELECT plan FROM hl_studio_subscriptions WHERE stripe_customer_id=${customer.id} AND is_entitled=TRUE ORDER BY updated_at DESC LIMIT 1`;if(rows.length){plan=rows[0].plan;break}}
 if(!tiers[plan])return reply(403,{error:'An active HL Studio membership is required'});
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_media_jobs (id UUID PRIMARY KEY,owner_email TEXT NOT NULL,kind TEXT NOT NULL,provider_request_id TEXT,provider_status TEXT NOT NULL DEFAULT 'pending',output_url TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`ALTER TABLE hl_studio_media_jobs ADD COLUMN IF NOT EXISTS provider_status_url TEXT`;
 await sql`ALTER TABLE hl_studio_media_jobs ADD COLUMN IF NOT EXISTS provider_response_url TEXT`;
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_media_usage (owner_email TEXT NOT NULL,month TEXT NOT NULL,kind TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner_email,month,kind))`;
 const action=event.queryStringParameters?.action||'config';
 if(action==='config'&&event.httpMethod==='GET'){
  const month='preview-test-2026-10',usage=await sql`SELECT kind,used FROM hl_studio_media_usage WHERE owner_email=${email} AND month=${month}`;
  const counts=Object.fromEntries(usage.map(row=>[row.kind,row.used]));
  return reply(200,{testOnly:true,enabled:isTestAccount&&process.env.HL_STUDIO_AI_MEDIA_ENABLED==='true'&&!!process.env.HL_STUDIO_FAL_KEY,providerConfigured:!!process.env.HL_STUDIO_FAL_KEY,betaEnabled:process.env.HL_STUDIO_AI_MEDIA_ENABLED==='true',limits:tiers[plan],used:{video:counts.video||0,music:counts.music||0},plan});
 }
 if(!['start','status','recent'].includes(action))return reply(404,{error:'Unknown action'});
 if(!isTestAccount)return reply(403,{error:'This preview test is restricted to the designated test account.'});
 if(process.env.HL_STUDIO_AI_MEDIA_ENABLED!=='true'||!process.env.HL_STUDIO_FAL_KEY)return reply(503,{error:'AI scenes and music are not activated yet. Studio administration must configure the media provider and enable this beta.'});
 if(action==='recent'&&event.httpMethod==='GET'){
  const jobs=await sql`SELECT id,kind,provider_status,output_url,created_at FROM hl_studio_media_jobs WHERE owner_email=${email} ORDER BY created_at DESC LIMIT 10`;
  return reply(200,{jobs:jobs.map(job=>({id:job.id,kind:job.kind,status:job.provider_status,url:job.output_url,createdAt:job.created_at}))});
 }
 if(action==='start'){
  if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
  let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Invalid request'})}
  const kind=body.kind,prompt=String(body.prompt||'').trim();
  if(!models[kind]||prompt.length<12||prompt.length>700)return reply(400,{error:'Select video or music and provide a prompt between 12 and 700 characters'});
  const month='preview-test-2026-10',limit=tiers[plan][kind];
  const used=await sql`INSERT INTO hl_studio_media_usage(owner_email,month,kind,used) VALUES(${email},${month},${kind},1) ON CONFLICT(owner_email,month,kind) DO UPDATE SET used=hl_studio_media_usage.used+1 WHERE hl_studio_media_usage.used<${limit} RETURNING used`;
  if(!used.length)return reply(403,{error:'Monthly '+kind+' generation limit reached ('+limit+').'});
  const id=randomUUID();
  try{
   const input=kind==='video'?{prompt:prompt+', cinematic advertising shot, realistic, no text overlays, no watermark',video_size:body.format==='16/9'?'landscape_16_9':body.format==='1/1'?'square':'portrait_16_9',fps:10,enable_safety_checker:true}:{prompt:prompt+', instrumental background music, no vocals, suitable for a short commercial',seconds_total:10,enable_safety_checker:true};
   const prediction=await fal(models[kind],'POST',input);
   if(!validId(prediction.request_id))throw Error('Provider did not return a valid request identifier');
   const statusUrl=providerUrl(prediction.status_url||models[kind]+'/requests/'+encodeURIComponent(prediction.request_id)+'/status');
   const responseUrl=providerUrl(prediction.response_url||models[kind]+'/requests/'+encodeURIComponent(prediction.request_id));
   await sql`INSERT INTO hl_studio_media_jobs(id,owner_email,kind,provider_request_id,provider_status,provider_status_url,provider_response_url) VALUES(${id}::uuid,${email},${kind},${prediction.request_id},'queued',${statusUrl},${responseUrl})`;
   return reply(202,{id,kind,status:'queued',remaining:limit-used[0].used});
  }catch(error){
   await sql`UPDATE hl_studio_media_usage SET used=GREATEST(0,used-1) WHERE owner_email=${email} AND month=${month} AND kind=${kind}`;
   console.error('Studio AI media submission failed',{kind,message:error.message});
   return reply(502,{error:'Could not start generation. No credit was used. '+String(error.message).slice(0,160)});
  }
 }
 if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed'});
 const id=String(event.queryStringParameters?.id||'');
 if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid job identifier'});
 const rows=await sql`SELECT kind,provider_request_id,provider_status,output_url,provider_status_url,provider_response_url FROM hl_studio_media_jobs WHERE id=${id}::uuid AND owner_email=${email} LIMIT 1`;
 if(!rows.length)return reply(404,{error:'Generation not found'});
 const job=rows[0];
 if(['completed','failed'].includes(job.provider_status))return reply(200,{status:job.provider_status,kind:job.kind,url:job.output_url});
 if(!validId(job.provider_request_id))return reply(502,{error:'Generation request is missing'});
 const route=models[job.kind]+'/requests/'+encodeURIComponent(job.provider_request_id);
 let state;
 try{state=await fal(job.provider_status_url||route+'/status')}catch(error){console.error('Studio status fetch failed',{kind:job.kind,requestId:job.provider_request_id,message:error.message});return reply(502,{error:'Status check failed; the job is saved. Do not regenerate. '+String(error.message).slice(0,120)})}
 const status=String(state.status||'').toUpperCase();
 if(status==='COMPLETED'){
  let result;
  try{result=await fal(job.provider_response_url||route)}catch(error){console.error('Studio result fetch failed',{kind:job.kind,requestId:job.provider_request_id,message:error.message});return reply(502,{error:'Video may be ready, but retrieving it failed. The job is saved. '+String(error.message).slice(0,120)})}
  const url=job.kind==='video'?(result.video?.url||result.data?.video?.url):(result.audio_file?.url||result.data?.audio_file?.url);
  if(typeof url!=='string'||!/^https:\/\//.test(url))return reply(502,{error:'Provider completed but returned an unexpected file format; job saved.'});
  await sql`UPDATE hl_studio_media_jobs SET provider_status='completed',output_url=${url},updated_at=NOW() WHERE id=${id}::uuid AND owner_email=${email}`;
  return reply(200,{status:'completed',kind:job.kind,url});
 }
 if(status==='FAILED'||status==='CANCELLED'){
  const changed=await sql`UPDATE hl_studio_media_jobs SET provider_status='failed',updated_at=NOW() WHERE id=${id}::uuid AND owner_email=${email} AND provider_status NOT IN ('completed','failed') RETURNING id`;
  if(changed.length){const month='preview-test-2026-10';await sql`UPDATE hl_studio_media_usage SET used=GREATEST(0,used-1) WHERE owner_email=${email} AND month=${month} AND kind=${job.kind}`;}
  return reply(200,{status:'failed',kind:job.kind,error:'Generation failed. Your allowance has been restored.'});
 }
 return reply(200,{status:status==='IN_PROGRESS'?'processing':'queued',kind:job.kind});
 }catch(error){console.error('HL Studio AI media error',{message:error?.message,code:error?.code});return reply(500,{error:'Unable to process media request. Please retry.'})}
};