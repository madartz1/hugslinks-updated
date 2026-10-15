// Run: npm install --no-save --package-lock=false @electric-sql/pglite
//      node --test tests/pilot-commerce.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { ensurePilotCommerce, customerPilotAction, sendPilotQuote, syncPilotPayment, isTestKey } from '../netlify/functions/_shared/hl-studio-pilot-commerce.mjs';
import pilotHandler from '../netlify/functions/hl-studio-pilot.mjs';
import webhookHandler from '../netlify/functions/hl-studio-stripe-webhook.mjs';
let db, sql;
const id='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(64);
const hash=createHash('sha256').update(token).digest('hex');
const event=(action,body={})=>({httpMethod:'POST',queryStringParameters:{action},body:JSON.stringify({token,...body})});
const data=result=>JSON.parse(result.body);
before(async()=>{
  db=new PGlite();
  sql=async(strings,...values)=>{const text=strings.reduce((s,v,i)=>s+(i?'$'+i:'')+v,'');return (await db.query(text,values)).rows;};
  await db.exec(`CREATE TABLE hl_studio_pilot_requests(id uuid PRIMARY KEY,email text,business_name text,quote_amount_cents integer,quote_scope text,quote_status text,updated_at timestamptz DEFAULT NOW(),is_demo boolean DEFAULT FALSE);`);
  await ensurePilotCommerce(sql);
  await ensurePilotCommerce(sql);
});
after(async()=>{await db.close();});
async function reset(status='sent'){
  await db.exec('DELETE FROM hl_studio_pilot_requests');
  await sql`INSERT INTO hl_studio_pilot_requests(id,email,business_name,quote_amount_cents,quote_scope,quote_status,quote_token_hash,quote_expires_at)
  VALUES(${id}::uuid,'test@example.invalid','Test restaurant',15000,'One 30-second video with captions and one revision.',${status},${hash},NOW()+INTERVAL '7 days')`;
}
const fakeSession=(overrides={})=>({id:'cs_test_session',url:'https://checkout.stripe.com/test',status:'open',livemode:false,mode:'payment',currency:'usd',amount_total:15000,client_reference_id:id,payment_status:'unpaid',metadata:{product:'hl-studio-pilot',request_id:id,attempt:'attempt1'},...overrides});
test('only test keys are accepted',()=>{
 assert.equal(isTestKey('sk_'+'test_unit'),true);assert.equal(isTestKey('rk_'+'test_unit'),true);
 assert.equal(isTestKey('sk_'+'live_unit'),false);assert.equal(isTestKey(' sk_'+'test_unit'),false);
});
test('production host is blocked before storage access',async()=>{
 const result=await pilotHandler(new Request('https://hugslinks.com/.netlify/functions/hl-studio-pilot?action=quote-view'));
 assert.equal(result.status,403);
});
test('webhook rejects an invalid signature before database access',async()=>{
 process.env.HL_STUDIO_DATABASE_URL='postgresql://unit.invalid/test';
 process.env.HL_STUDIO_STRIPE_SECRET_KEY='sk_'+'test_unit';
 process.env.HL_STUDIO_STRIPE_WEBHOOK_SECRET='unit-signing-secret';
 const result=await webhookHandler(new Request('https://deploy-preview-14--hugslinks-web-build.netlify.app/.netlify/functions/hl-studio-stripe-webhook',{method:'POST',headers:{'stripe-signature':'invalid'},body:'{}'}));
 assert.equal(result.status,400);
});
test('private view excludes email and cannot be loaded with another token',async()=>{
 await reset();const result=await customerPilotAction(sql,event('quote-view'));
 assert.equal(result.statusCode,200);assert.equal(data(result).quote.amount,15000);assert.equal(result.body.includes('test@example'),false);
 assert.equal((await customerPilotAction(sql,event('quote-view',{token:'b'.repeat(64)}))).statusCode,404);
});
test('expired links and GET requests are rejected',async()=>{
 await reset();await sql`UPDATE hl_studio_pilot_requests SET quote_expires_at=NOW()-INTERVAL '1 second'`;
 assert.equal((await customerPilotAction(sql,event('quote-view'))).statusCode,404);
 assert.equal((await customerPilotAction(sql,{...event('quote-view'),httpMethod:'GET'})).statusCode,405);
});
test('approval requires explicit consent; repeated approval preserves timestamp',async()=>{
 await reset();assert.equal((await customerPilotAction(sql,event('quote-approve'))).statusCode,400);
 await customerPilotAction(sql,event('quote-approve',{consent:true}));
 const [first]=await sql`SELECT quote_status,quote_approved_at FROM hl_studio_pilot_requests`;
 assert.equal(first.quote_status,'approved');assert.ok(first.quote_approved_at);
 await customerPilotAction(sql,event('quote-approve',{consent:true}));
 const [second]=await sql`SELECT quote_approved_at FROM hl_studio_pilot_requests`;
 assert.equal(String(second.quote_approved_at),String(first.quote_approved_at));
});
test('checkout cannot bypass approval or a live key guard',async()=>{
 await reset();assert.equal((await customerPilotAction(sql,event('quote-checkout'))).statusCode,409);
 await reset('approved');process.env.HL_STUDIO_STRIPE_SECRET_KEY='sk_'+'live_unit';
 assert.equal((await customerPilotAction(sql,event('quote-checkout'))).statusCode,503);
});
test('checkout uses saved amount and stable idempotency across lost responses',async()=>{
 await reset('approved');const calls=[];let fail=true;
 const stripe={checkout:{sessions:{create:async(params,opts)=>{calls.push({params,opts});if(fail){fail=false;throw Error('connection lost');}return fakeSession({metadata:params.metadata});}}}};
 await assert.rejects(customerPilotAction(sql,event('quote-checkout'),{stripe}));
 const result=await customerPilotAction(sql,event('quote-checkout',{amount:1}),{stripe});
 assert.equal(result.statusCode,200);assert.equal(calls[1].params.line_items[0].price_data.unit_amount,15000);
 assert.equal(calls[0].opts.idempotencyKey,calls[1].opts.idempotencyKey);
 assert.equal('payment_method_types' in calls[1].params,false);
 const [row]=await sql`SELECT checkout_session_id FROM hl_studio_pilot_requests`;assert.equal(row.checkout_session_id,'cs_test_session');
});
test('open sessions are reused; completed sessions cannot create duplicate payments',async()=>{
 await reset('approved');await sql`UPDATE hl_studio_pilot_requests SET checkout_session_id='cs_test_session'`;
 const stripe={checkout:{sessions:{retrieve:async()=>fakeSession()}}};
 assert.equal((await customerPilotAction(sql,event('quote-checkout'),{stripe})).statusCode,200);
 stripe.checkout.sessions.retrieve=async()=>fakeSession({status:'complete'});
 assert.equal((await customerPilotAction(sql,event('quote-checkout'),{stripe})).statusCode,409);
});
test('email failure restores the draft and successful email locks its quote',async()=>{
 await reset('draft');process.env.HL_STUDIO_RESEND_API_KEY='unit';process.env.HL_STUDIO_EMAIL_FROM='Studio <studio@example.invalid>';
 const mailer={emails:{send:async()=>({error:{message:'rejected'}})}};
 assert.equal((await sendPilotQuote(sql,event('quote-send',{id}),{mailer})).statusCode,502);
 let [row]=await sql`SELECT quote_status,quote_token_hash FROM hl_studio_pilot_requests`;assert.equal(row.quote_status,'draft');assert.equal(row.quote_token_hash,null);
 let sent;mailer.emails.send=async value=>{sent=value;return {data:{id:'email_1'}};};
 assert.equal((await sendPilotQuote(sql,event('quote-send',{id}),{mailer})).statusCode,200);
 assert.equal(sent.to,'test@example.invalid');assert.match(sent.text,/SANDBOX TEST ONLY/);
 [row]=await sql`SELECT quote_status,quote_token_hash FROM hl_studio_pilot_requests`;assert.equal(row.quote_status,'sent');assert.equal(row.quote_token_hash.length,64);
 assert.equal((await sendPilotQuote(sql,event('quote-send',{id}),{mailer})).statusCode,409);
});
test('internal demo cannot receive a quote email',async()=>{
 await reset('draft');await sql`UPDATE hl_studio_pilot_requests SET is_demo=TRUE`;
 assert.equal((await sendPilotQuote(sql,event('quote-send',{id}),{mailer:{emails:{send:()=>{throw Error('must not send')}}}})).statusCode,409);
});
test('webhook verifies amount, sandbox mode and paid state, then handles duplicates and delayed events',async()=>{
 await reset('approved');await sql`UPDATE hl_studio_pilot_requests SET checkout_session_id='cs_test_session',checkout_attempt='attempt1'`;
 let session=fakeSession();const stripe={checkout:{sessions:{retrieve:async()=>session}}};
 const hook={type:'checkout.session.completed',livemode:false,data:{object:session}};
 await syncPilotPayment(sql,stripe,hook);
 let [row]=await sql`SELECT payment_status FROM hl_studio_pilot_requests`;assert.equal(row.payment_status,'unpaid');
 session=fakeSession({payment_status:'paid',amount_total:1});await assert.rejects(syncPilotPayment(sql,stripe,hook));
 session=fakeSession({payment_status:'paid',livemode:true});await assert.rejects(syncPilotPayment(sql,stripe,hook));
 session=fakeSession({payment_status:'paid'});hook.type='checkout.session.async_payment_succeeded';
 await syncPilotPayment(sql,stripe,hook);await syncPilotPayment(sql,stripe,hook);
 [row]=await sql`SELECT payment_status,quote_status,paid_at FROM hl_studio_pilot_requests`;assert.equal(row.payment_status,'paid');assert.equal(row.quote_status,'paid');assert.ok(row.paid_at);
 session=fakeSession();hook.type='checkout.session.async_payment_failed';await syncPilotPayment(sql,stripe,hook);
 [row]=await sql`SELECT payment_status FROM hl_studio_pilot_requests`;assert.equal(row.payment_status,'paid');
 assert.equal((await customerPilotAction(sql,event('quote-checkout'))).statusCode,409);
});
