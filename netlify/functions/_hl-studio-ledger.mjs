// HL Studio server-only credit ledger; no client-supplied balances or prices.
import { neon } from '@neondatabase/serverless';
const PLANS=Object.freeze({starter:100,growth:300,pro:800});
export const COSTS=Object.freeze({text:1,standard_image:10,premium_image:25,card_assembly:2,image_revision:10});
function db(){if(!process.env.HL_STUDIO_DATABASE_URL)throw Error('HL Studio database not configured');return neon(process.env.HL_STUDIO_DATABASE_URL)}
export async function summary(userId){
 if(!userId)throw Error('Missing authenticated account');
 const sql=db();
 const periods=await sql`SELECT p.id,p.allowance,p.available,p.reserved,p.spent,p.period_start,p.period_end,s.plan,s.status FROM hl_studio_periods p JOIN hl_studio_subscriptions s ON s.stripe_subscription_id=p.subscription_id WHERE p.user_id=${userId} AND s.user_id=${userId} AND p.period_start<=NOW() AND p.period_end>NOW() ORDER BY p.period_end DESC LIMIT 1`;
 if(!periods.length)return {active:false,allowance:0,available:0,reserved:0,spent:0,history:[]};
 const p=periods[0];
 const history=await sql`SELECT request_key,action,credits,status,created_at,output_ref FROM hl_studio_generations WHERE user_id=${userId} AND period_id=${p.id} ORDER BY created_at DESC LIMIT 50`;
 return {active:p.status==='active',plan:p.plan,allowance:p.allowance,available:p.available,reserved:p.reserved,spent:p.spent,period_end:p.period_end,history};
}
// Atomic SQL statement locks/debits the period and inserts one reservation.
// If there is no active paid period or adequate balance, no credit is reserved.
// This operation is provided as a CTE in one statement so its changes roll back together.
export async function reserve({userId,requestKey,action}){
 if(!userId || !/^[a-zA-Z0-9_-]{12,128}$/.test(requestKey||''))throw Error('Invalid account or request identifier');
 const cost=COSTS[action];if(!cost)throw Error('Unknown credit action');
 const sql=db();
 const rows=await sql`
 WITH prior AS (SELECT id,status,credits FROM hl_studio_generations WHERE user_id=${userId} AND request_key=${requestKey}),
 debit AS (
   UPDATE hl_studio_periods p SET available=p.available-${cost}, reserved=p.reserved+${cost}
   FROM hl_studio_subscriptions s
   WHERE p.subscription_id=s.stripe_subscription_id AND p.user_id=${userId} AND s.user_id=${userId}
     AND s.status='active' AND p.period_start<=NOW() AND p.period_end>NOW()
     AND p.available>=${cost} AND NOT EXISTS (SELECT 1 FROM prior)
   RETURNING p.id
 ),
 created AS (
   INSERT INTO hl_studio_generations(user_id,period_id,request_key,action,credits,status)
   SELECT ${userId},id,${requestKey},${action},${cost},'reserved' FROM debit
   ON CONFLICT(user_id,request_key) DO NOTHING RETURNING id,status,credits
 )
 SELECT id,status,credits FROM created UNION ALL SELECT id,status,credits FROM prior LIMIT 1`;
 // In a collision between concurrent first-time requests, the loser receives no new row;
 // caller must retry summary/read rather than attempting another provider call.
 return rows[0]||null;
}
export async function finish({userId,requestKey,success,outputRef=null}){
 const sql=db();
 // One statement updates the job exactly once and transfers reserved credits.
 const result=await sql`
 WITH claim AS (
   UPDATE hl_studio_generations SET status=${success?'completed':'failed'},
   output_ref=${success ? outputRef:null},updated_at=NOW()
   WHERE user_id=${userId} AND request_key=${requestKey} AND status='reserved'
   RETURNING period_id,credits,id,status
 ),
 change AS (
   UPDATE hl_studio_periods p SET reserved=p.reserved-c.credits,
   spent=p.spent+CASE WHEN ${success} THEN c.credits ELSE 0 END,
   available=p.available+CASE WHEN ${success} THEN 0 ELSE c.credits END
   FROM claim c WHERE p.id=c.period_id RETURNING p.id
 )
 SELECT c.id,c.status FROM claim c JOIN change d ON d.id=c.period_id`;
 return result[0]||null;
}
export {PLANS};
