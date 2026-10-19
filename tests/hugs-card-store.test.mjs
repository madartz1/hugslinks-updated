// Optional SQL integration check: npm install --no-save --package-lock=false @electric-sql/pglite
import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {makeStore} from '../netlify/functions/_shared/hugs-card-links.mjs';
test('database enforces code consumption, idempotent card saves, mail claims, quotas, and cleanup',async()=>{
 const db=new PGlite();
 try{
  const sql=async(strings,...values)=>(await db.query(strings.reduce((s,v,i)=>s+(i?'$'+i:'')+v,''),values)).rows;
  const store=makeStore(sql);await store.init();await store.init();
  await store.putCode({id:'code',email:'sender@example.com',code_hash:'hash',expires_at:new Date(Date.now()+60000).toISOString()});
  for(let i=1;i<=5;i++)assert.equal((await store.attempt('code')).attempts,i);assert.equal(await store.attempt('code'),undefined);
  assert.equal(await store.useCode('code'),true);assert.equal(await store.useCode('code'),false);
  const card={id:'card',owner:'sender@example.com',request_key:'key',view_hash:'hash',card:{fields:{message:'<test>'},media:{}},recipient_email:'friend@example.com',recipient_name:'Friend',note:'A note',expires_at:new Date(Date.now()+86400000).toISOString()};
  const created=await store.create(card);assert.equal(created.state,'uploading');assert.equal(created.card.fields.message,'<test>');
  const repeated=await store.create({...card,id:'other'});assert.equal(repeated.id,'card');assert.equal((await store.find(card.owner,'key')).id,'card');await store.rememberLink('card','encrypted');assert.equal((await store.list(card.owner))[0].view_token,'encrypted');assert.equal((await store.list('other@example.com')).length,0);
  await store.ready('card');assert.equal((await store.get('card')).state,'ready');
  const claims=await Promise.all([store.claimMail('card'),store.claimMail('card')]);assert.equal(claims.filter(Boolean).length,1);
  await store.mailFailed('card');assert.equal(await store.claimMail('card'),true);await store.mailDone('card','provider');assert.equal(await store.claimMail('card'),false);assert.equal((await store.get('card')).email_state,'sent');
  await store.limit('quota',1,3600);await assert.rejects(store.limit('quota',1,3600),/Please wait/);
  await store.revoke('card');assert.equal((await store.expired()).length,1);await store.purged('card');assert.equal((await store.expired()).length,0);assert.deepEqual((await store.get('card')).card,{});assert.equal((await store.get('card')).recipient_email,'');
  await store.cleanCodes();
 }finally{await db.close();}
});
