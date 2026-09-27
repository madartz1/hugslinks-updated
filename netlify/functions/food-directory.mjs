import { getStore } from "@netlify/blobs";
const STORE="hugs-food-directory",KEY="listings";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=0, s-maxage=300, stale-while-revalidate=3600"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export default async request=>{
 if(request.method!=="GET") return json({ok:false,error:"Method not allowed."},405);
 try{
  const store=getStore(STORE);
  const x=await store.get(KEY,{type:"json",consistency:"strong"});
  const all=Array.isArray(x?.listings)?x.listings:Array.isArray(x)?x:[];
  const listings=all.filter(x=>x&&x.published===true&&x.status!=="Inactive").map(x=>({
   id:x.id,name:x.name,category:x.category||"Food Resource",description:x.description||"",
   address:x.address||"",borough:x.borough||"",phone:x.phone||"",website:x.website||"",
   latitude:Number.isFinite(Number(x.latitude))?Number(x.latitude):null,
   longitude:Number.isFinite(Number(x.longitude))?Number(x.longitude):null,
   dietary:Array.isArray(x.dietary)?x.dietary:[],features:Array.isArray(x.features)?x.features:[],
   price_level:x.price_level||"",hours:x.hours||"",source_label:x.source_label||"HUGS Verified",
   last_verified:x.last_verified||x.updated_at||x.created_at||null,partner_status:x.partner_status||"Resource"
  }));
  return json({ok:true,updated_at:x?.updated_at||null,listings});
 }catch(e){console.error("Food directory error:",e);return json({ok:false,error:"Food directory unavailable."},500)}
};