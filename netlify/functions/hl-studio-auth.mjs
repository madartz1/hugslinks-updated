import { modernHandler } from './_shared/hl-studio-modern.mjs';
import { neon } from '@neondatabase/serverless';
import { randomBytes, createHash, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
const json=(statusCode,data,headers={})=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers},body:JSON.stringify(data)});
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(name,value,age)=>`${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const configured=()=>!!(process.env.HL_STUDIO_DATABASE_URL&&process.env.HL_STUDIO_AUTH_SECRET&&process.env.HL_STUDIO_RESEND_API_KEY&&process.env.HL_STUDIO_EMAIL_FROM);
const SESSION_SECONDS=30*24*60*60;
const isPilotAdmin=email=>!!process.env.HL_STUDIO_PILOT_ADMIN_EMAIL&&email===process.env.HL_STUDIO_PILOT_ADMIN_EMAIL.trim().toLowerCase();
const generic={message:'If that email has a subscription, a sign-in link will arrive shortly.'};
const getCookie=(header,name)=>header?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const passwordDigest=async(password,salt)=>{const bytes=await scrypt(password,Buffer.from(salt,'hex'),64,{N:16384,r:8,p:1});return bytes.toString('hex')};
const validPassword=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
const safeEqual=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y)};
const legacyHandler=async event=>{
 const action=(event.queryStringParameters?.action||'').toLowerCase();
 if(!['request','verify','status','logout','setup-password','password-login','reset-request','reset-password'].includes(action))return json(404,{error:'Not found'});
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
  if(action==='reset-request'||action==='reset-password'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_passwords (email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_password_resets (token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
   if(action==='reset-request'){
    const email=String(body.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(400,{error:'Enter a valid email address'});
    const genericReset={message:'If this HL Studio account has a password, a reset link will be sent shortly.'};
    const eligible=await sql`SELECT 1 FROM hl_studio_passwords WHERE email=${email} LIMIT 1`;
    if(!eligible.length){
     if(!isPilotAdmin(email))return json(200,genericReset);
     await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_links (token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,used_at TIMESTAMPTZ)`;
     const token=secureToken(),tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+token);
     await sql`DELETE FROM hl_studio_auth_links WHERE email=${email} AND used_at IS NULL`;
     await sql`INSERT INTO hl_studio_auth_links(token_hash,email,expires_at) VALUES(${tokenHash},${email},NOW()+INTERVAL '15 minutes')`;
     const link=origin+'/studio/sign-in/?token='+encodeURIComponent(token)+'&returnTo='+encodeURIComponent('/studio/pilot-admin/sign-in/');
     const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.HL_STUDIO_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.HL_STUDIO_EMAIL_FROM,to:[email],subject:'Set up your HUGS Studio administrator password',html:'<div style="font-family:Arial,sans-serif;padding:24px;color:#102b45"><h2>HUGSLinks Studio</h2><p>Verify your administrator email to create your password.</p><p><a href="'+link+'">Verify email and create password</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p></div>',text:'Verify your HUGS Studio administrator email and create a password (15-minute link):\\n'+link})});
     if(!response.ok){console.error('HL Studio admin setup email failed',{status:response.status});return json(502,{error:'Unable to send administrator setup email. Check Resend sender configuration.'})}
     return json(200,{message:'Administrator setup email sent. Open the link to verify your email and create a password.'});
    }
    const recent=await sql`SELECT 1 FROM hl_studio_password_resets WHERE email=${email} AND created_at>NOW()-INTERVAL '5 minutes' LIMIT 1`;
    if(recent.length)return json(200,genericReset);
    const token=secureToken(),tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+'reset:'+token);
    await sql`DELETE FROM hl_studio_password_resets WHERE email=${email} AND used_at IS NULL`;
    await sql`INSERT INTO hl_studio_password_resets(token_hash,email,expires_at) VALUES(${tokenHash},${email},NOW()+INTERVAL '15 minutes')`;
    const resetReturn=body.returnTo==='/studio/pilot-admin/sign-in/'?'/studio/pilot-admin/sign-in/':'/studio/';
    const link=origin+'/studio/reset-password/?token='+encodeURIComponent(token)+'&returnTo='+encodeURIComponent(resetReturn);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.HL_STUDIO_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.HL_STUDIO_EMAIL_FROM,to:[email],subject:'Reset your HL Studio password',html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;color:#102b45"><h1>♡ HUGSLinks Studio</h1><p>We received a request to reset your HL Studio password.</p><p style="margin:30px 0"><a href="'+link+'" style="background:#087bbd;color:white;padding:15px 24px;text-decoration:none;border-radius:9px;font-weight:bold">Reset HL Studio password</a></p><p>This one-time link expires in 15 minutes. If you did not request this, ignore this email.</p><p style="font-size:13px;color:#567">HUGSLinks Studio · Produced by Resile Corp</p></div>',text:'HL Studio password reset (expires in 15 minutes):\n'+link+'\n\nIf you did not request this, ignore the message.'})});
    if(!response.ok){console.error('HL Studio password reset email failed',{status:response.status});return json(502,{error:'Unable to send password reset email. Check Resend configuration and sender verification.'})}
    return json(200,genericReset);
   }
   const token=String(body.token||''),password=body.password;
   if(!/^[a-f0-9]{64}$/.test(token)||!validPassword(password))return json(400,{error:'Invalid reset link or password. Use 12 to 128 characters'});
   const tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+'reset:'+token);
   const rows=await sql`UPDATE hl_studio_password_resets SET used_at=NOW() WHERE token_hash=${tokenHash} AND used_at IS NULL AND expires_at>NOW() RETURNING email`;
   if(!rows.length)return json(401,{error:'Reset link is expired or already used'});
   const email=rows[0].email,salt=randomBytes(32).toString('hex'),digest=await passwordDigest(password,salt);
   await sql`UPDATE hl_studio_passwords SET salt=${salt},password_hash=${digest},updated_at=NOW() WHERE email=${email}`;
   await sql`DELETE FROM hl_studio_auth_sessions WHERE email=${email}`;
   await sql`DELETE FROM hl_studio_password_resets WHERE email=${email} AND used_at IS NULL`;
   return json(200,{message:'Password updated. Sign in with your new password'},{'Set-Cookie':cookie('hl_studio_session','',0)});
  }
  if(action==='setup-password'||action==='password-login'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_passwords (email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_password_attempts (identity_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,window_started TIMESTAMPTZ NOT NULL DEFAULT NOW(),locked_until TIMESTAMPTZ)`;
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_sessions (session_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`;
   await sql`ALTER TABLE hl_studio_auth_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
   if(action==='setup-password'){
    const session=getCookie(headers.cookie||headers.Cookie,'hl_studio_session');
    if(!session||!/^[a-f0-9]{64}$/.test(session))return json(401,{error:'Verify your email before creating a password'});
    const sh=hash(process.env.HL_STUDIO_AUTH_SECRET+session);
    const rows=await sql`SELECT email FROM hl_studio_auth_sessions WHERE session_hash=${sh} AND expires_at>NOW() AND last_activity_at>NOW()-INTERVAL '1 hour' LIMIT 1`;
    if(!rows.length)return json(401,{error:'Your session expired. Verify your email to set a password'});
    if(!validPassword(body.password))return json(400,{error:'Use a password of 12 to 128 characters'});
    const exists=await sql`SELECT 1 FROM hl_studio_passwords WHERE email=${rows[0].email}`;
    if(exists.length)return json(409,{error:'A password is already configured. Sign in with your password'});
    const salt=randomBytes(32).toString('hex'),digest=await passwordDigest(body.password,salt);
    await sql`INSERT INTO hl_studio_passwords(email,salt,password_hash) VALUES(${rows[0].email},${salt},${digest}) ON CONFLICT DO NOTHING`;
    return json(200,{message:'Password created. You can now sign in without an email link'});
   }
   const email=String(body.email||'').trim().toLowerCase(),password=body.password;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length>128)return json(401,{error:'Invalid email or password'});
   const ip=(headers['x-nf-client-connection-ip']||headers['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,80);
   const identity=hash(process.env.HL_STUDIO_AUTH_SECRET+email+':'+ip);
   const lock=await sql`INSERT INTO hl_studio_password_attempts(identity_hash,attempts,window_started,locked_until) VALUES(${identity},0,NOW(),NULL) ON CONFLICT(identity_hash) DO UPDATE SET attempts=CASE WHEN hl_studio_password_attempts.window_started<NOW()-INTERVAL '15 minutes' THEN 0 ELSE hl_studio_password_attempts.attempts END,window_started=CASE WHEN hl_studio_password_attempts.window_started<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE hl_studio_password_attempts.window_started END RETURNING attempts,locked_until`;
   if(lock[0].locked_until&&new Date(lock[0].locked_until)>new Date())return json(429,{error:'Too many attempts. Try again in 15 minutes'});
   const rows=await sql`SELECT salt,password_hash FROM hl_studio_passwords WHERE email=${email}`;
   const salt=rows[0]?.salt||'00'.repeat(32),digest=await passwordDigest(password,salt);
   if(!rows.length||!safeEqual(digest,rows[0].password_hash)){
    await sql`UPDATE hl_studio_password_attempts SET attempts=attempts+1,locked_until=CASE WHEN attempts>=4 THEN NOW()+INTERVAL '15 minutes' ELSE locked_until END WHERE identity_hash=${identity}`;
    return json(401,{error:'Invalid email or password'});
   }
   const Stripe=(await import('stripe')).default;
   const stripe=new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
   const customers=await stripe.customers.list({email,limit:20});
   let subscribed=false;
   for(const c of customers.data){const found=await sql`SELECT 1 FROM hl_studio_subscriptions WHERE stripe_customer_id=${c.id} AND is_entitled=TRUE LIMIT 1`;if(found.length){subscribed=true;break}}
   if(!subscribed&&!isPilotAdmin(email))return json(403,{error:'An active HL Studio subscription is required'});
   await sql`DELETE FROM hl_studio_password_attempts WHERE identity_hash=${identity}`;
   const session=secureToken(),sessionHash=hash(process.env.HL_STUDIO_AUTH_SECRET+session);
   await sql`INSERT INTO hl_studio_auth_sessions(session_hash,email,expires_at) VALUES(${sessionHash},${email},NOW()+INTERVAL '30 days')`;
   return json(200,{message:'Signed in'}, {'Set-Cookie':cookie('hl_studio_session',session,SESSION_SECONDS)});
  }
  if(action==='request'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let input;try{input=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   const email=String(input.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(400,{error:'Enter a valid email'});
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_links (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ)`;
   await sql`CREATE TABLE IF NOT EXISTS hl_studio_auth_sessions (session_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`;
   await sql`ALTER TABLE hl_studio_auth_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
   const rows=await sql`SELECT 1 FROM hl_studio_subscriptions WHERE stripe_customer_id IN (SELECT stripe_customer_id FROM hl_studio_subscriptions WHERE is_entitled=TRUE) LIMIT 0`;
   const stripeKey=process.env.HL_STUDIO_STRIPE_SECRET_KEY;
   if(!stripeKey)return json(503,{error:'Stripe configuration missing'});
   const Stripe=(await import('stripe')).default;
   const stripe=new Stripe(stripeKey);
   const customers=await stripe.customers.list({email,limit:20});
   const customerIds=customers.data.map(c=>c.id);
   let subscribed=false;
   for(const id of customerIds){const found=await sql`SELECT 1 FROM hl_studio_subscriptions WHERE stripe_customer_id=${id} AND is_entitled=TRUE LIMIT 1`;if(found.length){subscribed=true;break}}
   if(subscribed||isPilotAdmin(email)){
    const token=secureToken(),tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+token);
    await sql`DELETE FROM hl_studio_auth_links WHERE email=${email} AND used_at IS NULL`;
    await sql`INSERT INTO hl_studio_auth_links (token_hash,email,expires_at) VALUES (${tokenHash},${email},NOW()+INTERVAL '15 minutes')`;
    const returnTo=(input.returnTo==='/studio/pilot-admin/'||input.returnTo==='/studio/pilot-admin/sign-in/')?'&returnTo='+encodeURIComponent('/studio/pilot-admin/sign-in/') : '';
    const link=origin+'/studio/sign-in/?token='+encodeURIComponent(token)+returnTo;
    const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.HL_STUDIO_RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.HL_STUDIO_EMAIL_FROM,to:[email],subject:'Your HL Studio secure sign-in link',html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;color:#102b45"><h1 style="color:#102b45">HUGSLinks Studio</h1><p>Welcome back to HL Studio.</p><p>Use the secure button below to access your member dashboard.</p><p style="margin:30px 0"><a href="'+link+'" style="background:#087bbd;color:white;padding:15px 24px;text-decoration:none;border-radius:9px;font-weight:bold">Sign in to HL Studio</a></p><p>This link expires in 15 minutes and works once. For security, your session becomes inactive after one hour without activity.</p><p style="color:#567;font-size:13px">If you did not request this email, you can ignore it. HUGSLinks Studio · Produced by Resile Corp</p></div>',text:'HUGSLinks Studio — secure member sign-in\n\nOpen your HL Studio sign-in link (expires in 15 minutes):\n'+link+'\n\nYour session becomes inactive after one hour without activity. If you did not request this email, ignore it.'})});
    if(!result.ok){console.error('HL Studio auth email failed',{status:result.status});return json(502,{error:'Unable to send sign-in email'})}
   }
   return json(200,generic);
  }
  if(action==='verify'){
   if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
   let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid request'})}
   await sql`ALTER TABLE hl_studio_auth_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
   const token=String(body.token||'');
   if(!/^[a-f0-9]{64}$/.test(token))return json(401,{error:'Invalid or expired link'});
   const tokenHash=hash(process.env.HL_STUDIO_AUTH_SECRET+token);
   const rows=await sql`UPDATE hl_studio_auth_links SET used_at=NOW() WHERE token_hash=${tokenHash} AND used_at IS NULL AND expires_at>NOW() RETURNING email`;
   if(!rows.length)return json(401,{error:'Invalid or expired link'});
   const session=secureToken(),sessionHash=hash(process.env.HL_STUDIO_AUTH_SECRET+session);
   await sql`INSERT INTO hl_studio_auth_sessions (session_hash,email,expires_at) VALUES (${sessionHash},${rows[0].email},NOW()+INTERVAL '30 days')`;
   return json(200,{message:'Signed in'}, {'Set-Cookie':cookie('hl_studio_session',session,SESSION_SECONDS)});
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
  await sql`ALTER TABLE hl_studio_auth_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  const rows=await sql`UPDATE hl_studio_auth_sessions SET last_activity_at=NOW() WHERE session_hash=${sh} AND expires_at>NOW() AND last_activity_at>NOW()-INTERVAL '1 hour' RETURNING email`;
  if(!rows.length)return json(200,{authenticated:false},{'Set-Cookie':cookie('hl_studio_session','',0)});
  const email=rows[0].email;
  let subscription=null;
  if(!isPilotAdmin(email)){
   const Stripe=(await import('stripe')).default;
   const stripe=new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
   const customers=await stripe.customers.list({email,limit:20});
   for(const c of customers.data){const found=await sql`SELECT plan,stripe_status FROM hl_studio_subscriptions WHERE stripe_customer_id=${c.id} AND is_entitled=TRUE ORDER BY updated_at DESC LIMIT 1`;if(found.length){subscription=found[0];break}}
  }
  await sql`CREATE TABLE IF NOT EXISTS hl_studio_passwords (email TEXT PRIMARY KEY,salt TEXT NOT NULL,password_hash TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const passwordRows=await sql`SELECT 1 FROM hl_studio_passwords WHERE email=${email} LIMIT 1`;
  return json(200,{authenticated:true,email,entitled:!!subscription||isPilotAdmin(email),plan:subscription?.plan||(isPilotAdmin(email)?'pilot-admin':null),status:subscription?.stripe_status||null,hasPassword:passwordRows.length>0});
 }catch(e){console.error('HL Studio auth error',{category:e?.name||'unknown'});return json(500,{error:'Unable to complete sign-in'})}
};
export default modernHandler(legacyHandler);
