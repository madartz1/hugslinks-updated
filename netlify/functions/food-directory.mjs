import { getStore } from "@netlify/blobs";
const STORE="hugs-food-directory",KEY="listings";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=0, s-maxage=300, stale-while-revalidate=3600"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});

const seedListings=[
 {id:"HFD-SEED-ASTORIA-PANTRY",name:"Astoria Food Pantry",category:"Food Pantry",description:"Volunteer-run mutual-aid pantry and community resource center serving Astoria.",address:"25-82 Steinway Street, Astoria, NY 11103",borough:"Queens",phone:"",website:"https://www.astoriafoodpantry.com/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Support"],price_level:"Free",hours:"Food pantry: Mon 8–10:30am, Tue 6:30–7:30pm, Sat 1–2pm. Check provider before traveling.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-CONNECTED-CHEF",name:"The Connected Chef",category:"Grocery / Market",description:"Queens nonprofit offering sliding-scale fresh groceries, local produce, pickup/delivery programs and a Community Fresh Market.",address:"37-31 58th Street, Woodside, NY 11377",borough:"Queens",phone:"(347) 428-5225",website:"https://www.connectedchef.org/",latitude:null,longitude:null,dietary:["Vegetarian","Vegan","Fresh Produce","Healthy Options"],features:["Low-Cost Meals","Community Support"],price_level:"Sliding scale",hours:"Community Fresh Market: Thu–Fri 2–6pm, Sat 11am–3pm. Check provider for current program availability.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-QUEENS-TOGETHER",name:"Queens Together",category:"Community Organization",description:"Queens nonprofit combining food relief, restaurant support and community programs rooted in local partnerships.",address:"Queens, New York",borough:"Queens",phone:"",website:"https://www.queenstogether.org/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Support","Restaurant Network"],price_level:"Varies by program",hours:"Program schedules vary. Check the organization for current distributions and events.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"}
];

function merged(stored){
 const map=new Map(seedListings.map(x=>[x.id,{...x}]));
 for(const item of stored||[]) if(item?.id) map.set(item.id,{...(map.get(item.id)||{}),...item});
 return [...map.values()];
}
export default async request=>{
 if(request.method!=="GET") return json({ok:false,error:"Method not allowed."},405);
 try{
  const store=getStore(STORE);
  const x=await store.get(KEY,{type:"json",consistency:"strong"});
  const stored=Array.isArray(x?.listings)?x.listings:Array.isArray(x)?x:[];
  const listings=merged(stored).filter(x=>x&&x.published===true&&x.status!=="Inactive").map(x=>({
   id:x.id,name:x.name,category:x.category||"Food Resource",description:x.description||"",
   address:x.address||"",borough:x.borough||"",phone:x.phone||"",website:x.website||"",
   latitude:Number.isFinite(Number(x.latitude))?Number(x.latitude):null,
   longitude:Number.isFinite(Number(x.longitude))?Number(x.longitude):null,
   dietary:Array.isArray(x.dietary)?x.dietary:[],features:Array.isArray(x.features)?x.features:[],
   price_level:x.price_level||"",hours:x.hours||"",source_label:x.source_label||"HUGS Verified",
   last_verified:x.last_verified||x.updated_at||x.created_at||null,partner_status:x.partner_status||"Resource"
  }));
  return json({ok:true,updated_at:x?.updated_at||"2026-09-27T00:00:00.000Z",listings});
 }catch(e){console.error("Food directory error:",e);return json({ok:false,error:"Food directory unavailable."},500)}
};