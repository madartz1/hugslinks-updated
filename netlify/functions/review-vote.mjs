import { neon } from "@neondatabase/serverless";

const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...headers}});
const enc=new TextEncoder();
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const businesses={
  "champion-pizza-flushing":{name:"Champion Pizza",location:"Flushing, Queens",address:"136-31 Roosevelt Ave, Flushing, NY 11354",editorial:"HUGS Approved"}
};
const voter=(request)=>{
  const cookies=request.headers.get("cookie")||"";
  const found=cookies.split(";").map(x=>x.trim()).find(x=>x.startsWith("hugs_review_voter="))?.slice(18);
  if(found&&/^[a-f0-9-]{36}$/.test(found)) return {id:found,cookie:null};
  const id=crypto.randomUUID();
  return {id,cookie:`hugs_review_voter=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`};
};
async function setup(sql){
  await sql`CREATE TABLE IF NOT EXISTS hugs_business_votes (
    business_id text NOT NULL,
    voter_hash text NOT NULL,
    vote text NOT NULL CHECK (vote IN ('hug','no_hug')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id,voter_hash)
  )`;
}
async function totals(sql,businessId){
  const rows=await sql`SELECT vote,COUNT(*)::int AS count FROM hugs_business_votes WHERE business_id=${businessId} GROUP BY vote`;
  let hug=0,no_hug=0; for(const r of rows){if(r.vote==="hug")hug=Number(r.count);if(r.vote==="no_hug")no_hug=Number(r.count)}
  const total=hug+no_hug; return {hug,no_hug,total,hug_percent:total?Math.round(hug/total*100):0};
}
export default async request=>{
  if(!process.env.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:"Voting database is not configured."},503);
  const sql=neon(process.env.HUGS_VOTING_DATABASE_URL); await setup(sql);
  const url=new URL(request.url),businessId=url.searchParams.get("business")||"champion-pizza-flushing",business=businesses[businessId];
  if(!business)return json({ok:false,error:"Business not found."},404);
  const v=voter(request),voterHash=await digest("hugs-reviews:"+v.id);
  const headers=v.cookie?{"Set-Cookie":v.cookie}:{};
  if(request.method==="GET"){
    const score=await totals(sql,businessId);
    const mine=await sql`SELECT vote FROM hugs_business_votes WHERE business_id=${businessId} AND voter_hash=${voterHash} LIMIT 1`;
    return json({ok:true,business_id:businessId,business,score,my_vote:mine[0]?.vote||null},200,headers);
  }
  if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405,headers);
  let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid request"},400,headers)}
  if(!["hug","no_hug"].includes(body.vote))return json({ok:false,error:"Choose HUG or NO HUG."},400,headers);
  await sql`INSERT INTO hugs_business_votes (business_id,voter_hash,vote) VALUES (${businessId},${voterHash},${body.vote})
    ON CONFLICT (business_id,voter_hash) DO UPDATE SET vote=EXCLUDED.vote,updated_at=now()`;
  return json({ok:true,business_id:businessId,business,score:await totals(sql,businessId),my_vote:body.vote},200,headers);
};