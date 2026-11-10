import { getStore } from "@netlify/blobs";
import { STORE_PRODUCTS } from "./_owner-content.mjs";

const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60, stale-while-revalidate=300"};

export default async request => {
  if(request.method !== "GET") return Response.json({ok:false,error:"Method not allowed."},{status:405,headers});
  try{
    const saved=await getStore("hugs-owner-content").get("store-products",{type:"json",consistency:"strong"});
    const products=Array.isArray(saved?.products)?saved.products:STORE_PRODUCTS;
    return Response.json({ok:true,products:products.filter(item=>item.published).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))},{headers});
  }catch(error){
    console.error(error);
    return Response.json({ok:true,products:STORE_PRODUCTS},{headers});
  }
};
