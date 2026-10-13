// HL Studio signed sessions. Session issuance/login must be implemented before launch.
import crypto from 'node:crypto';
export function studioUser(req){
 const secret=process.env.HL_STUDIO_SESSION_SECRET;
 if(!secret||secret.length<32)return null;
 const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hl_studio_session='));
 if(!cookie)return null;
 const token=cookie.slice('hl_studio_session='.length);
 const parts=token.split('.');if(parts.length!==2)return null;
 const [payload,sig]=parts;
 const digest=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
 const a=Buffer.from(sig),b=Buffer.from(digest);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
 if(typeof data.sub!=='string'||!data.sub||!Number.isFinite(data.exp)||Date.now()/1000>=data.exp)return null;
 return data.sub;}catch{return null}
}
