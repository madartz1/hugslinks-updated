import Stripe from 'stripe';
import { Resend } from 'resend';
import { randomBytes, createHash } from 'node:crypto';

export const PILOT_ORIGIN = 'https://deploy-preview-14--hugslinks-web-build.netlify.app';
const digest = token => createHash('sha256').update(token).digest('hex');
const response = (statusCode, body) => ({ statusCode, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' }, body: JSON.stringify(body) });
const bodyOf = event => { try { return JSON.parse(event.body || '{}'); } catch { return {}; } };
export const isTestKey = key => typeof key === 'string' && /^(sk|rk)_test_/.test(key) && key === key.trim();
const stripeClient = () => {
  const key = process.env.HL_STUDIO_STRIPE_SECRET_KEY;
  if (!isTestKey(key)) throw new Error('Sandbox checkout requires a test key. Live payments are disabled.');
  return new Stripe(key, { apiVersion:'2026-08-26.dahlia' });
};

export async function ensurePilotCommerce(sql) {
  await sql`ALTER TABLE hl_studio_pilot_requests
    ADD COLUMN IF NOT EXISTS quote_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
    ADD COLUMN IF NOT EXISTS checkout_attempt TEXT,
    ADD COLUMN IF NOT EXISTS checkout_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`;
}

// The email link's bearer token stays in the URL fragment, outside server logs.
// Only its hash is stored. No external scripts run on the customer page.
export async function sendPilotQuote(sql, event, dependencies = {}) {
  if (event.httpMethod !== 'POST') return response(405, {error:'Method not allowed'});
  const {id} = bodyOf(event);
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) return response(400, {error:'Invalid application'});
  const key = process.env.HL_STUDIO_RESEND_API_KEY;
  const from = process.env.HL_STUDIO_EMAIL_FROM;
  if (!key || !from) return response(503, {error:'Quote email is not configured.'});
  const token = randomBytes(32).toString('hex');
  const tokenHash = digest(token);
  const rows = await sql`UPDATE hl_studio_pilot_requests
    SET quote_status='sending',quote_token_hash=${tokenHash},quote_expires_at=NOW()+INTERVAL '7 days',updated_at=NOW()
    WHERE id=${id}::uuid AND quote_status='draft' AND quote_amount_cents>=50
      AND length(quote_scope)>=20 AND is_demo=FALSE AND payment_status='unpaid'
    RETURNING email,business_name,quote_amount_cents,quote_scope`;
  if (!rows.length) return response(409, {error:'Save a quote of at least $0.50 for a customer application first. Sent quotes are locked; the internal sample cannot receive email.'});
  const row = rows[0];
  const link = PILOT_ORIGIN + '/studio/quote/#' + token;
  let sent;
  try {
    const mailer = dependencies.mailer || new Resend(key);
    sent = await mailer.emails.send({from, to:row.email, subject:'HL Studio — sandbox quote for review',
      text:`SANDBOX TEST ONLY — no real booking or charge.\n\n${row.business_name}\nQuote: $${(row.quote_amount_cents/100).toFixed(2)} USD\n\n${row.quote_scope}\n\nReview the quote and simulate approval and payment:\n${link}\n\nThis private link expires in seven days. Anyone with the link can view this quote; do not forward it. This preview does not create a production booking.`
    });
    if (sent.error || !sent.data?.id) throw new Error('Email provider rejected request');
  } catch {
    await sql`UPDATE hl_studio_pilot_requests SET quote_status='draft',quote_token_hash=NULL,quote_expires_at=NULL WHERE id=${id}::uuid AND quote_token_hash=${tokenHash} AND quote_status='sending'`;
    return response(502, {error:'Quote email could not be sent. The draft is unchanged; please retry.'});
  }
  await sql`UPDATE hl_studio_pilot_requests SET quote_status='sent',quote_sent_at=NOW(),updated_at=NOW() WHERE id=${id}::uuid AND quote_token_hash=${tokenHash} AND quote_status='sending'`;
  return response(200, {message:'Sandbox quote email sent. The customer link expires in seven days.'});
}

export async function customerPilotAction(sql, event, dependencies = {}) {
  if (event.httpMethod !== 'POST') return response(405, {error:'Method not allowed'});
  const body = bodyOf(event);
  if (!/^[a-f0-9]{64}$/.test(body.token || '')) return response(404, {error:'Quote link is invalid or expired.'});
  const tokenHash = digest(body.token);
  const rows = await sql`SELECT id,business_name,quote_amount_cents,quote_scope,quote_status,payment_status,checkout_session_id,checkout_attempt,checkout_started_at,email
    FROM hl_studio_pilot_requests WHERE quote_token_hash=${tokenHash} AND quote_expires_at>NOW() AND quote_status IN ('sent','approved','paid') LIMIT 1`;
  if (!rows.length) return response(404, {error:'Quote link is invalid or expired. Contact HL Studio for help.'});
  const row = rows[0];
  const action = event.queryStringParameters.action;
  if (action === 'quote-view') return response(200, {quote:{business:row.business_name,amount:row.quote_amount_cents,scope:row.quote_scope,status:row.quote_status,payment:row.payment_status,sandbox:true}});
  if (action === 'quote-approve') {
    if (body.consent !== true) return response(400, {error:'Confirm the sandbox quote before continuing.'});
    await sql`UPDATE hl_studio_pilot_requests SET quote_status='approved',quote_approved_at=NOW(),updated_at=NOW()
      WHERE id=${row.id}::uuid AND quote_token_hash=${tokenHash} AND quote_status='sent'`;
    return response(200, {message:'Sandbox quote approved. No production booking or real charge was made.'});
  }
  if (action !== 'quote-checkout') return response(404, {error:'Not found'});
  if (row.quote_status !== 'approved' || row.payment_status === 'paid') return response(409, {error:'Approve the quote before checkout. Paid quotes cannot be paid again.'});
  let stripe;
  try { stripe = dependencies.stripe || stripeClient(); } catch(error) { return response(503, {error:error.message}); }
  if (row.checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(row.checkout_session_id);
    if (session.livemode !== false) return response(409, {error:'Only sandbox payments are allowed.'});
    if (session.status === 'open') return response(200, {url:session.url});
    if (session.status === 'complete') return response(409, {error:'Checkout is complete. Awaiting verified payment confirmation; refresh shortly.'});
    if (session.status !== 'expired') return response(409, {error:'Checkout is unavailable.'});
    await sql`UPDATE hl_studio_pilot_requests SET checkout_session_id=NULL,checkout_attempt=NULL,checkout_started_at=NULL WHERE id=${row.id}::uuid AND checkout_session_id=${session.id} AND payment_status='unpaid'`;
  }
  // A stable attempt makes concurrent clicks/retries use the same Stripe session.
  const attempt = randomBytes(16).toString('hex');
  const locks = await sql`UPDATE hl_studio_pilot_requests
    SET checkout_attempt=COALESCE(checkout_attempt,${attempt}),checkout_started_at=COALESCE(checkout_started_at,NOW())
    WHERE id=${row.id}::uuid AND quote_status='approved' AND payment_status='unpaid' AND checkout_session_id IS NULL
    RETURNING checkout_attempt,checkout_started_at`;
  if (!locks.length) return response(409, {error:'Checkout is already starting. Please retry shortly.'});
  const lock = locks[0];
  // Do not reuse a Stripe idempotency key after Stripe's 24-hour retention window.
  if (Date.now()-new Date(lock.checkout_started_at).getTime()>23*60*60*1000) return response(409, {error:'Checkout needs administrator assistance. No new payment was created.'});
  const identifier = 'hl-pilot-' + lock.checkout_attempt.slice(0,8).replace(/[0-9a-f]/g, c => String.fromCharCode(97+parseInt(c,16)));
  const session = await stripe.checkout.sessions.create({mode:'payment',integration_identifier:identifier,
    customer_email:row.email,client_reference_id:row.id,
    line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:row.quote_amount_cents,product_data:{name:'HL Studio managed production — SANDBOX TEST',description:'Test quote '+row.id.slice(0,8).toUpperCase()}}}],
    metadata:{product:'hl-studio-pilot',request_id:row.id,attempt:lock.checkout_attempt},
    success_url:PILOT_ORIGIN+'/studio/quote/?checkout=returned',cancel_url:PILOT_ORIGIN+'/studio/quote/?checkout=cancelled'
  }, {idempotencyKey:'hl-pilot-'+row.id+'-'+lock.checkout_attempt});
  if (session.livemode !== false) throw new Error('Unexpected live session');
  await sql`UPDATE hl_studio_pilot_requests SET checkout_session_id=${session.id},updated_at=NOW() WHERE id=${row.id}::uuid AND checkout_attempt=${lock.checkout_attempt} AND payment_status='unpaid'`;
  return response(200, {url:session.url});
}

