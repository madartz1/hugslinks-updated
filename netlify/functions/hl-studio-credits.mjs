import {studioUser} from './_hl-studio-auth.mjs';
import {summary} from './_hl-studio-ledger.mjs';
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json'};
export default async function(req){
 if(req.method!=='GET')return Response.json({error:'Method not allowed'},{status:405,headers});
 const userId=studioUser(req);
 if(!userId)return Response.json({error:'HUGSLinks Studio sign-in required'},{status:401,headers});
 try{return Response.json(await summary(userId),{headers})}
 catch(e){console.error('HL Studio credits unavailable',e);return Response.json({error:'Unable to retrieve HUGSLinks Studio credits'},{status:503,headers})}
}
