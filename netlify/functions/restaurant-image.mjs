import { getStore } from '@netlify/blobs';
export default async request=>{
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const id=new URL(request.url).searchParams.get('id');if(!/^MEDIA-[a-f0-9-]{36}$/.test(id||''))return new Response('Not found',{status:404});
 try{const image=await getStore({name:'hugs-restaurant-marketplace',consistency:'strong'}).getWithMetadata('MEDIA/'+id,{type:'arrayBuffer',consistency:'strong'});if(!image)return new Response('Not found',{status:404});const type=image.metadata?.content_type;if(!['image/jpeg','image/png','image/webp'].includes(type))return new Response('Not found',{status:404});return new Response(image.data,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}})}catch{return new Response('Image unavailable',{status:503})}
};
