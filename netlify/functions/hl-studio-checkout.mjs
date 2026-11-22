import Stripe from 'stripe';
import {studioUser} from './_hl-studio-auth.mjs';
const plans={starter:{price:'HL_STUDIO_PRICE_STARTER',credits:100},growth:{price:'HL_STUDIO_PRICE_GROWTH',credits:300},pro:{price:'HL_STUDIO_PRICE_PRO',credits:800}};
const headers={'Cache-Control':'no-store'};
export default async function(req){
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
 // Explicit rollout switch: no customer can purchase until the full credits system is reviewed.
 if(process.env.HL_STUDIO_BILLING_ENABLED!=='true')return Response.json({error:'HUGSLinks Studio subscriptions are not accepting new purchases yet.'},{status:503,headers});
 const userId=studioUser(req);
 if(!userId)return Response.json({error:'Please sign in to your HUGSLinks Studio account.'},{status:401,headers});
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid request'},{status:400,headers})}
 const plan=String(body?.plan||'').toLowerCase();
 if(!Object.hasOwn(plans,plan))return Response.json({error:'Invalid subscription plan'},{status:400,headers});
 const price=process.env[plans[plan].price];
 if(!price||!/^price_/.test(price)||!process.env.STRIPE_SECRET_KEY)return Response.json({error:'Subscriptions are not configured'},{status:503,headers});
 try{
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 const origin=new URL(req.url).origin;
 const session=await stripe.checkout.sessions.create({
 mode:'subscription',line_items:[{price,quantity:1}],client_reference_id:userId,
 subscription_data:{metadata:{studio_user_id:userId,studio_plan:plan}},
 metadata:{studio_user_id:userId,studio_plan:plan},
 success_url:origin+'/studio/account.html?checkout=complete',
 cancel_url:origin+'/studio/plans.html?checkout=canceled'
 });
 return Response.json({url:session.url},{headers});
 }catch(e){console.error('HL Studio checkout error',e);return Response.json({error:'Checkout is temporarily unavailable'},{status:503,headers})}
}
