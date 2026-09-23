import { getStore } from "@netlify/blobs";
export default async request=>{
 const secret=process.env.HUGS_ADMIN_TOKEN||"",h=request.headers.get("authorization")||"";
 if(!secret||!h.startsWith("Bearer ")||h.slice(7).trim()!==secret)return new Response("Unauthorized",{status:401});
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!/^[a-f0-9-]{36}$/.test(id))return new Response("Not found",{status:404});
 try{const e=await getStore("hugs-art-images").getWithMetadata("image-"+id,{type:"arrayBuffer"});if(!e?.data)return new Response("Not found",{status:404});return new Response(e.data,{headers:{"Content-Type":e.metadata?.mime||"application/octet-stream","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}catch{return new Response("Unavailable",{status:500})}
};