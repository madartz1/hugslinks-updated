import { getStore } from "@netlify/blobs";
export default async request=>{
 if(request.method!=="GET")return new Response("Method not allowed",{status:405});
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!/^[a-f0-9-]{36}$/.test(id))return new Response("Not found",{status:404});
 try{
  const images=getStore("hugs-art-images"),gallery=getStore("hugs-art-gallery");
  const record=await gallery.get("gallery",{type:"json",consistency:"strong"});
  const path="/.netlify/functions/art-image?id="+id;
  if(!Array.isArray(record?.works)||!record.works.some(w=>w.published===true&&w.image_url===path))return new Response("Not found",{status:404});
  const entry=await images.getWithMetadata("image-"+id,{type:"arrayBuffer"});
  if(!entry?.data)return new Response("Not found",{status:404});
  const mime=entry.metadata?.mime||"application/octet-stream";
  if(!["image/jpeg","image/png","image/webp"].includes(mime))return new Response("Unsupported media",{status:415});
  return new Response(entry.data,{headers:{"Content-Type":mime,"Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch(e){console.error("Art image read failed",e);return new Response("Image unavailable",{status:500})}
};