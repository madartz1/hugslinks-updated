import { modernHandler } from './_shared/hl-studio-modern.mjs';
import { syncPilotPayment } from './_shared/hl-studio-pilot-commerce.mjs';
import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
const reply = (statusCode, message) => ({ statusCode, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}, body:JSON.stringify({message}) });
const allowed = new Set(['active','trialing']);
const legacyHandler = async (event) => {
  if(event.httpMethod !== 'POST') return reply(405,'Method not allowed');
  if(!process.env.HL_STUDIO_STRIPE_SECRET_KEY || !process.env.HL_STUDIO_STRIPE_WEBHOOK_SECRET || !process.env.HL_STUDIO_DATABASE_URL) return reply(503,'Webhook not configured');
  const signature = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'];
  if(!signature) return reply(400,'Missing Stripe signature');
  const stripe = new Stripe(process.env.HL_STUDIO_STRIPE_SECRET_KEY);
  let verified;
  try {
    const payload = event.isBase64Encoded ? Buffer.from(event.body||'','base64') : event.body||'';
    verified = stripe.webhooks.constructEvent(payload,signature,process.env.HL_STUDIO_STRIPE_WEBHOOK_SECRET);
  } catch { return reply(400,'Invalid Stripe signature'); }
  if(verified.data.object.metadata?.product==='hl-studio-pilot'){
    if((event.headers?.host||event.headers?.Host||'').toLowerCase()!=='deploy-preview-14--hugslinks-web-build.netlify.app')return reply(403,'Pilot webhook is preview-only');
    try {
      await syncPilotPayment(neon(process.env.HL_STUDIO_DATABASE_URL),stripe,verified);
      return reply(200,'Sandbox pilot payment synchronized');
    } catch { return reply(500,'Pilot payment synchronization failed'); }
  }
  const types = new Set(['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed']);
  if(!types.has(verified.type)) return reply(200,'Event ignored');
  let subscriptionId;
  if(verified.type.startsWith('customer.subscription.')) subscriptionId = verified.data.object.id;
  else subscriptionId = verified.data.object.subscription;
  if(typeof subscriptionId !== 'string' || !subscriptionId.startsWith('sub_')) return reply(200,'No subscription');
  let stage = 'stripe_subscription_retrieval';
  try {
    // Always fetch current Stripe state: delayed or duplicate events cannot reactivate cancelled plans.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if(subscription.metadata?.product !== 'hl-studio') {
      // Checkout metadata is not inherited by the subscription. Verify subscription price IDs instead.
      const validPrices = ['HL_STUDIO_PRICE_STARTER','HL_STUDIO_PRICE_GROWTH','HL_STUDIO_PRICE_PRO'].map(k=>process.env[k]).filter(Boolean);
      if(!subscription.items.data.some(item=>validPrices.includes(item.price.id))) return reply(200,'Not an HL Studio subscription');
    }
    const priceId = subscription.items.data[0]?.price?.id || '';
    const plan = Object.entries({starter:'HL_STUDIO_PRICE_STARTER',growth:'HL_STUDIO_PRICE_GROWTH',pro:'HL_STUDIO_PRICE_PRO'}).find(([,key])=>process.env[key]===priceId)?.[0] || 'unknown';
    stage = 'database_client_initialization';
    const sql = neon(process.env.HL_STUDIO_DATABASE_URL);
    stage = 'database_table_creation';
    await sql`CREATE TABLE IF NOT EXISTS hl_studio_subscriptions (
      stripe_subscription_id TEXT PRIMARY KEY,
      stripe_customer_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      stripe_status TEXT NOT NULL,
      is_entitled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    stage = 'database_subscription_upsert';
    await sql`INSERT INTO hl_studio_subscriptions (stripe_subscription_id,stripe_customer_id,plan,stripe_status,is_entitled,updated_at)
      VALUES (${subscription.id},${customerId},${plan},${subscription.status},${allowed.has(subscription.status) && plan !== 'unknown'},NOW())
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
      stripe_customer_id=EXCLUDED.stripe_customer_id,plan=EXCLUDED.plan,
      stripe_status=EXCLUDED.stripe_status,is_entitled=EXCLUDED.is_entitled,updated_at=NOW()`;
    return reply(200,'Verified subscription synchronized');
  } catch(error) {
    // Log only a bounded stage and error classification; never log credentials,
    // connection strings, SQL text, or raw provider error messages.
    console.error('HL Studio webhook processing error', {
      stage,
      category: error?.type || error?.name || 'unknown',
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : undefined,
      code: typeof error?.code === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(error.code) ? error.code : undefined
    });
    return reply(500,'Webhook processing failed');
  }
};
export default modernHandler(legacyHandler);
