import {getStore,json,digest,session} from "./_art-voter-auth.mjs";
const contestStore=getStore("hugs-art-contests"),votes=getStore("hugs-art-contest-votes");
async function tally(contest){return Promise.all(contest.entries.map(async id=>{let cursor,n=0;do{const p=await votes.list({prefix:"vote-"+contest.id+"-"+id+"-",paginate:true,cursor});n+=p.blobs.length;cursor=p.cursor}while(cursor);return {id,votes:n}}))}
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET)return json({ok:false,error:"Voting not configured"},503);
const c=await contestStore.get("current",{type:"json",consistency:"strong"});
if(request.method==="GET"){if(!c)return json({ok:true,contest:null,scores:[]});return json({ok:true,contest:{id:c.id,title:c.title,max_entries:c.max_entries,status:c.status,entries:c.entries,winners:c.winners||null},scores:await tally(c)})}
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
const email=await session(request);if(!email)return json({ok:false,error:"Sign in before voting."},401);
if(!c||c.status!=="open")return json({ok:false,error:"Contest voting is not open."},409);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const id=String(b.artwork_id||"");if(!c.entries.includes(id))return json({ok:false,error:"Artwork is not entered in this contest."},400);
const user=await digest(email+":"+process.env.HUGS_VOTER_SESSION_SECRET);
const key="member-"+c.id+"-"+user,prior=await votes.get(key,{type:"json",consistency:"strong"});
if(prior)return json({ok:false,error:"You have already voted in this contest."},409);
await votes.setJSON(key,{artwork_id:id,created_at:new Date().toISOString()});
await votes.setJSON("vote-"+c.id+"-"+id+"-"+user,{created_at:new Date().toISOString()});
return json({ok:true,message:"Your contest vote was recorded."});
};