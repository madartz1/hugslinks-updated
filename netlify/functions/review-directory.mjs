import { getStore } from "@netlify/blobs";
import { REVIEW_BUSINESSES } from "./_owner-content.mjs";

const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, stale-while-revalidate=300"};

export async function allReviewBusinesses(){
  const saved=await getStore("hugs-owner-content").get("review-businesses",{type:"json",consistency:"strong"});
  return Array.isArray(saved?.businesses)?saved.businesses:REVIEW_BUSINESSES;
}

export default async request => {
  if(request.method !== "GET") return Response.json({ok:false,error:"Method not allowed."},{status:405,headers});
  try{
    const businesses=(await allReviewBusinesses()).filter(item=>item.published).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    return Response.json({ok:true,businesses},{headers});
  }catch(error){
    console.error(error);
    return Response.json({ok:true,businesses:REVIEW_BUSINESSES},{headers});
  }
};
