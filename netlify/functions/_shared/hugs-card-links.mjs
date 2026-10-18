import { randomBytes, randomInt, createHash, createHmac, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

export const CHUNK_SIZE = 2 * 1024 * 1024;
export const DAYS = 30;
const PREVIEW = 'deploy-preview-14--hugslinks-web-build.netlify.app';
const slots = { cover: [8, ['image/jpeg','image/png','image/webp','image/gif']], inside: [8, ['image/jpeg','image/png','image/webp','image/gif']], video: [25, ['video/mp4','video/webm']], audio: [8, ['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a','audio/x-wav']] };
const digest = s => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(32).toString('hex');
const validToken = s => /^[a-f0-9]{64}$/.test(s || '');
const validID = s => /^[a-f0-9]{32}$/.test(s || '');
const clean = (s, max) => typeof s === 'string' ? s.trim().slice(0,max) : '';
const email = s => { const e=clean(s,254).toLowerCase(); if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)) throw failure(400,'Enter a valid email address.'); return e; };
const equal = (a,b) => { const x=Buffer.from(a||''),y=Buffer.from(b||''); return x.length===y.length&&timingSafeEqual(x,y); };
const failure = (status,message) => Object.assign(new Error(message),{status});
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateCard(body) {
 const input=body.card || {},f=input.fields||{},fields={};
 for(const [key,max] of Object.entries({to:80,from:80,title:180,message:3000,occasion:80}))fields[key]=clean(f[key],max);
 for(const [key,values] of Object.entries({theme:['navy','rose','sage','violet'],titleStyle:['classic','modern','playful'],titlePosition:['top','center','bottom']}))fields[key]=values.includes(f[key])?f[key]:values[0];
 const media={};let total=0;
 for(const [slot,[max,types]] of Object.entries(slots))if(input.media?.[slot]){
  const m=input.media[slot];if(!Number.isInteger(m.size)||m.size<1||m.size>max*1024*1024||!types.includes(m.type))throw failure(400,`Unsupported ${slot} file or file too large.`);
  const parts=Math.ceil(m.size/CHUNK_SIZE);if(!Array.isArray(m.hashes)||m.hashes.length!==parts||m.hashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))throw failure(400,'Invalid upload manifest.');
  media[slot]={type:m.type,size:m.size,parts,hashes:m.hashes};total+=m.size;
 }
 if(total>49*1024*1024)throw failure(400,'This card is too large.');
 return {version:1,language:input.language==='es'?'es':'en',fields,media,musicEnabled:input.musicEnabled!==false,openingChime:input.openingChime!==false};
}
export function sessionFor(address,secret,now=Date.now()) { const data=Buffer.from(JSON.stringify({email:address,exp:now+86400000})).toString('base64url');return data+'.'+createHmac('sha256',secret).update(data).digest('hex'); }
export function readSession(value,secret,now=Date.now()) {
 try{const pieces=value.split('.');if(pieces.length!==2)return null;const [data,sig]=pieces;if(!equal(sig,createHmac('sha256',secret).update(data).digest('hex')))return null;const s=JSON.parse(Buffer.from(data,'base64url'));return s.exp>now?email(s.email):null;}catch{return null;}
}
export function mailContent(row,link) {
 const who=row.card.fields.from||'Someone who cares';
 const greeting=row.recipient_name?`Hi ${row.recipient_name},`:'A HUG has arrived!';
 const note=row.note||`${who} made this HUGS Card for you.`;
 return {subject:'A HUGS Card is waiting for you',text:`${greeting}\n\n${note}\n\nOpen your HUG: ${link}\n\nAvailable until ${new Date(row.expires_at).toISOString().slice(0,10)}. Anyone with this private link can open the card.\n\nGive a HUG. Get a HUG. — HUGSLinks`,html:`<div style="background:#091f38;color:#fff5e4;padding:36px;font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #d9b96f;border-radius:16px"><h1 style="color:#efd08a">HUGS Cards ♡</h1><h2>${escape(greeting)}</h2><p style="white-space:pre-wrap;line-height:1.7">${escape(note)}</p><p style="margin:32px 0"><a href="${escape(link)}" style="display:inline-block;padding:16px 24px;background:#efd08a;color:#091f38;border-radius:12px;text-decoration:none;font-weight:bold">Open your HUG</a></p><p>Your photos, video, and music are inside the card.</p><p style="color:#addaf0;font-size:13px">Available until ${new Date(row.expires_at).toISOString().slice(0,10)}. Keep this link private; anyone with the link can open it.</p><p>Give a HUG. Get a HUG.<br>HUGSLinks · Produced by Resile Corp</p></div>`};
}
export function makeStore(sql) {
 return {
  async init(){
   await sql`CREATE TABLE IF NOT EXISTS hugs_card_limits (key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`;
   await sql`CREATE TABLE IF NOT EXISTS hugs_card_codes (id TEXT PRIMARY KEY,email TEXT NOT NULL,code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ)`;
   await sql`CREATE TABLE IF NOT EXISTS hugs_private_cards (id TEXT PRIMARY KEY,owner TEXT NOT NULL,request_key TEXT NOT NULL,view_hash TEXT NOT NULL,card JSONB NOT NULL,recipient_email TEXT NOT NULL,recipient_name TEXT NOT NULL,note TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'uploading',email_state TEXT NOT NULL DEFAULT 'pending',email_started_at TIMESTAMPTZ,provider_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,deleted_at TIMESTAMPTZ,purged_at TIMESTAMPTZ,UNIQUE(owner,request_key))`;
  },
  async limit(key,max,seconds){const bucket=Math.floor(Date.now()/(seconds*1000));const [r]=await sql`INSERT INTO hugs_card_limits(key,hits,expires_at) VALUES(${key+':'+bucket},1,NOW()+(${seconds}*INTERVAL '1 second')) ON CONFLICT(key) DO UPDATE SET hits=hugs_card_limits.hits+1 RETURNING hits`;if(r.hits>max)throw failure(429,'Please wait before trying again. Your sending allowance is limited during the preview.');},
  async putCode(c){await sql`INSERT INTO hugs_card_codes(id,email,code_hash,expires_at) VALUES(${c.id},${c.email},${c.code_hash},${c.expires_at})`;},
  async attempt(id){return (await sql`UPDATE hugs_card_codes SET attempts=attempts+1 WHERE id=${id} AND used_at IS NULL AND expires_at>NOW() AND attempts<5 RETURNING *`)[0];},
  async useCode(id){return (await sql`UPDATE hugs_card_codes SET used_at=NOW() WHERE id=${id} AND used_at IS NULL RETURNING id`).length>0;},
  async find(owner,key){return (await sql`SELECT * FROM hugs_private_cards WHERE owner=${owner} AND request_key=${key}`)[0];},
  async get(id){return (await sql`SELECT * FROM hugs_private_cards WHERE id=${id}`)[0];},
  async create(c){return (await sql`INSERT INTO hugs_private_cards(id,owner,request_key,view_hash,card,recipient_email,recipient_name,note,expires_at) VALUES(${c.id},${c.owner},${c.request_key},${c.view_hash},${JSON.stringify(c.card)}::jsonb,${c.recipient_email},${c.recipient_name},${c.note},${c.expires_at}) ON CONFLICT(owner,request_key) DO UPDATE SET request_key=EXCLUDED.request_key RETURNING *`)[0];},
  async ready(id){await sql`UPDATE hugs_private_cards SET state='ready' WHERE id=${id} AND state='uploading' AND deleted_at IS NULL`;},
  async claimMail(id){return (await sql`UPDATE hugs_private_cards SET email_state='sending',email_started_at=NOW() WHERE id=${id} AND deleted_at IS NULL AND state='ready' AND (email_state='pending' OR (email_state='sending' AND email_started_at<NOW()-INTERVAL '2 minutes')) RETURNING id`).length>0;},
  async mailDone(id,provider){await sql`UPDATE hugs_private_cards SET email_state='sent',provider_id=${provider} WHERE id=${id}`;},
  async mailFailed(id){await sql`UPDATE hugs_private_cards SET email_state='pending' WHERE id=${id} AND email_state='sending'`;},
  async revoke(id){await sql`UPDATE hugs_private_cards SET deleted_at=COALESCE(deleted_at,NOW()) WHERE id=${id}`;},
  async purged(id){await sql`UPDATE hugs_private_cards SET purged_at=NOW(),card='{}'::jsonb,recipient_email='',recipient_name='',note='' WHERE id=${id}`;},
  async expired(){return await sql`SELECT * FROM hugs_private_cards WHERE purged_at IS NULL AND (deleted_at IS NOT NULL OR expires_at<NOW() OR (state='uploading' AND created_at<NOW()-INTERVAL '1 day')) LIMIT 20`;},
  async cleanCodes(){await sql`DELETE FROM hugs_card_codes WHERE expires_at<NOW()`;await sql`DELETE FROM hugs_card_limits WHERE expires_at<NOW()`;}
 };
}
// Media stays unreadable even if the existing R2 bucket has a public domain.
export function protectMedia(bytes,secret,identity){
 const key=createHmac('sha256',secret).update('hugs-private-media:'+identity).digest(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
}
export function openMedia(bytes,secret,identity){
 const key=createHmac('sha256',secret).update('hugs-private-media:'+identity).digest(),b=Buffer.from(bytes),cipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]);
}
export function storageFor(env) {
 const client=new S3Client({region:'auto',endpoint:`https://${env.HUGS_CARDS_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:env.HUGS_CARDS_R2_ACCESS_KEY_ID,secretAccessKey:env.HUGS_CARDS_R2_SECRET_ACCESS_KEY}}),Bucket=env.HUGS_CARDS_R2_BUCKET_NAME;
 const secret=env.HUGS_CARDS_STORAGE_SECRET||env.HUGS_CARDS_AUTH_SECRET;
 const key=(id,slot,part)=>`private-hugs/preview-14/${id}/${slot}/${part}`;
 return {
  async put(id,slot,part,bytes){await client.send(new PutObjectCommand({Bucket,Key:key(id,slot,part),Body:protectMedia(bytes,secret,id+'/'+slot+'/'+part),ContentType:'application/octet-stream'}));},
  async head(id,slot,part){return (await client.send(new HeadObjectCommand({Bucket,Key:key(id,slot,part)}))).ContentLength-28;},
  async get(id,slot,part){const bytes=await (await client.send(new GetObjectCommand({Bucket,Key:key(id,slot,part)}))).Body.transformToByteArray();return openMedia(bytes,secret,id+'/'+slot+'/'+part);},
  async remove(row){const Objects=Object.entries(row.card.media||{}).flatMap(([slot,m])=>Array.from({length:m.parts},(_,part)=>({Key:key(row.id,slot,part)})));if(Objects.length){const r=await client.send(new DeleteObjectsCommand({Bucket,Delete:{Objects}}));if(r.Errors?.length)throw Error('Storage cleanup incomplete');}}
 };
}
export function dependencies(env=process.env) {
 const secret=env.HUGS_CARDS_AUTH_SECRET;
 const apiKey=env.HUGS_CARDS_RESEND_API_KEY,from=env.HUGS_CARDS_EMAIL_FROM;
 const configured=!!(env.HUGS_CARDS_DATABASE_URL&&secret&&apiKey&&from&&['HUGS_CARDS_R2_ACCOUNT_ID','HUGS_CARDS_R2_ACCESS_KEY_ID','HUGS_CARDS_R2_SECRET_ACCESS_KEY','HUGS_CARDS_R2_BUCKET_NAME'].every(k=>env[k]));
 if(!configured)return {configured:false};
 return {configured:true,secret,store:makeStore(neon(env.HUGS_CARDS_DATABASE_URL)),storage:storageFor(env),async send(to,content,key){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from,to:[to],...content})});if(!r.ok)throw failure(502,'The email service could not accept this message. Your card is saved; try sending again shortly.');return (await r.json()).id;}};
}
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(status,body)=>Response.json(body,{status,headers});
async function body(req){if(Number(req.headers.get('content-length'))>30000)throw failure(413,'Request too large.');const text=await req.text();if(text.length>30000)throw failure(413,'Request too large.');try{return JSON.parse(text)}catch{throw failure(400,'Invalid request.')}}
function active(row){if(!row||row.deleted_at||new Date(row.expires_at).getTime()<=Date.now())throw failure(404,'This HUG is unavailable, removed, or expired.');return row;}
function partFor(row,url){const slot=url.searchParams.get('slot'),part=Number(url.searchParams.get('part')),m=row.card.media[slot];if(!m||!/^\d+$/.test(url.searchParams.get('part')||'')||!Number.isInteger(part)||part<0||part>=m.parts)throw failure(400,'Invalid media part.');return {slot,part,m,size:Math.min(CHUNK_SIZE,m.size-part*CHUNK_SIZE)};}
export function makeHandler(deps) {
 return async req=>{
  const url=new URL(req.url),action=url.searchParams.get('action')||'status';
  if(url.host!==PREVIEW)return json(403,{error:'Private card sending is available only on preview #14 while testing.'});
  if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)return json(403,{error:'Open this request from HUGSLinks.'});
  const expected=['status','view','part'].includes(action)?'GET':'POST';if(req.method!==expected)return json(405,{error:'Method not allowed.'});
  if(action==='status')return json(200,{configured:deps.configured,expiresInDays:DAYS,maxCardsPerDay:3});
  if(!deps.configured)return json(503,{error:'Card delivery needs storage, database, and verified email configuration. Your draft is still saved on this device.'});
  const {store,storage,secret}=deps;
  try{
   await store.init();
   if(action==='request-code'){
    const b=await body(req),address=email(b.email),ip=req.headers.get('x-nf-client-connection-ip')||'unknown';
    await store.limit('code-ip:'+digest(secret+ip),10,3600);await store.limit('code-mail:'+digest(address),3,3600);
    const id=randomBytes(16).toString('hex'),code=String(randomInt(100000,1000000));
    await store.putCode({id,email:address,code_hash:digest(secret+id+code),expires_at:new Date(Date.now()+10*60000).toISOString()});
    await deps.send(address,{subject:'Verify your HUGS Card sender email',text:`Your HUGS Cards verification code is ${code}. It expires in 10 minutes. This verifies your sender email; it does not send your card. If you did not request this, ignore this message.`},'hugs-verify-'+id);
    return json(200,{challenge:id,message:'Verification code sent. Check your inbox and spam folder.'});
   }
   if(action==='verify-code'){
    const b=await body(req);if(!validID(b.challenge)||!/^\d{6}$/.test(b.code||''))throw failure(400,'Enter the six-digit email code.');
    const c=await store.attempt(b.challenge);if(!c||!equal(c.code_hash,digest(secret+b.challenge+b.code))||!await store.useCode(c.id))throw failure(401,'Code incorrect, expired, or already used. Request another code if needed.');
    return json(200,{session:sessionFor(c.email,secret),email:c.email});
   }
   const bearer=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
   const id=url.searchParams.get('id');
   if(action==='view'||action==='part'){
    if(!validID(id)||!validToken(bearer))throw failure(404,'This HUG link is invalid.');
    const row=active(await store.get(id));if(!equal(row.view_hash,digest(bearer))||row.state!=='ready')throw failure(404,'This HUG is unavailable, removed, or expired.');
    if(action==='view')return json(200,{card:row.card,expiresAt:row.expires_at});
    const {slot,part}=partFor(row,url);return new Response(await storage.get(id,slot,part),{headers:{...headers,'Content-Type':'application/octet-stream'}});
   }
   const owner=readSession(bearer,secret);if(!owner)throw failure(401,'Verify your sender email to continue.');
   if(action==='create'){
    const b=await body(req);if(!/^[a-f0-9]{32}$/.test(b.requestKey||'')||!validToken(b.viewToken))throw failure(400,'Invalid card request.');
    const existing=await store.find(owner,b.requestKey);if(existing){active(existing);return json(200,{id:existing.id,ready:existing.state==='ready',expiresAt:existing.expires_at});}
    const card=validateCard(b),recipient_email=email(b.recipientEmail);
    await store.limit('create:'+digest(owner),3,86400);
    const row=await store.create({id:randomBytes(16).toString('hex'),owner,request_key:b.requestKey,view_hash:digest(b.viewToken),card,recipient_email,recipient_name:clean(b.recipientName,80),note:clean(b.note,500),expires_at:new Date(Date.now()+DAYS*86400000).toISOString()});
    return json(200,{id:row.id,ready:row.state==='ready',expiresAt:row.expires_at});
   }
   if(!validID(id))throw failure(400,'Invalid card.');
   const row=await store.get(id);if(!row||row.owner!==owner)throw failure(404,'Card not found.');
   if(action==='delete'){
    await store.revoke(id);await storage.remove(row);await store.purged(id);return json(200,{deleted:true});
   }
   active(row);
   if(action==='upload'){
    if(row.state!=='uploading')throw failure(409,'This saved card cannot be changed. Prepare a new card.');
    const {slot,part,m,size}=partFor(row,url);
    if(req.headers.get('content-type')!=='application/octet-stream'||Number(req.headers.get('content-length'))>CHUNK_SIZE)throw failure(413,'Invalid upload size.');
    const bytes=Buffer.from(await req.arrayBuffer());if(bytes.length!==size||digest(bytes)!==m.hashes[part])throw failure(400,'Upload part incomplete. Retry this part.');
    await storage.put(id,slot,part,bytes);return json(200,{uploaded:true});
   }
   if(action==='finish'){
    if(row.state!=='ready')for(const [slot,m] of Object.entries(row.card.media))for(let part=0;part<m.parts;part++){let size;try{size=await storage.head(id,slot,part);}catch{throw failure(409,'Some media is missing. Retry preparing this card.');}if(size!==Math.min(CHUNK_SIZE,m.size-part*CHUNK_SIZE))throw failure(409,'Some media is missing. Retry preparing this card.');}
    await store.ready(id);return json(200,{ready:true,expiresAt:row.expires_at});
   }
   if(action==='send'){
    const b=await body(req);if(!validToken(b.viewToken)||!equal(digest(b.viewToken),row.view_hash))throw failure(400,'Invalid card link.');
    if(row.state!=='ready')throw failure(409,'Finish uploading this card first.');
    if(row.email_state==='sent')return json(200,{accepted:true,alreadySent:true});
    if(!await store.claimMail(id))throw failure(409,'Your email is being prepared. Please check again shortly.');
    try{const link=url.origin+'/app/view-card.html#'+id+'.'+b.viewToken;const provider=await deps.send(row.recipient_email,mailContent(row,link),'hugs-card-'+id);await store.mailDone(id,provider);return json(200,{accepted:true});}
    catch(e){await store.mailFailed(id);throw e;}
   }
   throw failure(404,'Not found.');
  }catch(e){if(!e.status)console.error('Private HUG card request failed',{action,name:e.name});return json(e.status||500,{error:e.status?e.message:'Unable to save or open this card right now. Your local draft is safe; try again shortly.'});}
 };
}
