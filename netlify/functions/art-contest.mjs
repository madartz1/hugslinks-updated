import {neon} from "@neondatabase/serverless";
import {getStore,json,digest,session} from "./_art-voter-auth.mjs";
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET||!process.env.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:"Voting not configured"},503);
const sql=neon(process.env.HUGS_VOTING_DATABASE_URL);
const c=await getStore("hugs-art-contests").get("current",{type:"json",consistency:"strong"});
if(request.method==="GET"){
 if(!c)return json({ok:true,contest:null,scores:[]});
 const rows=await sql`SELECT artwork_id,COUNT(*)::int AS votes FROM hugs_contest_votes WHERE contest_id=${c.id} GROUP BY artwork_id`;
 const counts=new Map(rows.map(r=>[r.artwork_id,r.votes]));
 return json({ok:true,contest:{id:c.id,title:c.title,max_entries:c.max_entries,status:c.status,entries:c.entries,winners:c.winners||null},scores:c.entries.map(id=>({id,votes:counts.get(id)||0}))});
}
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
const email=await session(request);if(!email)return json({ok:false,error:"Sign in before voting."},401);
if(!c||c.status!=="open")return json({ok:false,error:"Contest voting is not open."},409);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const id=String(b.artwork_id||"");if(!c.entries.includes(id))return json({ok:false,error:"Artwork is not entered in this contest."},400);
const hash=await digest(email+":"+process.env.HUGS_VOTER_SESSION_SECRET);
try{
const rows=await sql`INSERT INTO hugs_contest_votes(contest_id,artwork_id,voter_hash) VALUES(${c.id},${id},${hash}) ON CONFLICT DO NOTHING RETURNING artwork_id`;
if(!rows.length)return json({ok:false,error:"You have already voted in this contest."},409);
return json({ok:true,message:"Your competition vote was recorded."});
}catch(e){console.error("Contest vote database error",e);return json({ok:false,error:"Voting temporarily unavailable."},503)}
};