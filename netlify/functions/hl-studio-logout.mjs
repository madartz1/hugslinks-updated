import {sessionCookie,sameOrigin} from './_hl-studio-auth.mjs';
export default async function(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
}
