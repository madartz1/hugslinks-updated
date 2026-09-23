import {neon} from "@neondatabase/serverless";
import {getStore,json} from "./_art-voter-auth.mjs";
const authorized=r=>{const secret=process.env.HUGS_ADMIN_TOKEN||"";return !!secret&&r.headers.get("authorization")==="Bearer "+secret};
export default async request=>{
if(!authorized(request))return json({ok:false,error:"Unauthorized"},401);
if(request.method!=="GET")return json({ok:false,error:"Method not allowed"},405);
const checks={admin_token:true,session_secret:!!process.env.HUGS_VOTER_SESSION_SECRET,resend_api_key:!!process.env.RESEND_API_KEY,verified_sender_configured:!!process.env.HUGS_VOTER_FROM_EMAIL,database_url:!!process.env.HUGS_VOTING_DATABASE_URL,database_tables:false,gallery_access:false};
try{const g=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});checks.gallery_access=!!g||g===null}catch{}
if(checks.database_url){try{const sql=neon(process.env.HUGS_VOTING_DATABASE_URL);const r=await sql`SELECT to_regclass('public.hugs_contest_votes') IS NOT NULL AS contests, to_regclass('public.hugs_art_ratings') IS NOT NULL AS ratings`;checks.database_tables=!!r[0]?.contests&&!!r[0]?.ratings}catch{}}
return json({ok:true,checks,ready_for_private_testing:Object.values(checks).every(Boolean)});
};