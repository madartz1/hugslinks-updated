const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const tones=new Set(['heartfelt','joyful','inspirational','romantic','playful']);
export default async function handler(request){
 if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
 // Explicit gate until abuse controls and usage limits are configured.
 if((process.env.HUGS_CARDS_AI_MESSAGES_ENABLED||process.env.HUGS_CARD_AI_MESSAGES_ENABLED)!=='true')return reply(503,{error:'AI message generation is not enabled yet'});
 const key=process.env.HUGS_CARDS_OPENAI_API_KEY||process.env.HL_STUDIO_OPENAI_API_KEY;
 if(!key)return reply(503,{error:'AI provider is not configured'});
 let body;try{body=await request.json()}catch{return reply(400,{error:'Invalid request'})}
 const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
 const tone=typeof body.tone==='string'?body.tone:'heartfelt';
 const occasion=typeof body.occasion==='string'?body.occasion.slice(0,80):'';
 if(prompt.length<12||prompt.length>700||!tones.has(tone))return reply(400,{error:'Please provide a valid message description'});
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model:process.env.HUGS_CARD_AI_MODEL||'gpt-4o-mini',temperature:0.8,max_tokens:260,messages:[{role:'system',content:'Write a single warm, original greeting-card message. Do not include markdown, titles, signatures, or personal facts not provided. Keep under 130 words. The user will edit it.'},{role:'user',content:JSON.stringify({occasion,tone,request:prompt})}]}),signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok)return reply(502,{error:'AI provider unavailable'});
  const data=await response.json();
  const message=data.choices?.[0]?.message?.content?.trim();
  if(!message)return reply(502,{error:'No message generated'});
  return reply(200,{message:message.slice(0,1500)});
 }catch{return reply(502,{error:'Could not generate a message. Try again later'})}
}
export const config={path:'/api/hugs-cards/generate-message'};
