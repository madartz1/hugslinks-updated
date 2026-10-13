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
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_assets (id UUID PRIMARY KEY,owner_email TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,blob_key TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_publications (campaign_id UUID PRIMARY KEY,owner_email TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,published_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_ai_usage (owner_email TEXT NOT NULL,month TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner_email,month))`;
 await sql`CREATE TABLE IF NOT EXISTS hl_studio_ai_drafts (id UUID PRIMARY KEY,owner_email TEXT NOT NULL,platform TEXT NOT NULL,headline TEXT NOT NULL,ad TEXT NOT NULL,cta TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
 const tiers={starter:{campaigns:5,assets:10,ai:10,publish:false},growth:{campaigns:25,assets:50,ai:100,publish:true},pro:{campaigns:100,assets:250,ai:500,publish:true}};
 const limits=tiers[plan];
 const action=event.queryStringParameters?.action||'dashboard';
 const method=event.httpMethod;
 if(action==='dashboard'&&method==='GET'){
  const profiles=await sql`SELECT business_name,category,website,description FROM hl_studio_merchants WHERE email=${email} LIMIT 1`;
  const projects=await sql`SELECT id,title,business_name,category,message,cta,format,video_url,updated_at FROM hl_studio_campaigns WHERE owner_email=${email} ORDER BY updated_at DESC LIMIT 50`;
  const assets=await sql`SELECT id,filename,mime,created_at FROM hl_studio_assets WHERE owner_email=${email} ORDER BY created_at DESC LIMIT 100`;
  const publications=await sql`SELECT campaign_id,slug,published_at FROM hl_studio_publications WHERE owner_email=${email}`;
  const month=new Date().toISOString().slice(0,7);
  const usage=await sql`SELECT used FROM hl_studio_ai_usage WHERE owner_email=${email} AND month=${month}`;
  return reply(200,{email,plan,limits,aiUsed:usage[0]?.used||0,profile:profiles[0]||null,projects,assets,publications});
 }
 if(action==='asset'&&method==='GET'){
  const id=clean(event.queryStringParameters?.id,40);
  if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid asset'});
  const rows=await sql`SELECT blob_key,mime FROM hl_studio_assets WHERE id=${id}::uuid AND owner_email=${email} LIMIT 1`;
  if(!rows.length)return reply(404,{error:'Asset not found'});
  const {getStore}=await import('@netlify/blobs');
  const bytes=await getStore('hl-studio-private').get(rows[0].blob_key,{type:'arrayBuffer'});
  if(!bytes)return reply(404,{error:'Asset unavailable'});
  return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':rows[0].mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment'},body:Buffer.from(bytes).toString('base64')};
 }
 if(method!=='POST')return reply(405,{error:'Method not allowed'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Invalid JSON'})}
 if(action==='upload'){
  const filename=clean(body.filename,120),mime=clean(body.mime,80),data=clean(body.data,15000000);
  const allowed=['image/png','image/jpeg','image/webp','video/mp4'];
  if(!allowed.includes(mime)||!filename||!data)return reply(400,{error:'Use PNG, JPEG, WebP or MP4'});
  const bytes=Buffer.from(data,'base64');
  if(bytes.length>8*1024*1024||bytes.length<1)return reply(413,{error:'File must be 8 MB or smaller'});
  const signatures={'image/png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'image/jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'image/webp':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','video/mp4':bytes.toString('ascii',4,8)==='ftyp'};
  if(!signatures[mime])return reply(400,{error:'File format does not match content'});
  const count=await sql`SELECT COUNT(*)::int AS n FROM hl_studio_assets WHERE owner_email=${email}`;
  if(count[0].n>=limits.assets)return reply(403,{error:'Media limit reached for '+plan});
  const id=randomUUID(),key=email.replace(/[^a-z0-9]/g,'_')+'/'+id;
  const {getStore}=await import('@netlify/blobs');
  await getStore('hl-studio-private').set(key,bytes,{metadata:{mime}});
  await sql`INSERT INTO hl_studio_assets(id,owner_email,filename,mime,blob_key) VALUES(${id}::uuid,${email},${filename},${mime},${key})`;
  return reply(200,{message:'Media uploaded privately',id});
 }
 if(action==='ai-history'&&method==='GET'){const history=await sql`SELECT id,platform,headline,ad,cta,created_at FROM hl_studio_ai_drafts WHERE owner_email=${email} ORDER BY created_at DESC LIMIT 50`;return reply(200,{history})}
 if(action==='save-ai'){const platform=clean(body.platform,30),headline=clean(body.headline,180),ad=clean(body.ad,2000),cta=clean(body.cta,180);if(!['Instagram','Facebook','TikTok','Google Ads','Email','General'].includes(platform)||!headline||!ad||!cta)return reply(400,{error:'Invalid advertisement'});const id=randomUUID();await sql`INSERT INTO hl_studio_ai_drafts(id,owner_email,platform,headline,ad,cta) VALUES(${id}::uuid,${email},${platform},${headline},${ad},${cta})`;return reply(200,{id,message:'Advertisement saved'})}
 if(action==='generate'){
  const prompt=clean(body.prompt,1000),platform=clean(body.platform,30);
  if(!['Instagram','Facebook','TikTok','Google Ads','Email','General'].includes(platform))return reply(400,{error:'Choose an advertising platform'});
  if(prompt.length<10)return reply(400,{error:'Describe your promotion in at least 10 characters'});
  if(!process.env.HL_STUDIO_OPENAI_API_KEY)return reply(503,{error:'AI generation is not configured'});
  const month=new Date().toISOString().slice(0,7);
  await sql`INSERT INTO hl_studio_ai_usage(owner_email,month,used) VALUES(${email},${month},0) ON CONFLICT DO NOTHING`;
  const claim=await sql`UPDATE hl_studio_ai_usage SET used=used+1 WHERE owner_email=${email} AND month=${month} AND used<${limits.ai} RETURNING used`;
  if(!claim.length)return reply(403,{error:'Monthly AI generation limit reached'});
  try{
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.HL_STUDIO_OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',max_output_tokens:400,input:[{role:'system',content:'Write concise, truthful promotional copy for a small business. No invented claims. Return ONLY valid JSON with string keys headline, ad, cta. Write a concise headline, two-sentence ad, and CTA. Do not include markdown.'},{role:'user',content:'Platform: '+platform+'\nPromotion: '+prompt}]})});
   if(!response.ok){const code=response.status;const detail=await response.json().catch(()=>({}));const providerCode=detail?.error?.code||detail?.error?.type||'unknown';console.error('HL Studio AI provider request failed',{status:code,providerCode});const category=code===401||code===403?'AI provider authentication failed':code===429?'AI provider quota or rate limit reached':code===400||code===404?'AI model or request configuration needs attention':'AI provider unavailable';throw Error(category);}
   const result=await response.json();
   const output=(result.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').slice(0,2000);
   if(!output)throw Error('No generated text');
   let draft;try{const parsed=JSON.parse(output.replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g,''));draft={platform,headline:clean(parsed.headline,180),ad:clean(parsed.ad,2000),cta:clean(parsed.cta,180)};if(!draft.headline||!draft.ad||!draft.cta)throw Error()}catch{throw Error('Invalid AI response format')}
   return reply(200,{draft,used:claim[0].used,limit:limits.ai});
  }catch(e){console.error('HL Studio AI generation failed',{reason:e.message});await sql`UPDATE hl_studio_ai_usage SET used=GREATEST(0,used-1) WHERE owner_email=${email} AND month=${month}`;return reply(502,{error:['AI provider authentication failed','AI provider quota or rate limit reached','AI model or request configuration needs attention'].includes(e.message)?e.message:'AI generation temporarily unavailable'})}
 }
 if(action==='publish'){
  if(!limits.publish)return reply(403,{error:'Publishing requires Growth or Pro'});
  if(process.env.HL_STUDIO_ENABLE_PUBLIC_PUBLISHING!=='true')return reply(503,{error:'Public publishing is disabled until launch approval'});
  const id=clean(body.id,40);
  if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid campaign'});
  const rows=await sql`SELECT id FROM hl_studio_campaigns WHERE id=${id}::uuid AND owner_email=${email}`;
  if(!rows.length)return reply(404,{error:'Campaign not found'});
  const slug=randomUUID();
  await sql`INSERT INTO hl_studio_publications(campaign_id,owner_email,slug) VALUES(${id}::uuid,${email},${slug}) ON CONFLICT(campaign_id) DO UPDATE SET published_at=NOW() RETURNING slug`;
  return reply(200,{message:'Campaign published',slug});
 }
 if(action==='unpublish'){
  const id=clean(body.id,40);
  if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid campaign'});
  await sql`DELETE FROM hl_studio_publications WHERE campaign_id=${id}::uuid AND owner_email=${email}`;
  return reply(200,{message:'Campaign unpublished'});
 }
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
  const count=await sql`SELECT COUNT(*)::int AS n FROM hl_studio_campaigns WHERE owner_email=${email}`;if(count[0].n>=limits.campaigns)return reply(403,{error:'Campaign limit reached for '+plan});
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