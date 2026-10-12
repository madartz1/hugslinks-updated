import { neon } from '@neondatabase/serverless';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
const json=(statusCode,data,headers={})=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers},body:JSON.stringify(data)});
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(name,value,age)=>`${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const configured=()=>!!(process.env.HL_STUDIO_DATABASE_URL&&process.env.HL_STUDIO_AUTH_SECRET&&process.env.RESEND_API_KEY&&process.env.HL_STUDIO_EMAIL_FROM);
const generic={message:'If that email has a subscription, a sign-in link will arrive shortly.'};
const getCookie=(header,name)=>header?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const safeEqual=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)};
export const handler=async event=>{
 const action=(event.queryStringParameters?.action||'').toLowerCase();
 if(!['request','verify','status','logout'].includes(action))return json(404,{error:'Not found'});
 if(!configured())return json(503,{error:'Subscriber sign-in not configured'});
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 const headers=event.headers||{};
 const host=headers.host||'';
 const isPreview=/^deploy-preview-14--hugslinks-web-build\.netlify\.app$/i.test(host);
 const origin=isPreview?'https://'+host:'';
 if(!origin)return json(403,{error:'Unsupported host'});
 const ua=headers['user-agent']||'';
 const secureToken=()=>randomBytes(32).toString('hex');
 try{
  if(action==='request'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let input;try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   const email=String(input.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(400,{error:'Enter a valid email'});
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_links (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ)`;
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_sessions (session_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`;
   const rows=await sql`SELECT 1 FROM hl_studio_subscriptions WHERE stripe_customer_id IN (SELECT stripe_customer_id FROM hl_studio_subscriptions WHERE is_entitled=TRUE) LIMIT 0`;
   const stripeKey=process.env.HL_STUDIO_STRIPE_SECRET_KEY;
   if(!stripeKey)return json(503,{error:'Stripe configuration missing'});
   const Stripe=(await import('stripe')).default;
   const stripe=new Stripe(stripeKey);
   const customers=await stripe.customers.list({email,limit:20});
   const customerIds=customers.data.map(c=>c.id);
   let subscribed=false;
   for(const id of customerIds){const found=await sql`SELECT 1 FROM hl_studio_subscriptions WHERE stripe_customer_id=${id} AND is_entitled=TRUE LIMIT 1`;if(found.length){subscribed=true;break}}
   if(subscribed){
    const token=secureToken(),tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+token);
    await sql`DELETE FROM hl_studio_auth_links WHERE email=${email} AND used_at IS NULL`;
    await sql`INSERT INTO hl_studio_auth_links (token_hash,email,expires_at) VALUES (${tokenHash},${email},NOW()+INTERVAL '15 minutes')`;
    const link=origin+'/studio/?login_token='+encodeURIComponent(token);
    const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.HL_STUDIO_EMAIL_FROM,to:[email],subject:'Sign in to HL Studio',text:'Your one-time HL Studio sign-in link (expires in 15 minutes):\n'+link+'\n\nIf you did not request this, ignore this email.'})});
    if(!result.ok){console.error('HL Studio auth email failed',{status:result.status});return json(502,{error:'Unable to send sign-in email'})}
   }
   return json(200,generic);
  }
  if(action==='verify'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   const token=String(body.token||'');
   if(!/^[a-f0-9]{64}$/.test(token))return json(401,{error:'Invalid or expired link'});
   const tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+token);
   const rows=await sql`UPDATE hl_studio_auth_links SET used_at=NOW() WHERE token_hash=${tokenHash} AND used_at IS NULL AND expires_at>NOW() RETURNING email`;
   if(!rows.length)return json(401,{error:'Invalid or expired link'});
   const session=secureToken(),sessionHash=hash(process.env.HL_STUDIO_AUTH_SECRET+session);
   await sql`INSERT INTO hl_studio_auth_sessions (session_hash,email,expires_at) VALUES (${sessionHash},${rows[0].email},NOW()+INTERVAL '7 days')`;
   return json(200,{message:'Signed in'}, {'Set-Cookie':cookie('hl_studio_session',session,604800)});
  }
  const session=getCookie(headers.cookie||headers.Cookie,'hl_studio_session');
  if(action==='logout'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   if(session&&/^[a-f0-9]{64}$/.test(session)){const sh=hash(process.env.HL_STUDIO_AUTH_SECRET+session);await sql`DELETE FROM hl_studio_auth_sessions WHERE session_hash=${sh}`}
   return json(200,{message:'Signed out'},{'Set-Cookie':cookie('hl_studio_session','',0)});
  }
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
  if(!session||!/^[a-f0-9]{64}$/.test(session))return json(200,{authenticated:false});
  const sh=hash(process.env.HL_STUDIO_AUTH_SECRET+session);
  const rows=await sql`SELECT email FROM hl_studio_auth_sessions WHERE session_hash=${sh} AND expires_at>NOW() LIMIT 1`;
  if(!rows.length)return json(200,{authenticated:false});
  const email=rows[0].email;
  const Stripe=(await import('stripe')).default;
  const stripe=new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
  const customers=await stripe.customers.list({email,limit:20});
  let subscription=null;
  for(const c of customers.data){const found=await sql`SELECT plan,stripe_status FROM hl_studio_subscriptions WHERE stripe_customer_id=${c.id} AND is_entitled=TRUE ORDER BY updated_at DESC LIMIT 1`;if(found.length){subscription=found[0];break}}
  return json(200,{authenticated:true,email,entitled:!!subscription,plan:subscription?.plan||null,status:subscription?.stripe_status||null});
 }catch(e){console.error('HL Studio auth error',{category:e?.name||'unknown'});return json(500,{error:'Unable to complete sign-in'})}
};