import {neon} from "@neondatabase/serverless";
import {getStore,json,digest,session} from "./_art-voter-auth.mjs";
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET||!process.env.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:"Voting not configured"},503);
const sql=neon(process.env.HUGS_VOTING_DATABASE_URL);
const gallery=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});
const works=(gallery?.works||[]).filter(w=>w.published===true);
if(request.method==="GET"){try{
const rows=await sql`SELECT artwork_id,COUNT(*)::int AS votes,SUM(rating)::int AS rating_sum FROM hugs_art_ratings GROUP BY artwork_id`;
const counts=new Map(rows.map(r=>[r.artwork_id,r]));return json({ok:true,scores:works.map(w=>({id:w.id,votes:counts.get(w.id)?.votes||0,rating_count:counts.get(w.id)?.votes||0,rating_sum:counts.get(w.id)?.rating_sum||0}))});
}catch(e){console.error(e);return json({ok:false,error:"Ratings temporarily unavailable."},503)}}
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
const email=await session(request);if(!email)return json({ok:false,error:"Sign in before rating."},401);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const id=String(b.artwork_id||""),rating=Number(b.rating);
if(!works.some(w=>w.id===id)||!Number.isInteger(rating)||rating<1||rating>5)return json({ok:false,error:"Choose published artwork and a 1–5 star rating."},400);
const hash=await digest(email+":"+process.env.HUGS_VOTER_SESSION_SECRET);
try{const rows=await sql`INSERT INTO hugs_art_ratings(artwork_id,voter_hash,rating) VALUES(${id},${hash},${rating}) ON CONFLICT DO NOTHING RETURNING artwork_id`;
if(!rows.length)return json({ok:false,error:"You have already rated this artwork."},409);
const [score]=await sql`SELECT COUNT(*)::int AS votes,AVG(rating)::float AS average FROM hugs_art_ratings WHERE artwork_id=${id}`;
return json({ok:true,artwork_id:id,votes:score.votes,average:score.average});
}catch(e){console.error(e);return json({ok:false,error:"Rating temporarily unavailable."},503)}
};