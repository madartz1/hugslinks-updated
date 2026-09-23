import {getStore,json,digest,session} from "./_art-voter-auth.mjs";
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET)return json({ok:false,error:"Voting not configured"},503);
const gallery=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});
const works=(gallery?.works||[]).filter(w=>w.published===true);
const store=getStore("hugs-art-votes");
if(request.method==="GET"){
const scores=await Promise.all(works.map(async w=>{const r=await store.get("score-"+w.id,{type:"json",consistency:"strong"});return {id:w.id,votes:r?.votes||0,rating_count:r?.rating_count||0,rating_sum:r?.rating_sum||0}}));
return json({ok:true,scores});
}
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
const email=await session(request);if(!email)return json({ok:false,error:"Sign in with email before voting."},401);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const id=String(b.artwork_id||""),rating=Number(b.rating);
if(!works.some(w=>w.id===id)||!Number.isInteger(rating)||rating<1||rating>5)return json({ok:false,error:"Choose a published artwork and a rating from 1 to 5."},400);
const user=await digest(email+":"+process.env.HUGS_VOTER_SESSION_SECRET),voteKey="vote-"+id+"-"+user;
const previous=await store.get(voteKey,{type:"json",consistency:"strong"});
if(previous)return json({ok:false,error:"You already voted for this artwork."},409);
await store.setJSON(voteKey,{rating,created_at:new Date().toISOString()});
const scoreKey="score-"+id,s=await store.get(scoreKey,{type:"json",consistency:"strong"})||{votes:0,rating_count:0,rating_sum:0};
s.votes++;s.rating_count++;s.rating_sum+=rating;
await store.setJSON(scoreKey,s);
return json({ok:true,artwork_id:id,votes:s.votes,average:s.rating_sum/s.rating_count});
};