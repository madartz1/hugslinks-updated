import { getStore } from "@netlify/blobs";
import { PROJECTS } from "./_owner-content.mjs";

const headers={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"public, max-age=60, stale-while-revalidate=300"
};

const visible = projects => projects
  .filter(project=>project.published)
  .sort((a,b)=>a.category.localeCompare(b.category)||(a.sort_order||0)-(b.sort_order||0));

export default async request => {
  if(request.method!=="GET") return Response.json({ok:false,error:"Method not allowed."},{status:405,headers});
  try{
    const saved=await getStore("hugs-owner-content").get("project-directory",{type:"json",consistency:"strong"});
    const projects=Array.isArray(saved?.projects)?saved.projects:PROJECTS;
    return Response.json({ok:true,projects:visible(projects)},{headers});
  }catch(error){
    console.error(error);
    return Response.json({ok:true,projects:visible(PROJECTS)},{headers});
  }
};
