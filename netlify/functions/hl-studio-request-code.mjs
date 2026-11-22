import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {Resend} from 'resend';
import {normalizeEmail,sameOrigin} from './_hl-studio-auth.mjs';
const headers={'Cache-Control':'no-store'};
const generic={message:'If this email can receive messages, a HUGSLinks Studio sign-in code has been sent.'};
export default async function(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin'},{status:403,headers});
 if(process.env.HL_STUDIO_AUTH_ENABLED!=='true')return Response.json({error:'Studio sign-in is not available yet'},{status:503,headers});
 if(!process.env.HL_STUDIO_DATABASE_URL||!process.env.RESEND_API_KEY||!process.env.HL_STUDIO_FROM_EMAIL)return Response.json({error:'Studio sign-in is not configured'},{status:503,headers});
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid request'},{status:400,headers})}
 const email=normalizeEmail(body?.email);if(!email)return Response.json({error:'Enter a valid email address'},{status:400,headers});
 const token=String(crypto.randomInt(0,1000000)).padStart(6,'0');
 const digest=crypto.createHash('sha256').update(email+':'+token+':'+process.env.HL_STUDIO_SESSION_SECRET).digest('hex');
 try{
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 const rows=await sql`INSERT INTO hl_studio_login_codes(email,token_digest,expires_at,attempts,last_sent_at)
 VALUES(${email},${digest},NOW()+INTERVAL '10 minutes',0,NOW())
 ON CONFLICT(email) DO UPDATE SET token_digest=EXCLUDED.token_digest,expires_at=EXCLUDED.expires_at,attempts=0,last_sent_at=NOW()
 WHERE hl_studio_login_codes.last_sent_at<NOW()-INTERVAL '60 seconds'
 RETURNING email`;
 if(!rows.length)return Response.json(generic,{headers});
 const mail=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.HL_STUDIO_FROM_EMAIL,to:email,subject:'Your HUGSLinks Studio sign-in code',text:'Your HUGSLinks Studio code is '+token+'. It expires in 10 minutes. If you did not request this, ignore this message.'});
 if(mail.error)throw Error('Email provider unavailable');
 return Response.json(generic,{headers});
 }catch(e){console.error('Studio email login request failed',e);return Response.json({error:'Unable to send sign-in code'},{status:503,headers})}
}
