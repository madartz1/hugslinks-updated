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
 {id:"HFD-SEED-QUEENS-TOGETHER",name:"Queens Together",category:"Community Organization",description:"Queens nonprofit combining food relief, restaurant support and community programs rooted in local partnerships.",address:"Queens, New York",borough:"Queens",phone:"",website:"https://www.queenstogether.org/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Support","Restaurant Network"],price_level:"Varies by program",hours:"Program schedules vary. Check the organization for current distributions and events.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z",internal_note:"High-priority outreach prospect because of Queens restaurant and food-relief network. No HUGS partnership established yet."}, 
 {id:"HFD-SEED-BRONXWORKS-MORRIS",internal_note:"Bronx outreach prospect. Existing food-access provider; no HUGS partnership established.",name:"BronxWorks Morris Older Adult Center Pantry",category:"Food Pantry",description:"BronxWorks pantry serving older adults and community members with grocery distributions that include multiple food groups.",address:"80 E 181st Street, Bronx, NY 10453",borough:"Bronx",phone:"(718) 933-5300",website:"https://bronxworks.org/our-services/benefits-and-other-assistance/food-pantries/",latitude:null,longitude:null,dietary:["Fresh Produce"],features:["Free Food","Community Support"],price_level:"Free",hours:"Older adult pantry: second Friday monthly, 10am–3pm; community distribution under 60: fourth Friday. Check BronxWorks for current dates.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-BRONXWORKS-FARMSTAND",internal_note:"Bronx fresh-food outreach prospect with EBT/Health Bucks access; no HUGS partnership established.",name:"BronxWorks Community Farm Stand",category:"Farmers Market",description:"Seasonal Bronx farm stand offering local and regional produce and accepting EBT/SNAP, Health Bucks and FMNP checks.",address:"1130 Grand Concourse, Bronx, NY 10456",borough:"Bronx",phone:"(718) 508-3156",website:"https://bronxworks.org/our-services/health-wellness/farm-stands/",latitude:null,longitude:null,dietary:["Vegetarian","Vegan","Fresh Produce","Healthy Options"],features:["SNAP / EBT","Health Bucks","Fresh Food"],price_level:"Affordable produce",hours:"Seasonal July–November; check BronxWorks for current days and hours.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-NYCP-BRONX",internal_note:"Potential Bronx pantry/community partner; no HUGS partnership established.",name:"NY Common Pantry — Bronx Choice Pantry",category:"Food Pantry",description:"Choice pantry providing fresh groceries including fruits and vegetables, proteins, grains and dairy.",address:"1290 Hoe Avenue, Bronx, NY 10459",borough:"Bronx",phone:"(917) 982-2700",website:"https://nycommonpantry.org/choice-pantry/",latitude:null,longitude:null,dietary:["Fresh Produce","Healthy Options"],features:["Free Food","Emergency Food","Community Support"],price_level:"Free",hours:"New intakes Tue–Sat 9am–2pm; emergency food Tue–Sat 10am–2pm; pantry distribution Thu–Sat 10am–2pm.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-FRIENDLY-FRIDGE-BX",internal_note:"HIGH PRIORITY B2B prospect. Friendly Fridge already works with Bronx restaurants, bakeries, farms and markets and runs a local restaurant meal-support program. No HUGS partnership established.",name:"Friendly Fridge BX",category:"Community Fridge",description:"Bronx community food hub rescuing and redistributing healthy produce and prepared meals through a public community fridge and food hub.",address:"4670 Manhattan College Parkway, Bronx, NY 10471",borough:"Bronx",phone:"(917) 533-7196",website:"https://www.friendlyfridgefoundation.org/",latitude:null,longitude:null,dietary:["Fresh Produce","Healthy Options"],features:["Free Food","Community Fridge","Food Rescue","Community Support"],price_level:"Free",hours:"Food Hub Tue, Thu & Fri at 2pm; community fridge operates on other days. Check current site before traveling.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-ALLERTON-ALLIES",internal_note:"Community fridge outreach prospect; no HUGS partnership established.",name:"Allerton Allies Community Fridge",category:"Community Fridge",description:"Community-run Bronx fridge where neighbors can take what they need with no application, ID or eligibility requirement.",address:"2527 Boston Road, Bronx, NY 10467",borough:"Bronx",phone:"(914) 370-1472",website:"https://allertonallies.com/",latitude:null,longitude:null,dietary:[],features:["Free Food","Community Fridge","No ID Required","Community Support"],price_level:"Free",hours:"Google listing indicates 24-hour access; stock and access can change, so check before traveling far.",source_label:"HUGS Discovered",partner_status:"Community Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"},
 {id:"HFD-SEED-VEGAN-GRILL-BRONX",internal_note:"Healthy/vegan business prospect for HUGS discounts or community support outreach. No HUGS partnership established.",name:"Vegan Grill",category:"Restaurant",description:"Bronx plant-based restaurant and deli with vegan meals, sandwiches, salads, smoothies and delivery/takeout options.",address:"1201 Castle Hill Avenue, Bronx, NY 10462",borough:"Bronx",phone:"(718) 684-3916",website:"https://vegangrillnyc.com/",latitude:null,longitude:null,dietary:["Vegan","Vegetarian","Healthy Options"],features:["Delivery","Takeout","Late-Night Food"],price_level:"$$",hours:"Current listings show daily late-night / near-24-hour service; check before traveling.",source_label:"HUGS Discovered",partner_status:"Resource",status:"Active",published:true,last_verified:"2026-09-27",created_at:"2026-09-27T00:00:00.000Z"}

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