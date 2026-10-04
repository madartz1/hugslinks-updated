import { getStore } from "@netlify/blobs";
const STORE="hugs-artists",KEY="artists",GALLERY_STORE="hugs-art-gallery",GALLERY_KEY="gallery",headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate"};
const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers});
const clean=(v,n=500)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001F\u007F]/g,"").slice(0,n):"";
function auth(r){const e=process.env.HUGS_ADMIN_TOKEN||"",h=r.headers.get("authorization")||"",s=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";return !!e&&!!s&&s===e}
async function read(s){const x=await s.get(KEY,{type:"json",consistency:"strong"});return Array.isArray(x?.artists)?x.artists:Array.isArray(x)?x:[]}
async function publishSubmission(artist){
  if(!artist.artwork_image_id)return {error:"This submission has no uploaded artwork image."};
  const galleryStore=getStore(GALLERY_STORE);
  const gallery=await galleryStore.get(GALLERY_KEY,{type:"json",consistency:"strong"});
  const works=Array.isArray(gallery?.works)?gallery.works:[];
  let work=artist.gallery_artwork_id?works.find(x=>x.id===artist.gallery_artwork_id):null;
  if(!work)work=works.find(x=>x.source_artist_submission_id===artist.id);
  const now=new Date().toISOString();
  const rec={
    id:work?.id||("ART-"+crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase()),
    title:clean(artist.artwork_title,180)||"Untitled Artwork",
    artist_name:clean(artist.artist_name||artist.full_name,180)||"HUGSLinks Artist",
    collection:"Community Gallery",
    image_url:"/.netlify/functions/art-image?id="+encodeURIComponent(artist.artwork_image_id),
    description:clean(artist.artist_statement,1800),
    medium:clean(artist.primary_medium,160),
    year:clean(artist.artwork_year,20),
    room_images:[],published:true,featured:false,updated_at:now,
    source_artist_submission_id:artist.id
  };
  const i=works.findIndex(x=>x.id===rec.id);if(i>=0)works[i]=rec;else works.push(rec);
  await galleryStore.setJSON(GALLERY_KEY,{updated_at:now,works});
  artist.gallery_artwork_id=rec.id;artist.artwork_published_at=artist.artwork_published_at||now;
  return {work:rec};
}
export default async request=>{
 if(!auth(request))return json({ok:false,error:"Unauthorized."},401);
 try{
  const store=getStore(STORE),artists=await read(store);
  if(request.method==="GET"){artists.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));return json({ok:true,artists})}
  if(request.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
  let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
  const id=clean(b?.artist_id,100),action=clean(b?.action,60),artist=artists.find(x=>String(x?.id||"")===id);
  if(!artist)return json({ok:false,error:"Artist not found."},404);
  artist.admin_note=clean(b?.admin_note,1000);
  if(action==="approve-publish"){
    const published=await publishSubmission(artist);if(published.error)return json({ok:false,error:published.error},400);
    artist.status="Approved";artist.reviewed_at=new Date().toISOString();
    await store.setJSON(KEY,{updated_at:new Date().toISOString(),artists});
    return json({ok:true,artist,work:published.work,message:"Artist approved and artwork published to voting."});
  }
  const statuses={"approve-artist":"Approved","hold-artist":"On Hold","decline-artist":"Declined"};
  if(!statuses[action])return json({ok:false,error:"Unsupported action."},400);
  artist.status=statuses[action];artist.reviewed_at=new Date().toISOString();
  await store.setJSON(KEY,{updated_at:new Date().toISOString(),artists});return json({ok:true,artist});
 }catch(e){console.error("Admin artist error:",e);return json({ok:false,error:"Artist admin request failed."},500)}
};