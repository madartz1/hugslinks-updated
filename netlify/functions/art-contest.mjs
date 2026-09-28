import {neon} from "@neondatabase/serverless";
import {getStore,json,digest,guestVoter} from "./_art-voter-auth.mjs";

export default async request=>{
  if(!process.env.HUGS_VOTER_SESSION_SECRET||!process.env.HUGS_VOTING_DATABASE_URL)return json({ok:false,error:"Voting not configured"},503);
  const sql=neon(process.env.HUGS_VOTING_DATABASE_URL);
  const contest=await getStore("hugs-art-contests").get("current",{type:"json",consistency:"strong"});

  if(request.method==="GET"){
    if(!contest)return json({ok:true,contest:null,scores:[]});
    const rows=await sql`SELECT artwork_id,COUNT(*)::int AS votes FROM hugs_contest_votes WHERE contest_id=${contest.id} GROUP BY artwork_id`;
    const counts=new Map(rows.map(row=>[row.artwork_id,row.votes]));
    return json({ok:true,contest:{id:contest.id,title:contest.title,max_entries:contest.max_entries,status:contest.status,entries:contest.entries,winners:contest.winners||null},scores:contest.entries.map(id=>({id,votes:counts.get(id)||0}))});
  }

  if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
  if(!contest||contest.status!=="open")return json({ok:false,error:"Contest voting is not open."},409);
  let body;
  try{body=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
  const artworkId=String(body.artwork_id||"");
  if(!contest.entries.includes(artworkId))return json({ok:false,error:"Artwork is not entered in this contest."},400);

  const guest=guestVoter(request);
  const voterHash=await digest(guest.id+":"+process.env.HUGS_VOTER_SESSION_SECRET);
  const headers=guest.header?{"Set-Cookie":guest.header}:{};
  try{
    const inserted=await sql`INSERT INTO hugs_contest_votes(contest_id,artwork_id,voter_hash) VALUES(${contest.id},${artworkId},${voterHash}) ON CONFLICT DO NOTHING RETURNING artwork_id`;
    if(!inserted.length)return json({ok:false,error:"You already voted in this competition from this browser."},409,headers);
    const [score]=await sql`SELECT COUNT(*)::int AS votes FROM hugs_contest_votes WHERE contest_id=${contest.id} AND artwork_id=${artworkId}`;
    return json({ok:true,message:"Your competition HUG was counted.",artwork_id:artworkId,votes:score.votes},200,headers);
  }catch(error){
    console.error("Contest vote database error",error);
    return json({ok:false,error:"Voting temporarily unavailable."},503,headers);
  }
};
