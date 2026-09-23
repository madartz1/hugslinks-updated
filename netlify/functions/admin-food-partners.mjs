import { getStore } from "@netlify/blobs";
const OFFER_STORE="hugs-food-partner-offers",OFFER_KEY="offers",MISSION_STORE="hugs-help-missions",MISSION_KEY="missions";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const clean=(v,n=500)=>typeof v==="string"?v.trim().replace(/[\u0000-\u001F\u007F]/g,"").slice(0,n):"";
function auth(req){const expected=process.env.HUGS_ADMIN_TOKEN||"",h=req.headers.get("authorization")||"",supplied=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";return !!expected&&!!supplied&&supplied===expected}
async function read(store,key,prop){const x=await store.get(key,{type:"json",consistency:"strong"});return Array.isArray(x?.[prop])?x[prop]:Array.isArray(x)?x:[]}
async function save(store,key,prop,arr){await store.setJSON(key,{updated_at:new Date().toISOString(),[prop]:arr})}
const makeMissionId=()=>"HUG-"+new Date().getFullYear()+"-"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
export default async request=>{
 if(!auth(request)) return json({ok:false,error:"Unauthorized."},401);
 try{
  const offerStore=getStore(OFFER_STORE);
  if(request.method==="GET"){const offers=await read(offerStore,OFFER_KEY,"offers");offers.sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));return json({ok:true,offers})}
  if(request.method!=="POST") return json({ok:false,error:"Method not allowed."},405);
  let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request."},400)}
  const action=clean(b?.action,60),offerId=clean(b?.offer_id,80),offers=await read(offerStore,OFFER_KEY,"offers"),offer=offers.find(x=>String(x?.id||"")===offerId);
  if(!offer) return json({ok:false,error:"Food offer not found."},404);
  const now=new Date().toISOString();
  if(action==="hold-offer"||action==="decline-offer"){offer.status=action==="hold-offer"?"On Hold":"Declined";offer.reviewed_at=now;await save(offerStore,OFFER_KEY,"offers",offers);return json({ok:true,offer})}
  if(action!=="approve-offer") return json({ok:false,error:"Unsupported action."},400);
  if(offer.mission_id) return json({ok:false,error:"This food offer already has a mission."},409);
  const summary=clean(b?.summary,600);if(!summary) return json({ok:false,error:"A safe public mission summary is required."},400);
  const missionStore=getStore(MISSION_STORE),missions=await read(missionStore,MISSION_KEY,"missions");
  const mission={id:makeMissionId(),type:clean(b?.type,100)||"Food Partner Pickup",city:"New York City",area:clean(b?.area,100)||offer.borough||"",timing:clean(b?.timing,100)||(offer.pickup_date+" "+offer.pickup_start+"-"+offer.pickup_end),summary,status:"Available",approved:true,created_at:now,source_food_offer_id:offer.id};
  missions.push(mission);offer.status="Approved";offer.reviewed_at=now;offer.mission_id=mission.id;
  await save(missionStore,MISSION_KEY,"missions",missions);await save(offerStore,OFFER_KEY,"offers",offers);
  return json({ok:true,offer,mission});
 }catch(e){console.error("Admin food partner error:",e);return json({ok:false,error:"Food partner admin request failed."},500)}
};