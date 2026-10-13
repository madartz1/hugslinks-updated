import Stripe from 'stripe';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export default async function handler(request){
 if(request.method!=='POST')return json(405,{error:'Method not allowed'});
 // Never initiate checkout unless an explicit, server-side launch flag is enabled.
 if(process.env.HUGS_MUSIC_CHECKOUT_ENABLED!=='true')return json(503,{error:'Music checkout is not live yet'});
 const key=process.env.HL_STUDIO_STRIPE_SECRET_KEY;
 const price=process.env.HUGS_MUSIC_STRIPE_PRICE_ID;
 if(!key||!/^price_[A-Za-z0-9]+$/.test(price||''))return json(503,{error:'Music checkout is not configured'});
 let input;try{input=await request.json()}catch{return json(400,{error:'Invalid request'})}
 const description=typeof input.description==='string'?input.description.trim():'';
 const genre=typeof input.genre==='string'?input.genre.trim():'';
 const occasion=typeof input.occasion==='string'?input.occasion.trim():'';
 if(!description||description.length>1500||genre.length>80||occasion.length>80||!genre||!occasion)return json(400,{error:'Complete the song details'});
 // Require an authenticated order before enabling the launch flag: no anonymous checkout.
 if(process.env.HUGS_MUSIC_ORDER_PIPELINE_READY!=='true')return json(503,{error:'Order fulfillment is not ready'});
 return json(503,{error:'Checkout awaits verified paid-order fulfillment'});
}
export const config={path:'/api/hugs-music/checkout'};
