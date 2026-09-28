import {neon} from "@neondatabase/serverless";
import {getStore,json,digest,guestVoter} from "./_art-voter-auth.mjs";

export default async request=>{
  if(!process.env.HUGS_VOTER_SESSION_SECRET||!process.env.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:"Voting not configured"},503);
  const sql=neon(process.env.HUGS_VOTING_DATABASE_URL);
  const gallery=await getStore("hugs-art-gallery").get("gallery",{type:"json",consistency:"strong"});
  const works=(gallery?.works||[]).filter(work=>work.published===true);

  if(request.method==="GET"){
    try{
      const rows=await sql`SELECT artwork_id,COUNT(*)::int AS votes FROM hugs_art_ratings GROUP BY artwork_id`;
      const counts=new Map(rows.map(row=>[row.artwork_id,row.votes]));
      return json({ok:true,scores:works.map(work=>({id:work.id,votes:counts.get(work.id)||0}))});
    }catch(error){
      console.error(error);
      return json({ok:false,error:"Votes temporarily unavailable."},503);
    }
  }

  if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
  let body;
  try{body=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
  const artworkId=String(body.artwork_id||"");
  if(!works.some(work=>work.id===artworkId))return json({ok:false,error:"Choose published artwork."},400);

  const guest=guestVoter(request);
  const voterHash=await digest(guest.id+":"+process.env.HUGS_VOTER_SESSION_SECRET);
  const headers=guest.header?{"Set-Cookie":guest.header}:{};
  try{
    const inserted=await sql`INSERT INTO hugs_art_ratings(artwork_id,voter_hash,rating) VALUES(${artworkId},${voterHash},${1}) ON CONFLICT DO NOTHING RETURNING artwork_id`;
    if(!inserted.length)return json({ok:false,error:"You already gave this artwork a HUG from this browser."},409,headers);
    const [score]=await sql`SELECT COUNT(*)::int AS votes FROM hugs_art_ratings WHERE artwork_id=${artworkId}`;
    return json({ok:true,artwork_id:artworkId,votes:score.votes,message:"Your HUG was counted."},200,headers);
  }catch(error){
    console.error(error);
    return json({ok:false,error:"Voting temporarily unavailable."},503,headers);
  }
};
