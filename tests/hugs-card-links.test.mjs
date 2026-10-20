import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeHandler,CHUNK_SIZE,sessionFor,readSession,validateCard,protectMedia,openMedia} from '../netlify/functions/_shared/hugs-card-links.mjs';
const origin='https://deploy-preview-14--hugslinks-web-build.netlify.app';
const sha=b=>createHash('sha256').update(b).digest('hex');
const recipient='recipient@example.com',owner='sender@example.com',secret='test-only-sender-signing-key';
function setup(){
 const cards=new Map(),codes=new Map(),objects=new Map(),emails=[],counts=new Map();let failMail=false;
 const store={init:async()=>{},limit:async(k,max)=>{const n=(counts.get(k)||0)+1;counts.set(k,n);if(n>max)throw Object.assign(Error('Limit reached'),{status:429});},putCode:async c=>codes.set(c.id,{...c,attempts:0}),attempt:async id=>{const c=codes.get(id);if(!c||c.used||c.attempts>=5||new Date(c.expires_at)<=new Date())return;c.attempts++;return c;},useCode:async id=>{const c=codes.get(id);if(c.used)return false;c.used=true;return true;},find:async(o,k)=>[...cards.values()].find(c=>c.owner===o&&c.request_key===k),get:async id=>cards.get(id),list:async(owner,offset=0)=>[...cards.values()].filter(c=>c.owner===owner&&!c.deleted_at).slice(offset,offset+51).map(c=>({...c,title:c.card.fields.title})),rememberLink:async(id,value)=>cards.get(id).view_token=value,create:async c=>{const row={...c,created_at:new Date().toISOString(),state:'uploading',email_state:'pending'};cards.set(c.id,row);return row;},ready:async id=>cards.get(id).state='ready',claimMail:async id=>{const r=cards.get(id);if(r.email_state!=='pending')return false;r.email_state='sending';return true;},mailDone:async(id,p)=>Object.assign(cards.get(id),{email_state:'sent',provider_id:p}),mailFailed:async id=>cards.get(id).email_state='pending',revoke:async id=>cards.get(id).deleted_at=new Date().toISOString(),purged:async id=>cards.get(id).purged_at=new Date().toISOString()};
 const storage={put:async(id,slot,part,b)=>objects.set(id+'/'+slot+'/'+part,Buffer.from(b)),head:async(id,slot,part)=>{const b=objects.get(id+'/'+slot+'/'+part);if(!b)throw Error('Not uploaded');return b.length;},get:async(id,slot,part)=>objects.get(id+'/'+slot+'/'+part),remove:async r=>{for(const k of objects.keys())if(k.startsWith(r.id+'/'))objects.delete(k);}};
 const deps={configured:true,secret,store,storage,send:async(to,content,key)=>{if(failMail)throw Object.assign(Error('Email temporarily unavailable'),{status:502});emails.push({to,...content,key});return 'provider-test-id';}};
 const handler=makeHandler(deps),session=sessionFor(owner,secret);
 const call=async(action,{body,bytes,id,slot,part,auth=session,host=origin}={})=>{
  const q=new URLSearchParams({action});if(id)q.set('id',id);if(slot)q.set('slot',slot);if(part!==undefined)q.set('part',part);
  const headers={origin:host};if(auth)headers.authorization='Bearer '+auth;if(bytes)headers['content-type']='application/octet-stream';else if(body)headers['content-type']='application/json';
  return handler(new Request(host+'/.netlify/functions/hugs-card-links?'+q,{method:['status','view','part','list','owner-view','owner-part'].includes(action)?'GET':'POST',headers,body:bytes|| (body?JSON.stringify(body):undefined)}));
 };
 return {call,cards,codes,objects,emails,failMail:v=>failMail=v};
}
function cardInput(bytes){return {requestKey:'a'.repeat(32),viewToken:'b'.repeat(64),recipientEmail:recipient,recipientName:'A friend',note:'Love <script>alert(1)</script>',card:{fields:{title:'My HUG',from:'Sender',message:'Hello',brief:'must never be stored',theme:'rose'},media:bytes?{video:{type:'video/mp4',size:bytes.length,hashes:Array.from({length:Math.ceil(bytes.length/CHUNK_SIZE)},(_,i)=>sha(bytes.subarray(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE)))}}:{}}};}
test('sender verification is one-use and an invalid code cannot authorize uploads',async()=>{
 const h=setup();let r=await h.call('create',{body:cardInput(),auth:''});assert.equal(r.status,401);
 r=await h.call('request-code',{body:{email:owner},auth:''});const {challenge}=await r.json();assert.equal(h.emails.length,1);
 r=await h.call('verify-code',{body:{challenge,code:'000000'},auth:''});assert.equal(r.status,401);
 const code=h.emails[0].text.match(/code is (\d{6})/)[1];r=await h.call('verify-code',{body:{challenge,code},auth:''});const result=await r.json();assert.equal(readSession(result.session,secret),owner);
 assert.equal((await h.call('verify-code',{body:{challenge,code},auth:''})).status,401);
 assert.equal(readSession(result.session+'bad',secret),null);assert.equal(readSession(sessionFor(owner,secret,0),secret),null);
});
test('large card uploads in bounded parts; link only works after every part is verified',async()=>{
 const h=setup(),bytes=Buffer.alloc(25*1024*1024,7),input=cardInput(bytes);
 const r=await h.call('create',{body:input});assert.equal(r.status,200);const {id}=await r.json();assert.equal(h.cards.get(id).card.fields.brief,undefined);
 assert.equal((await h.call('view',{id,auth:input.viewToken})).status,404);
 assert.equal((await h.call('finish',{id,body:{}})).status,409);assert.equal(h.cards.get(id).state,'uploading');
 assert.equal((await h.call('upload',{id,slot:'video',part:0,bytes:Buffer.alloc(CHUNK_SIZE,9)})).status,400);
 for(let part=0;part<input.card.media.video.hashes.length;part++){const b=bytes.subarray(part*CHUNK_SIZE,(part+1)*CHUNK_SIZE);assert.ok(b.length<=CHUNK_SIZE);assert.equal((await h.call('upload',{id,slot:'video',part,bytes:b})).status,200);}
 assert.equal((await h.call('finish',{id,body:{}})).status,200);
 assert.equal((await h.call('view',{id,auth:'c'.repeat(64)})).status,404);
 const view=await h.call('view',{id,auth:input.viewToken});const data=await view.json();assert.equal(data.recipient_email,undefined);assert.equal(data.card.media.video.parts,13);assert.equal(view.headers.get('cache-control'),'no-store');
 const part=await h.call('part',{id,slot:'video',part:12,auth:input.viewToken});assert.equal((await part.arrayBuffer()).byteLength,1024*1024);
 assert.equal((await h.call('upload',{id,slot:'video',part:0,bytes:bytes.subarray(0,CHUNK_SIZE)})).status,409);
 const same=await(await h.call('create',{body:input})).json();assert.equal(same.id,id);assert.equal(h.cards.size,1);
});
test('email retries are safe, recipient is fixed, escaped copy, and deletion revokes all access',async()=>{
 const h=setup(),input=cardInput(),{id}=await(await h.call('create',{body:input})).json();await h.call('finish',{id,body:{}});
 h.failMail(true);assert.equal((await h.call('send',{id,body:{viewToken:input.viewToken}})).status,502);
 h.failMail(false);assert.equal((await h.call('send',{id,body:{viewToken:input.viewToken,recipientEmail:'other@example.com'}})).status,200);
 assert.equal(h.emails.length,1);assert.equal(h.emails[0].to,recipient);assert.match(h.emails[0].html,/&lt;script&gt;/);assert.match(h.emails[0].text,/view-card.html#/);
 assert.equal((await h.call('send',{id,body:{viewToken:input.viewToken}})).status,200);assert.equal(h.emails.length,1);
 assert.equal((await h.call('delete',{id,body:{},auth:sessionFor('other@example.com',secret)})).status,404);
 assert.equal((await h.call('delete',{id,body:{}})).status,200);assert.equal((await h.call('view',{id,auth:input.viewToken})).status,404);assert.ok(h.cards.get(id).purged_at);
});
test('expired links, unsafe media, unofficial hosts, and daily quota are rejected',async()=>{
 const h=setup();assert.equal((await h.call('status',{host:'https://untrusted.example'})).status,403);
 assert.throws(()=>validateCard({card:{media:{cover:{type:'image/svg+xml',size:50,hashes:['a'.repeat(64)]}}}}),/Unsupported/);
 assert.throws(()=>validateCard({card:{media:{video:{type:'video/mp4',size:26*1024*1024,hashes:[]}}}}),/too large/);
 let first;for(let i=0;i<3;i++){const input=cardInput();input.requestKey=i.toString().repeat(32);const r=await h.call('create',{body:input});assert.equal(r.status,200);first=await r.json();}
 const extra=cardInput();extra.requestKey='f'.repeat(32);assert.equal((await h.call('create',{body:extra})).status,429);
 await h.call('finish',{id:first.id,body:{}});h.cards.get(first.id).expires_at='2000-01-01T00:00:00Z';assert.equal((await h.call('view',{id:first.id,auth:'b'.repeat(64)})).status,404);
});

test('live card domains allow code requests but still require verification and same-origin writes',async()=>{
 for(const host of ['https://hugslinks.com','https://www.hugslinks.com']){
  const h=setup();assert.equal((await h.call('status',{host})).status,200);
  assert.equal((await h.call('request-code',{host,body:{email:owner},auth:''})).status,200);
  assert.equal(h.emails.length,1);
  assert.equal((await h.call('list',{host,auth:''})).status,401);
  assert.equal((await h.call('create',{host,body:cardInput(),auth:''})).status,401);
  const blocked=await makeHandler({configured:true})(new Request(host+'/.netlify/functions/hugs-card-links?action=request-code',{method:'POST',headers:{origin:'https://untrusted.example'},body:JSON.stringify({email:owner})}));
  assert.equal(blocked.status,403);
 }
 const h=setup();assert.equal((await h.call('status',{host:'https://hugslinks.com.attacker.example'})).status,403);
});

test('stored media is encrypted and cannot be opened using a different card identity',()=>{const original=Buffer.from('private family photo');const sealed=protectMedia(original,secret,'card/inside/0');assert.equal(sealed.length,original.length+28);assert.equal(sealed.includes(original),false);assert.deepEqual(openMedia(sealed,secret,'card/inside/0'),original);assert.throws(()=>openMedia(sealed,secret,'other/inside/0'));sealed[sealed.length-1]^=1;assert.throws(()=>openMedia(sealed,secret,'card/inside/0'));});

test('My Cards is scoped to the verified owner and restores share links without exposing other cards',async()=>{
 const h=setup(),input=cardInput(Buffer.from('private-video')),{id}=await(await h.call('create',{body:input})).json();
 await h.call('upload',{id,slot:'video',part:0,bytes:Buffer.from('private-video')});await h.call('finish',{id,body:{}});
 assert.equal((await h.call('list',{auth:''})).status,401);
 const another=sessionFor('another@example.com',secret);assert.equal((await(await h.call('list',{auth:another})).json()).cards.length,0);
 assert.equal((await h.call('owner-view',{id,auth:another})).status,404);assert.equal((await h.call('owner-part',{id,slot:'video',part:0,auth:another})).status,404);
 const list=await(await h.call('list')).json();assert.equal(list.cards.length,1);assert.equal(list.cards[0].viewToken,input.viewToken);assert.match(list.cards[0].viewUrl,/view-card.html#/);assert.equal(list.cards[0].view_hash,undefined);
 assert.equal((await h.call('owner-view',{id})).status,200);assert.equal((await h.call('owner-part',{id,slot:'video',part:0})).status,200);
 h.cards.get(id).view_token=null;assert.equal((await h.call('remember-link',{id,body:{viewToken:'c'.repeat(64)}})).status,400);
 assert.equal((await h.call('remember-link',{id,body:{viewToken:input.viewToken}})).status,200);assert.ok(h.cards.get(id).view_token);
 assert.equal((await(await h.call('list')).json()).cards[0].viewToken,input.viewToken);
 const publicData=await(await h.call('view',{id,auth:input.viewToken})).json();assert.equal(JSON.stringify(publicData).includes(input.viewToken),false);
 h.cards.get(id).expires_at='2000-01-01';assert.equal((await h.call('owner-view',{id})).status,404);
});
