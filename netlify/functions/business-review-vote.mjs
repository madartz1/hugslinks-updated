import { getStore } from "@netlify/blobs";
const store=getStore("hugs-business-reviews");
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...headers}});
const BUSINESSES={
  "champion-pizza-flushing":{
    id:"champion-pizza-flushing",name:"Champion Pizza",neighborhood:"Flushing, Queens",
    address:"136-31 Roosevelt Ave, Flushing, NY 11354",editorial_status:"HUGS Approved"
  }
};
const cookieValue=(req,name)=>(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)||"";
const validId=x=>/^[a-z0-9-]{3,80}$/.test(x||"");
const counts=async id=>{
  const data=await store.get("business:"+id,{type:"json",consistency:"strong"})||{hug:0,no_hug:0};
  const hug=Number(data.hug)||0,no_hug=Number(data.no_hug)||0,total=hug+no_hug;
  return{hug,no_hug,total,hug_percent:total?Math.round(hug/total*100):0};
};
export default async request=>{
  const url=new URL(request.url),id=url.searchParams.get("business")||"champion-pizza-flushing",business=BUSINESSES[id];
  if(!business||!validId(id))return json({ok:false,error:"Business not found."},404);
  if(request.method==="GET")return json({ok:true,business,results:await counts(id),your_vote:cookieValue(request,"hugs_review_"+id)||null});
  if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
  const vote=body?.vote;
  if(!["hug","no_hug"].includes(vote))return json({ok:false,error:"Choose HUG or NO HUG."},400);
  const cookieName="hugs_review_"+id;
  if(cookieValue(request,cookieName))return json({ok:false,error:"You already voted on this business.",business,results:await counts(id)},409);
  const data=await store.get("business:"+id,{type:"json",consistency:"strong"})||{hug:0,no_hug:0};
  data[vote]=(Number(data[vote])||0)+1; data.updated_at=new Date().toISOString();
  await store.setJSON("business:"+id,data);
  return json({ok:true,business,results:await counts(id),your_vote:vote},200,{"Set-Cookie":cookieName+"="+vote+"; Path=/; Max-Age=31536000; Secure; SameSite=Lax"});
};