// Called only after the parent webhook verifies Stripe's signature.
export async function syncPilotPayment(sql, stripe, event) {
  if (!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type)
    || event.data.object.metadata?.product !== 'hl-studio-pilot') return false;
  if (event.livemode !== false) throw new Error('Live pilot event rejected');
  const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
  if (session.livemode !== false || session.mode !== 'payment' || session.currency !== 'usd' || session.metadata?.product !== 'hl-studio-pilot') throw new Error('Invalid pilot payment');
  const id = session.metadata.request_id;
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Invalid payment reference');
  const rows = await sql`SELECT quote_amount_cents,checkout_session_id,checkout_attempt,quote_status,payment_status FROM hl_studio_pilot_requests WHERE id=${id}::uuid LIMIT 1`;
  const row = rows[0];
  if (!row || session.amount_total !== row.quote_amount_cents || session.client_reference_id !== id || session.metadata.attempt !== row.checkout_attempt
    || row.checkout_session_id !== session.id || !['approved','paid'].includes(row.quote_status)) throw new Error('Payment does not match approved quote');
  if (session.payment_status === 'paid') {
    await sql`UPDATE hl_studio_pilot_requests SET payment_status='paid',quote_status='paid',paid_at=COALESCE(paid_at,NOW()),updated_at=NOW() WHERE id=${id}::uuid AND checkout_session_id=${session.id} AND payment_status<>'paid'`;
  }
  // Failed or delayed payments never fulfill a quote or downgrade a paid one.
  return true;
}
