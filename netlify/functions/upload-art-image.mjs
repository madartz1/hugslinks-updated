import { getStore } from "@netlify/blobs";
const MAX=8*1024*1024,types=new Set(["image/jpeg","image/png","image/webp"]),json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
function auth(r){const secret=process.env.HUGS_ADMIN_TOKEN||"",h=r.headers.get("authorization")||"";return !!secret&&h.startsWith("Bearer ")&&h.slice(7).trim()===secret}
export default async request=>{
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
 if(!auth(request))return json({ok:false,error:"Unauthorized."},401);
 try{
  const data=await request.formData(),file=data.get("artwork");
  if(!(file instanceof File))return json({ok:false,error:"Choose an image."},400);
  if(!types.has(file.type))return json({ok:false,error:"Use JPEG, PNG or WebP."},415);
  if(file.size<1||file.size>MAX)return json({ok:false,error:"Maximum file size is 8 MB."},413);
  const bytes=await file.arrayBuffer();
  const signatures={"image/jpeg":b=>b[0]===255&&b[1]===216&&b[2]===255,"image/png":b=>b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71,"image/webp":b=>String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP"};
  if(!signatures[file.type](new Uint8Array(bytes)))return json({ok:false,error:"Invalid image file."},415);
  const id=crypto.randomUUID(),key="image-"+id;
  await getStore("hugs-art-images").set(key,bytes,{metadata:{mime:file.type}});
  return json({ok:true,image_url:"/.netlify/functions/art-image?id="+encodeURIComponent(id),image_id:id},201);
 }catch(e){console.error("Artwork upload failed",e);return json({ok:false,error:"Could not upload artwork."},500)}
};