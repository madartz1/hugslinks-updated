import {getStore,json,digest,token,session} from "./_art-voter-auth.mjs";
const emailOK=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export default async request=>{
if(!process.env.HUGS_VOTER_SESSION_SECRET||!process.env.HUGS_VOTER_RESEND_API_KEY||!process.env.HUGS_VOTER_FROM_EMAIL)return json({ok:false,error:"Member email sign-in is not configured yet."},503);
if(request.method==="GET"){const email=await session(request);return json({ok:true,signed_in:!!email,email:email||null})}
if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid request"},400)}
const action=b.action;
if(action==="logout")return json({ok:true},200,{"Set-Cookie":"hugs_voter=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"});
const email=String(b.email||"").trim().toLowerCase();
if(!emailOK(email)||email.length>254)return json({ok:false,error:"Enter a valid email"},400);
const store=getStore("hugs-voter-codes"),key=await digest(email);
if(action==="request"){
const previous=await store.get(key,{type:"json",consistency:"strong"});
if(previous?.last_sent&&Date.now()-previous.last_sent<60000)return json({ok:false,error:"Wait one minute before requesting another code."},429);
const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
await store.setJSON(key,{hash:await digest(code+":"+email+":"+process.env.HUGS_VOTER_SESSION_SECRET),expires:Date.now()+600000,attempts:0,last_sent:Date.now()});
const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+process.env.HUGS_VOTER_RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.HUGS_VOTER_FROM_EMAIL,to:[email],subject:"Your HUGS Art Gallery sign-in code",text:"Your HUGS Art Gallery sign-in code is "+code+". It expires in 10 minutes. If you did not request it, ignore this message."})});
if(!res.ok){console.error("Resend voter email failed",res.status);return json({ok:false,error:"Unable to send code right now."},502)}
return json({ok:true,message:"Check your email for your six-digit code."});
}
if(action==="verify"){
const code=String(b.code||"");if(!/^\d{6}$/.test(code))return json({ok:false,error:"Enter the six-digit code."},400);
const rec=await store.get(key,{type:"json",consistency:"strong"});
if(!rec||rec.expires<Date.now()||rec.attempts>=5)return json({ok:false,error:"Code expired. Request a new one."},401);
rec.attempts++;await store.setJSON(key,rec);
if(rec.hash!==await digest(code+":"+email+":"+process.env.HUGS_VOTER_SESSION_SECRET))return json({ok:false,error:"Incorrect code."},401);
await store.delete(key);
return json({ok:true,email},200,{"Set-Cookie":"hugs_voter="+await token(email)+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000"});
}
return json({ok:false,error:"Unsupported action"},400);
};