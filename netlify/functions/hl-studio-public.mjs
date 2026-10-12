import {neon} from '@neondatabase/serverless';
const json=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
export const handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
 if(process.env.HL_STUDIO_ENABLE_PUBLIC_PUBLISHING!=='true')return json(404,{error:'Publishing not enabled'});
 const slug=event.queryStringParameters?.slug||'';
 if(!/^[0-9a-f-]{36}$/i.test(slug))return json(404,{error:'Campaign not found'});
 if(!process.env.HL_STUDIO_DATABASE_URL)return json(503,{error:'Unavailable'});
 try{
 const sql=neon(process.env.HL_STUDIO_DATABASE_URL);
 const rows=await sql`SELECT c.title,c.business_name,c.category,c.message,c.cta,c.format,c.video_url,p.published_at FROM hl_studio_publications p JOIN hl_studio_campaigns c ON c.id=p.campaign_id WHERE p.slug=${slug} LIMIT 1`;
 if(!rows.length)return json(404,{error:'Campaign not found'});
 return json(200,{campaign:rows[0]});
 }catch(e){return json(500,{error:'Unable to load campaign'})}
};