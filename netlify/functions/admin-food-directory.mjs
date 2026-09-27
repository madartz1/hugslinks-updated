import { getStore } from "@netlify/blobs";
const I_STORE="hugs-food-business-inquiries",I_KEY="inquiries",D_STORE="hugs-food-directory",D_KEY="listings";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=800)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001F\u007F]/g,"").slice(0,n):"";
const authorized=req=>{const expected=process.env.HUGS_ADMIN_TOKEN||"";const h=req.headers.get("authorization")||"";const supplied=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";return !!expected&&supplied===expected};
const makeId=()=>"HFD-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
const seedListings=[
 {id:"HFD-SEED-ASTORIA-PANTRY",name:"Astoria Food Pantry",category:"Food Pantry",description:"Volunteer-run mutual-aid pantry and community resource center serving Astoria.",address:"25-82 Steinway Street, Astoria, NY 11103",borough:"Queens",phone:"",website:"https://www.astoriafoodpantry.com/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Support"],price_level:"Free",hours:"Food pantry: Mon 8–10:30am, Tue 6:30–7:30pm, Sat 1–2pm. Check provider before traveling.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z",internal_note:"Potential community/B2B outreach. No HUGS partnership established yet."},
 {id:"HFD-SEED-CONNECTED-CHEF",name:"The Connected Chef",category:"Grocery / Market",description:"Queens nonprofit offering sliding-scale fresh groceries, local produce, pickup/delivery programs and a Community Fresh Market.",address:"37-31 58th Street, Woodside, NY 11377",borough:"Queens",phone:"(347) 428-5225",website:"https://www.connectedchef.org/",latitude:null,longitude:null,dietary:["Vegetarian","Vegan","Fresh Produce","Healthy Options"],features:["Low-Cost Meals","Community Support"],price_level:"Sliding scale",hours:"Community Fresh Market: Thu–Fri 2–6pm, Sat 11am–3pm. Check provider for current program availability.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z",internal_note:"Strong potential B2B/community food partner. No HUGS partnership established yet."},
 {id:"HFD-SEED-QUEENS-TOGETHER",name:"Queens Together",category:"Community Organization",description:"Queens nonprofit combining food relief, restaurant support and community programs rooted in local partnerships.",address:"Queens, New York",borough:"Queens",phone:"",website:"https://www.queenstogether.org/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Support","Restaurant Network"],price_level:"Varies by program",hours:"Program schedules vary. Check the organization for current distributions and events.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z",internal_note:"High-priority outreach prospect because of Queens restaurant and food-relief network. No HUGS partnership established yet."}
];
const mergeSeeds=stored=>{const map=new Map(seedListings.map(x=>[x.id,{...x}]));for(const item of stored||[])if(item?.id)map.set(item.id,{...(map.get(item.id)||{}),...item});return [...map.values()]};
async function read(store,key,prop){const x=await store.get(key,{type:"json",consistency:"strong"});return Array.isArray(x?.[prop])?x[prop]:[]}
async function save(store,key,prop,items){await store.setJSON(key,{updated_at:new Date().toISOString(),[prop]:items})}
const list=(v,n=12)=>Array.isArray(v)?v.map(x=>clean(x,100)).filter(Boolean).slice(0,n):[];
export default async request=>{
 if(!authorized(request)) return json({ok:false,error:"Unauthorized."},401);
 const iStore=getStore(I_STORE),dStore=getStore(D_STORE);
 try{
  if(request.method==="GET"){
   const [inquiries,storedListings]=await Promise.all([read(iStore,I_KEY,"inquiries"),read(dStore,D_KEY,"listings")]);
   const listings=mergeSeeds(storedListings);
   inquiries.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
   listings.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
   return json({ok:true,inquiries,listings});
  }
  if(request.method!=="POST") return json({ok:false,error:"Method not allowed."},405);
  const body=await request.json();
  const action=clean(body?.action,80),now=new Date().toISOString();
  const inquiries=await read(iStore,I_KEY,"inquiries");
  const listings=mergeSeeds(await read(dStore,D_KEY,"listings"));

  if(["mark-contacted","mark-interested","hold-inquiry","decline-inquiry"].includes(action)){
   const item=inquiries.find(x=>x.id===clean(body?.inquiry_id,90));
   if(!item) return json({ok:false,error:"Inquiry not found."},404);
   item.status=action==="mark-contacted"?"Contacted":action==="mark-interested"?"Interested":action==="hold-inquiry"?"On Hold":"Declined";
   item.admin_note=clean(body?.admin_note,1600);
   item.updated_at=now;
   await save(iStore,I_KEY,"inquiries",inquiries);
   return json({ok:true,inquiry:item});
  }

  if(action==="save-listing"){
   const id=clean(body?.listing_id,90)||makeId();
   let item=listings.find(x=>x.id===id);
   if(!item){item={id,created_at:now};listings.push(item)}
   const lat=Number(body?.latitude),lng=Number(body?.longitude);
   Object.assign(item,{
    name:clean(body?.name,180),
    category:clean(body?.category,120)||"Food Resource",
    description:clean(body?.description,1200),
    address:clean(body?.address,300),
    borough:clean(body?.borough,80),
    phone:clean(body?.phone,70),
    website:clean(body?.website,350),
    latitude:Number.isFinite(lat)?lat:null,
    longitude:Number.isFinite(lng)?lng:null,
    dietary:list(body?.dietary),
    features:list(body?.features),
    price_level:clean(body?.price_level,80),
    hours:clean(body?.hours,500),
    source_label:clean(body?.source_label,120)||"HUGS Verified",
    partner_status:clean(body?.partner_status,100)||"Resource",
    status:clean(body?.status,80)||"Active",
    published:body?.published===true,
    last_verified:clean(body?.last_verified,40)||now.slice(0,10),
    internal_note:clean(body?.internal_note,1800),
    updated_at:now
   });
   if(!item.name) return json({ok:false,error:"Listing name is required."},400);
   await save(dStore,D_KEY,"listings",listings);
   const inquiryId=clean(body?.inquiry_id,90);
   const inquiry=inquiries.find(x=>x.id===inquiryId);
   if(inquiry){
    inquiry.status=item.published?"HUGS Partner":"Approved";
    inquiry.directory_listing_id=id;
    inquiry.updated_at=now;
    await save(iStore,I_KEY,"inquiries",inquiries);
   }
   return json({ok:true,listing:item});
  }

  if(action==="delete-listing"){
   const id=clean(body?.listing_id,90),idx=listings.findIndex(x=>x.id===id);
   if(idx<0) return json({ok:false,error:"Listing not found."},404);
   const removed=listings.splice(idx,1)[0];
   await save(dStore,D_KEY,"listings",listings);
   return json({ok:true,removed});
  }

  return json({ok:false,error:"Unsupported action."},400);
 }catch(e){
  console.error("Food network admin error:",e);
  return json({ok:false,error:"Food network admin request failed."},500);
 }
};