import { getStore } from "@netlify/blobs";
const STORE_NAME="hugs-food-partner-offers", KEY="offers";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=500)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001F\u007F]/g,"").slice(0,n):"";
const emailOK=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const makeId=()=>"FOOD-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
async function read(store){const x=await store.get(KEY,{type:"json",consistency:"strong"});return Array.isArray(x?.offers)?x.offers:Array.isArray(x)?x:[]}
async function save(store,offers){await store.setJSON(KEY,{updated_at:new Date().toISOString(),offers})}
export default async request=>{
 if(request.method!=="POST") return json({ok:false,error:"Method not allowed."},405);
 try{
  let b; try{b=await request.json()}catch{return json({ok:false,error:"Invalid submission."},400)}
  if(clean(b?.bot_field,100)) return json({ok:true,message:"Offer received."});
  const business=clean(b?.business_name,160),contact=clean(b?.contact_name,140),email=clean(b?.email,254).toLowerCase(),phone=clean(b?.phone,60),address=clean(b?.pickup_address,300),borough=clean(b?.borough,100),type=clean(b?.donation_type,120),desc=clean(b?.food_description,1800),quantity=clean(b?.quantity,200),prepared=clean(b?.prepared_at,80),pickupDate=clean(b?.pickup_date,30),pickupStart=clean(b?.pickup_start,20),pickupEnd=clean(b?.pickup_end,20),frequency=clean(b?.frequency,120),notes=clean(b?.handling_notes,1600);
  const attrs=Array.isArray(b?.attributes)?b.attributes.map(x=>clean(x,100)).filter(Boolean).slice(0,12):[];
  const confirmed=b?.partner_confirmation===true||b?.partner_confirmation==="yes";
  if(!business||!contact||!email||!phone||!address||!borough||!type||!desc||!quantity||!pickupDate||!pickupStart||!pickupEnd) return json({ok:false,error:"Please complete all required donation fields."},400);
  if(!emailOK(email)) return json({ok:false,error:"Please enter a valid business email."},400);
  if(!confirmed) return json({ok:false,error:"Business authorization confirmation is required."},400);
  const offerId=makeId(),now=new Date().toISOString();
  const offer={id:offerId,status:"Pending Review",created_at:now,reviewed_at:null,mission_id:null,business_name:business,contact_name:contact,email,phone,pickup_address:address,borough,donation_type:type,food_description:desc,quantity,attributes:attrs,prepared_at:prepared,pickup_date:pickupDate,pickup_start:pickupStart,pickup_end:pickupEnd,frequency,handling_notes:notes,partner_confirmation:true};
  const store=getStore(STORE_NAME),offers=await read(store);offers.push(offer);await save(store,offers);
  return json({ok:true,offer_id:offerId,status:"Pending Review",message:"Your food donation offer has been received for review."},201);
 }catch(e){console.error("Food partner submission error:",e);return json({ok:false,error:"We could not submit the donation offer right now."},500)}
};