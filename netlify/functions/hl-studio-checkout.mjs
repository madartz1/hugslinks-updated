import Stripe from 'stripe';
const plans = { starter: 'HL_STUDIO_PRICE_STARTER', growth: 'HL_STUDIO_PRICE_GROWTH', pro: 'HL_STUDIO_PRICE_PRO' };
const json = (statusCode, body) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
export const handler = async (event) => {
  if(event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  if(!process.env.HL_STUDIO_STRIPE_SECRET_KEY) return json(503,{error:'Checkout is not configured yet'});
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400,{error:'Invalid JSON'}); }
  const plan = typeof body.plan === 'string' ? body.plan : '';
  if(!Object.hasOwn(plans,plan)) return json(400,{error:'Invalid subscription plan'});
  const price = process.env[plans[plan]];
  if(!price || !/^price_[A-Za-z0-9]+$/.test(price)) return json(503,{error:'Subscription plan is not configured'});
  const origin = process.env.CONTEXT === 'deploy-preview' ? process.env.DEPLOY_PRIME_URL : (process.env.URL || process.env.DEPLOY_PRIME_URL);
  if(!origin || !/^https:\/\//.test(origin)) return json(503,{error:'Site URL is not configured'});
  const key = process.env.HL_STUDIO_STRIPE_SECRET_KEY;
  // Do not reject valid Stripe keys based on a locally invented character pattern.
  // Stripe's API is authoritative about whether a credential is valid.
  if (key !== key.trim()) {
    console.error('HL Studio checkout configuration error', { reason: 'Leading or trailing whitespace in Stripe key', context: process.env.CONTEXT || 'unknown' });
    return json(503, {error:'Checkout Sandbox key contains extra whitespace'});
  }
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode:'subscription',line_items:[{price,quantity:1}],
      success_url:origin+'/studio/?checkout=success',
      cancel_url:origin+'/studio/?checkout=cancel',
      allow_promotion_codes:true,
      billing_address_collection:'auto',
      metadata:{product:'hl-studio',plan},
      subscription_data:{metadata:{product:'hl-studio',plan}}
    });
    return json(200,{url:session.url});
  } catch(e) {
    console.error('HL Studio checkout failed', {type:e?.type || 'unknown',code:e?.code || null,statusCode:e?.statusCode || null,requestId:e?.requestId || null,context:process.env.CONTEXT || 'unknown'});
    return json(502,{error:'Unable to start checkout'});
  }
};