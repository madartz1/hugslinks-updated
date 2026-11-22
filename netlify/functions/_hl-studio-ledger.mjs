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
export async function reserve({userId,requestKey,action}) {
  if (!userId || !/^[a-zA-Z0-9_-]{12,128}$/.test(requestKey || '')) throw Error('Invalid reservation');
  const cost = COSTS[action]; if (!cost) throw Error('Unknown action');
  const sql = db();
  const rows = await sql`SELECT * FROM hl_studio_reserve(${userId},${requestKey},${action},${cost})`;
  return rows[0] || null;
}
export async function finish({userId,requestKey,success,outputRef=null}) {
  if (!userId || !/^[a-zA-Z0-9_-]{12,128}$/.test(requestKey || '')) throw Error('Invalid settlement');
  const sql=db();
  const rows=await sql`SELECT * FROM hl_studio_finish(${userId},${requestKey},${Boolean(success)},${outputRef})`;
  return rows[0] || null;
}
export {PLANS};