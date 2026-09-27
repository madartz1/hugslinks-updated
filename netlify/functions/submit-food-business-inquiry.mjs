import { getStore } from "@netlify/blobs";
const STORE="hugs-food-business-inquiries";
const KEY="inquiries";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=600)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001F\u007F]/g,"").slice(0,n):"";
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const makeId=()=>"B2B-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
export default async request=>{
 if(request.method!=="POST") return json({ok:false,error:"Method not allowed."},405);
 try{
  const body=await request.json();
  if(clean(body?.bot_field,100)) return json({ok:true});
  const business_name=clean(body?.business_name,180);
  const contact_name=clean(body?.contact_name,140);
  const email=clean(body?.email,254).toLowerCase();
  const phone=clean(body?.phone,70);
  const borough=clean(body?.borough,80);
  const public_address=clean(body?.public_address,260);
  const website=clean(body?.website,300);
  const message=clean(body?.message,1800);
  const interests=Array.isArray(body?.interests)?body.interests.map(x=>clean(x,100)).filter(Boolean).slice(0,12):[];
  const dietary=Array.isArray(body?.dietary)?body.dietary.map(x=>clean(x,80)).filter(Boolean).slice(0,12):[];
  if(!business_name||!contact_name||!email||!message) return json({ok:false,error:"Please complete the required fields."},400);
  if(!validEmail(email)) return json({ok:false,error:"Please enter a valid email."},400);
  const store=getStore(STORE);
  const current=await store.get(KEY,{type:"json",consistency:"strong"});
  const inquiries=Array.isArray(current?.inquiries)?current.inquiries:[];
  const now=new Date().toISOString();
  const id=makeId();
  inquiries.push({id,status:"New",created_at:now,updated_at:now,business_name,contact_name,email,phone,borough,public_address,website,interests,dietary,message,admin_note:"",directory_listing_id:null});
  await store.setJSON(KEY,{updated_at:now,inquiries});
  return json({ok:true,inquiry_id:id,status:"New"},201);
 }catch(e){
  console.error("Food business inquiry error:",e);
  return json({ok:false,error:"We could not submit this inquiry right now."},500);
 }
};