import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../app/card-delivery.js',import.meta.url),'utf8');
function setup({verified=true}={}){
 const nodes=new Map(),events={},calls=[],saved=new Map(),temporary=new Map();
 const storage=map=>({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 if(verified)temporary.set('hugs-card-sender',JSON.stringify({email:'sender@example.com',session:'test-sender-session'}));
 const element=()=>({value:'',hidden:false,disabled:false,textContent:'',reportValidity:()=>true,focus(){},select(){},append(){},replaceChildren(){},addEventListener(k,fn){this[k]=fn;}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 get('deliveryEmail').value='friend@example.com';get('deliveryName').value='My friend';
 const context=vm.createContext({document:{getElementById:get,addEventListener:(k,fn)=>events[k]=fn,createElement:element},localStorage:storage(saved),sessionStorage:storage(temporary),navigator:{clipboard:{writeText:async()=>{}}},location:{origin:'https://preview.example'},crypto:webcrypto,URLSearchParams,Date,Blob,Uint8Array,ArrayBuffer,confirm:()=>false,processing:0,state:()=>({version:1,language:'en',fields:{to:'Friend',from:'Sender',brief:'private brief'},media:{}}),fetch:async(url,opts={})=>{
  const action=new URL('https://preview.example'+url).searchParams.get('action');calls.push({action,body:opts.body?JSON.parse(opts.body):undefined});
  const data={status:{configured:true},create:{id:'a'.repeat(32),ready:false},finish:{ready:true,expiresAt:'2099-01-01T00:00:00Z'},send:{accepted:true},'request-code':{challenge:'challenge',message:'Code sent'},'verify-code':{email:'sender@example.com',session:'verified-session'}}[action];
  return {ok:true,json:async()=>data};
 }});
 vm.runInContext(source,context);return {get,calls,events,context};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('private link is prepared without emailing; an explicit send targets the saved card',async()=>{
 const h=setup();await settle();assert.equal(h.get('prepareDelivery').disabled,false);
 await h.get('prepareDelivery').onclick();assert.equal(h.get('deliveryReady').hidden,false);assert.equal(h.calls.filter(x=>x.action==='send').length,0);
 assert.match(h.get('viewSavedCard').href,/view-card.html#aaaa/);const create=h.calls.find(x=>x.action==='create');assert.equal(create.body.card.fields.brief,undefined);
 await h.get('sendCardEmail').onclick();assert.equal(h.calls.filter(x=>x.action==='send').length,1);assert.match(h.get('emailResult').textContent,/accepted for sending/);assert.match(h.get('emailResult').textContent,/not yet confirmed/);
});
test('editing a card invalidates the current send action without deleting its previous link',async()=>{
 const h=setup();await settle();await h.get('prepareDelivery').onclick();h.events['card:changed']();assert.equal(h.get('deliveryReady').hidden,true);
 await h.get('sendCardEmail').onclick();assert.equal(h.calls.filter(x=>x.action==='send').length,0);assert.equal(h.get('savedCardHistory').hidden,false);
});
test('unverified sender cannot upload; email verification does not send a card',async()=>{
 const h=setup({verified:false});await settle();assert.equal(h.get('prepareDelivery').disabled,true);await h.get('prepareDelivery').onclick();assert.equal(h.calls.filter(x=>x.action==='create').length,0);
 h.get('senderEmail').value='sender@example.com';await h.get('requestSenderCode').onclick();h.get('senderCode').value='123456';await h.get('verifySenderCode').onclick();assert.equal(h.get('prepareDelivery').disabled,false);assert.equal(h.calls.filter(x=>x.action==='send').length,0);
});
