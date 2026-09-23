import {getStore,json,digest,session} from "./_art-voter-auth.mjs";
const votes=getStore("hugs-art-votes");
async function score(id){
 let cursor, count=0, sum=0;
 do{const page=await votes.list({prefix:"vote-"+id+"-",paginate:true,cursor});for(const blob of page.blobs){const v=await votes.get(blob.key,{type:"json",consistency:"strong"});if(Number.isInteger(v?.rating)&&v.rating>=1&&v.rating<=5){count++;sum+=v.rating}}cursor=page.cursor}while(cursor);
 return {id,votes:count,rating_count:count,rating_sum:sum,average:count?sum/count:0};
}
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET)return json({ok:false,error:"Voting not configured"},503);
const gallery=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});
const works=(gallery?.works||[]).filter(w=>w.published===true);
if(request.method==="GET")return json({ok:true,scores:await Promise.all(works.map(w=>score(w.id)))});
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
const email=await session(request);if(!email)return json({ok:false,error:"Sign in with email before voting."},401);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const id=String(b.artwork_id||""),rating=Number(b.rating);
if(!works.some(w=>w.id===id)||!Number.isInteger(rating)||rating<1||rating>5)return json({ok:false,error:"Choose a published artwork and a rating from 1 to 5."},400);
const user=await digest(email+":"+process.env.HUGS_VOTER_SESSION_SECRET),key="vote-"+id+"-"+user;
const previous=await votes.get(key,{type:"json",consistency:"strong"});
if(previous)return json({ok:false,error:"You already voted for this artwork."},409);
await votes.setJSON(key,{rating,created_at:new Date().toISOString()});
const result=await score(id);
return json({ok:true,artwork_id:id,votes:result.votes,average:result.average});
};