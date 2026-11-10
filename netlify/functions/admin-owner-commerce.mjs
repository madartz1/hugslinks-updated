import { getStore } from "@netlify/blobs";
import { STORE_PRODUCTS, REVIEW_BUSINESSES, clean, validURL, slug } from "./_owner-content.mjs";

const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const auth=request=>{
  const expected=process.env.HUGS_ADMIN_TOKEN||"";
  const value=request.headers.get("authorization")||"";
  const supplied=value.toLowerCase().startsWith("bearer ")?value.slice(7).trim():"";
  return !!expected&&supplied===expected;
};

async function ownerList(store,key,fallback,field){
  const saved=await store.get(key,{type:"json",consistency:"strong"});
  return Array.isArray(saved?.[field])?saved[field]:structuredClone(fallback);
}

function storeRecord(body,existing=[]){
  const id=slug(body.id||body.title)||("product-"+crypto.randomUUID().slice(0,8));
  const record={
    id,
    title:clean(body.title,140),
    price:clean(body.price,40),
    label:clean(body.label,80),
    badge:clean(body.badge,80),
    description:clean(body.description,1000),
    features:Array.isArray(body.features)?body.features.map(x=>clean(x,140)).filter(Boolean).slice(0,10):[],
    image_url:clean(body.image_url,700),
    preview_url:clean(body.preview_url,700),
    preview_text:clean(body.preview_text,120),
    cta_url:clean(body.cta_url,700),
    cta_text:clean(body.cta_text,140),
    style:["standard","featured","premium"].includes(body.style)?body.style:"standard",
    published:body.published===true,
    sort_order:Number.isFinite(Number(body.sort_order))?Math.max(0,Math.min(999,Number(body.sort_order))):existing.length+1,
    updated_at:new Date().toISOString()
  };
  if(!record.title||!record.price||!record.cta_text||!record.cta_url||!validURL(record.cta_url)||!validURL(record.preview_url)||!validURL(record.image_url)) throw new Error("Product title, price, valid action link and action text are required.");
  return record;
}

function reviewRecord(body,existing=[]){
  const id=slug(body.id||body.name)||("business-"+crypto.randomUUID().slice(0,8));
  const record={
    id,
    name:clean(body.name,160),
    neighborhood:clean(body.neighborhood,160),
    address:clean(body.address,260),
    editorial_status:clean(body.editorial_status,80)||"Community Listing",
    description:clean(body.description,1000),
    published:body.published===true,
    sort_order:Number.isFinite(Number(body.sort_order))?Math.max(0,Math.min(999,Number(body.sort_order))):existing.length+1,
    updated_at:new Date().toISOString()
  };
  if(!record.name||!record.neighborhood) throw new Error("Business name and neighborhood are required.");
  return record;
}

async function listMembers(){
  const memberStore=getStore("hugs-original-333");
  const adminStore=getStore("hugs-member-admin");
  const result=await memberStore.list({prefix:"member:"});
  const members=[];
  for(const item of result.blobs||[]){
    const member=await memberStore.get(item.key,{type:"json",consistency:"strong"});
    if(!member) continue;
    const admin=await adminStore.get(item.key,{type:"json",consistency:"strong"})||{};
    members.push({number:member.number,displayNumber:member.displayNumber,name:member.name,email:member.email,createdAt:member.createdAt,status:admin.status||"Active",admin_note:admin.admin_note||""});
  }
  return members.sort((a,b)=>(a.number||0)-(b.number||0));
}

export default async request=>{
  if(!auth(request)) return json({ok:false,error:"Unauthorized."},401);
  try{
    const url=new URL(request.url),area=clean(url.searchParams.get("area"),30);
    const store=getStore("hugs-owner-content");
    if(request.method==="GET"){
      if(area==="store") return json({ok:true,products:await ownerList(store,"store-products",STORE_PRODUCTS,"products")});
      if(area==="reviews") return json({ok:true,businesses:await ownerList(store,"review-businesses",REVIEW_BUSINESSES,"businesses")});
      if(area==="members") return json({ok:true,members:await listMembers()});
      return json({ok:false,error:"Unknown workspace area."},400);
    }
    if(request.method!=="POST") return json({ok:false,error:"Method not allowed."},405);
    let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
    if(area==="store"){
      const products=await ownerList(store,"store-products",STORE_PRODUCTS,"products"),record=storeRecord(body,products),index=products.findIndex(x=>x.id===record.id);
      if(index>=0) products[index]=record; else products.push(record);
      await store.setJSON("store-products",{updated_at:record.updated_at,products});
      return json({ok:true,product:record});
    }
    if(area==="reviews"){
      const businesses=await ownerList(store,"review-businesses",REVIEW_BUSINESSES,"businesses"),record=reviewRecord(body,businesses),index=businesses.findIndex(x=>x.id===record.id);
      if(index>=0) businesses[index]=record; else businesses.push(record);
      await store.setJSON("review-businesses",{updated_at:record.updated_at,businesses});
      return json({ok:true,business:record});
    }
    if(area==="members"){
      const number=Number(body.number),key="member:"+String(number).padStart(3,"0"),status=clean(body.status,40),allowed=["Active","On Hold","Archived"];
      if(!Number.isInteger(number)||number<1||number>333||!allowed.includes(status)) return json({ok:false,error:"Valid member number and status are required."},400);
      await getStore("hugs-member-admin").setJSON(key,{status,admin_note:clean(body.admin_note,1600),updated_at:new Date().toISOString()});
      return json({ok:true});
    }
    return json({ok:false,error:"Unknown workspace area."},400);
  }catch(error){
    console.error(error);
    return json({ok:false,error:error.message||"Owner workspace request failed."},500);
  }
};
