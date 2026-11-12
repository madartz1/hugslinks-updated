import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {normalizeEmail,accountId,signStudioSession,sessionCookie,cookieOptions,sameOrigin} from './_hl-studio-auth.mjs';
export default async function(req){
 const headers={'Cache-Control':'no-store'};
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin'},{status:403,headers});
 if(process.env.HL_STUDIO_AUTH_ENABLED!=='true'||!process.env.HL_STUDIO_DATABASE_URL)return Response.json({error:'Sign-in unavailable'},{status:503,headers});
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid request'},{status:400,headers})}
 const email=normalizeEmail(body?.email),code=String(body?.code||'');
 if(!email||!/^[0-9]{6}$/.test(code))return Response.json({error:'Invalid code'},{status:400,headers});
 const digest=crypto.createHash('sha256').update(email+':'+code+':'+process.env.HL_STUDIO_SESSION_SECRET).digest('hex');
 try{
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 // A failed guess consumes an attempt. Concurrent attempts serialize on the email row.
 const rows=await sql`
 DELETE FROM hl_studio_login_codes
 WHERE email=${email} AND token_digest=${digest} AND expires_at>NOW() AND attempts<5
 RETURNING email`;
 if(!rows.length){
   await sql`UPDATE hl_studio_login_codes SET attempts=attempts+1 WHERE email=${email} AND expires_at>NOW() AND attempts<5`;
   return Response.json({error:'Code expired or invalid'},{status:401,headers});
 }
 const token=signStudioSession(accountId(email));
 return Response.json({ok:true},{headers:{...headers,'Set-Cookie':sessionCookie+'='+token+'; '+cookieOptions}});
 }catch(e){console.error('Studio sign-in verification failed',e);return Response.json({error:'Sign-in unavailable'},{status:503,headers})}
}
