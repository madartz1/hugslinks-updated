import crypto from 'node:crypto';
export const sessionCookie='hl_studio_session';
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function normalizeEmail(s){const e=String(s||'').trim().toLowerCase();return e.length<=254&&emailPattern.test(e)?e:null}
export function accountId(email){return 'hs_'+crypto.createHash('sha256').update('hugslinks-studio:'+email).digest('hex')}
function secret(){const s=process.env.HL_STUDIO_SESSION_SECRET;return s&&s.length>=32?s:null}
export function signStudioSession(userId){const s=secret();if(!s)throw Error('Missing session secret');const payload=Buffer.from(JSON.stringify({sub:userId,exp:Math.floor(Date.now()/1000)+86400,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',s).update(payload).digest('base64url')}
export function studioUser(req){const s=secret();if(!s)return null;const pair=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='));if(!pair)return null;const [payload,sig,...rest]=pair.slice(sessionCookie.length+1).split('.');if(rest.length||!payload||!sig)return null;const digest=crypto.createHmac('sha256',s).update(payload).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(digest);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;try{const d=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return typeof d.sub==='string'&&/^hs_[a-f0-9]{64}$/.test(d.sub)&&Number.isFinite(d.exp)&&Date.now()/1000<d.exp?d.sub:null}catch{return null}}
export const cookieOptions='Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400';
export function sameOrigin(req){try{const origin=req.headers.get('origin');const site=new URL(req.url);return origin!==null&&new URL(origin).origin===site.origin}catch{return false}}
