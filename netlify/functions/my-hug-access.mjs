import { getStore } from "@netlify/blobs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}})}
function normalizeEmail(v=""){return String(v).trim().toLowerCase()}
function emailKey(v=""){return encodeURIComponent(normalizeEmail(v))}
function safeValue(v=""){return String(v).replace(/[^a-zA-Z0-9_-]/g,"-")}

export default async(req)=>{
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 try{
  const body=await req.json();
  const orderId=String(body?.order_id||"").trim();
  const email=normalizeEmail(body?.email);
  if(!orderId||!email) return json({error:"Purchase email and HUG order number are required."},400);

  const orders=getStore({name:"hugs-orders",consistency:"strong"});
  const order=await orders.get(orderId,{type:"json",consistency:"strong"});
  const orderEmail=normalizeEmail(order?.stripe_customer_email||order?.customer_email);
  if(!order||!orderEmail||orderEmail!==email) return json({error:"We could not verify that email and HUG order number."},403);
  if(order.payment_status!=="paid") return json({error:"This HUG order has not been paid."},409);

  let member=null;
  const memberEmails=getStore({name:"hugs-333-member-emails",consistency:"strong"});
  const index=await memberEmails.get(emailKey(email),{type:"json",consistency:"strong"});
  if(index?.member_number){
   const members=getStore({name:"hugs-333-members",consistency:"strong"});
   const record=await members.get("member-"+index.member_number,{type:"json",consistency:"strong"});
   if(record) member={member_number:index.member_number,name:record.name||order.customer_name||"HUGS Member",joined_at:record.joined_at||null};
  }

  let downloadUrl=null;
  if(order.storage_status==="stored"&&(order.storage_key||order.delivery_url)){
   const required=["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET_NAME"];
   if(required.every(k=>process.env[k])){
    const r2=new S3Client({region:"auto",endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
    const key=order.storage_key||`hugs-cards/${safeValue(orderId)}.mp4`;
    downloadUrl=await getSignedUrl(r2,new GetObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key,ResponseContentType:"video/mp4",ResponseContentDisposition:`attachment; filename="HUGSLinks-${safeValue(orderId)}.mp4"`}),{expiresIn:900});
   }
  }

  return json({success:true,order_id:orderId,member,download_url:downloadUrl,download_ready:Boolean(downloadUrl)});
 }catch(error){console.error("my-hug-access error:",error);return json({error:"Unable to access your HUG right now."},500)}
};