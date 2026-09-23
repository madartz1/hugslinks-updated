import {getStore,json} from "./_art-voter-auth.mjs";
const store=getStore("hugs-art-contests"),KEY="current";
const auth=r=>{const secret=process.env.HUGS_ADMIN_TOKEN||"",h=r.headers.get("authorization")||"";return !!secret&&h==="Bearer "+secret};
export default async request=>{
if(!auth(request))return json({ok:false,error:"Unauthorized"},401);
if(request.method==="GET")return json({ok:true,contest:await store.get(KEY,{type:"json",consistency:"strong"})});
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
const old=await store.get(KEY,{type:"json",consistency:"strong"});
if(b.action==="create"){
if(old&&old.status!=="closed")return json({ok:false,error:"Close the current contest first."},409);
const max=Number(b.max_entries);if(!Number.isInteger(max)||max<3||max>30)return json({ok:false,error:"Entry limit must be 3–30."},400);
const contest={id:crypto.randomUUID(),title:String(b.title||"HUGS Art Spotlight").trim().slice(0,120),max_entries:max,entries:[],status:"draft",created_at:new Date().toISOString(),winners:null};
await store.setJSON(KEY,contest);return json({ok:true,contest});
}
if(!old)return json({ok:false,error:"Create a contest first."},404);
if(b.action==="set_entries"){
if(old.status!=="draft")return json({ok:false,error:"Entries can only change in draft."},409);
const entries=[...new Set(Array.isArray(b.entries)?b.entries.map(String):[])];
const gallery=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});
const valid=new Set((gallery?.works||[]).filter(w=>w.published).map(w=>w.id));
if(entries.length<3||entries.length>old.max_entries||entries.some(id=>!valid.has(id)))return json({ok:false,error:"Select 3 to "+old.max_entries+" published works."},400);
old.entries=entries;
}else if(b.action==="open"){if(old.status!=="draft"||old.entries.length<3)return json({ok:false,error:"Add at least 3 entries first."},409);old.status="open";old.opened_at=new Date().toISOString();
}else if(b.action==="close"){if(old.status!=="open")return json({ok:false,error:"Contest is not open."},409);old.status="closed";old.closed_at=new Date().toISOString();
}else if(b.action==="publish_winners"){if(old.status!=="closed")return json({ok:false,error:"Close voting before publishing winners."},409);
const scores=await Promise.all(old.entries.map(async id=>{const votes=getStore("hugs-art-contest-votes");let cursor,n=0;do{const p=await votes.list({prefix:"vote-"+old.id+"-"+id+"-",paginate:true,cursor});n+=p.blobs.length;cursor=p.cursor}while(cursor);return {id,votes:n}}));
scores.sort((a,b)=>b.votes-a.votes||old.entries.indexOf(a.id)-old.entries.indexOf(b.id));
if(scores[0].votes===scores[1].votes||scores[1].votes===scores[2].votes||scores[2].votes===scores[3]?.votes)return json({ok:false,error:"A podium tie needs resolution before winners can be published.",scores},409);
old.winners=scores.slice(0,3).map((s,i)=>({...s,place:i+1}));old.published_at=new Date().toISOString();
}else return json({ok:false,error:"Unsupported action"},400);
await store.setJSON(KEY,old);return json({ok:true,contest:old});
};