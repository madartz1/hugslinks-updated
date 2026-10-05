import { getStore } from '@netlify/blobs';
import { createService, ApiError } from './_marketplace/core.mjs';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const getActions=new Set(['restaurants','restaurant','merchant','admin-list','merchant-orders','helper-orders','customer-order']);
export default async request=>{
 try{
  if(!['GET','POST'].includes(request.method))return respond({ok:false,error:'Method not allowed.'},405);
  const url=new URL(request.url);let body;
  if(request.method==='GET'){body=Object.fromEntries(url.searchParams);if(!getActions.has(body.action))return respond({ok:false,error:'Use POST for this action.'},405)}
  else{
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return respond({ok:false,error:'Cross-site submissions are not allowed.'},403);
   if(!request.headers.get('content-type')?.includes('application/json'))return respond({ok:false,error:'Send JSON.'},415);
   const raw=await request.text();if(raw.length>2500000)return respond({ok:false,error:'Submission too large.'},413);
   try{body=JSON.parse(raw)}catch{return respond({ok:false,error:'Invalid JSON.'},400)}
  }
  if(!body||typeof body!=='object'||Array.isArray(body))return respond({ok:false,error:'Invalid request.'},400);
  const auth=(request.headers.get('authorization')||'').replace(/^Bearer /i,'');
  const service=createService(getStore({name:'hugs-restaurant-marketplace',consistency:'strong'}),process.env);
  return respond({ok:true,...await service(body.action,body,auth)});
 }catch(e){if(e instanceof ApiError)return respond({ok:false,error:e.message},e.status);console.error('Restaurant marketplace failure:',e.name);return respond({ok:false,error:'Marketplace temporarily unavailable. Please try again.'},503)}
};
