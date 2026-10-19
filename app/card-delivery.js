'use strict';
(() => {
 const get=id=>document.getElementById(id),api='/.netlify/functions/hugs-card-links',CHUNK=2*1024*1024;
 let revision=0,prepared=null,job=null,session=null,challenge=null,configured=false,busy=false;
 const say=text=>{get('deliveryStatus').textContent=text;};
 const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 const address=()=>get('senderEmail').value.trim().toLowerCase();
 const verified=()=>!!session&&session.email===address();
 function read(key,where=localStorage,fallback=[]){try{return JSON.parse(where.getItem(key))||fallback}catch{return fallback}}
 function remember(key,value,where=localStorage){try{where.setItem(key,JSON.stringify(value))}catch{}}
 const records=()=>read('hugs-private-card-links');
 function saveRecord(record){remember('hugs-private-card-links',[record,...records().filter(x=>x.id!==record.id)].slice(0,30));history();}
 function buttons(){const entry=get('cardAccountEntry');if(entry)entry.textContent=verified()?'Account':'Sign in';get('prepareDelivery').disabled=busy||!configured||!verified();get('requestSenderCode').disabled=busy||!configured;get('verifySenderCode').disabled=busy;}
 async function request(action,{body,bytes,id,slot,part,auth=true}={}){
  const q=new URLSearchParams({action});if(id)q.set('id',id);if(slot)q.set('slot',slot);if(part!==undefined)q.set('part',String(part));
  const headers={};if(auth&&session)headers.Authorization='Bearer '+session.session;
  if(bytes)headers['Content-Type']='application/octet-stream';else if(body)headers['Content-Type']='application/json';
  const r=await fetch(api+'?'+q,{method:action==='status'?'GET':'POST',headers,body:bytes|| (body?JSON.stringify(body):undefined),cache:'no-store',referrerPolicy:'no-referrer'});
  let data;try{data=await r.json()}catch{throw Error('The connection was interrupted. Keep this page open and try again.');}
  if(!r.ok){if(r.status===401&&auth){session=null;try{sessionStorage.removeItem('hugs-card-sender')}catch{}get('senderStatus').textContent='Verify your sender email again to continue.';buttons();}throw Error(data.error||'Unable to complete this step. Please try again.');}return data;
 }
 function invalidate(){revision++;prepared=null;job=null;get('deliveryReady').hidden=true;get('emailResult').textContent='';if(!busy)say(verified()?'Your edits will be included when you prepare a new link. Existing saved links keep their original card.':'Verify your sender email, then prepare your private card link. No card email has been sent.');}
 document.addEventListener('card:changed',invalidate);
 for(const id of ['deliveryName','deliveryEmail','deliveryNote'])get(id).addEventListener('input',invalidate);
 get('senderEmail').addEventListener('input',()=>{challenge=null;get('senderCodeStep').hidden=true;get('senderStatus').textContent=verified()?'Email verified.':'Verify this email before sending.';invalidate();buttons();});
 get('requestSenderCode').onclick=async()=>{
  if(!get('senderEmail').reportValidity()||!address())return;
  busy=true;buttons();get('senderStatus').textContent='Sending your verification code…';
  try{const r=await request('request-code',{body:{email:address()},auth:false});challenge=r.challenge;get('senderCodeStep').hidden=false;get('senderStatus').textContent=r.message;get('senderCode').focus();}catch(e){get('senderStatus').textContent=e.message;}finally{busy=false;buttons();}
 };
 get('verifySenderCode').onclick=async()=>{
  if(!challenge)return;busy=true;buttons();
  try{session=await request('verify-code',{body:{challenge,code:get('senderCode').value.trim()},auth:false});remember('hugs-card-sender',session,sessionStorage);get('senderCodeStep').hidden=true;get('senderCode').value='';get('senderStatus').textContent='Email verified. You can now prepare and send your HUG.';say('Add your recipient and prepare your private card link.');history();}catch(e){get('senderStatus').textContent=e.message;}finally{busy=false;buttons();}
 };
 async function filesFor(snapshot){
  const files={},media={};
  for(const [slot,value] of Object.entries(snapshot.media))if(value){
   if(!/^data:(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|audio\/(mpeg|wav|mp4|x-m4a|x-wav));base64,/i.test(value.data||''))throw Error('Reattach your '+slot+' file before sending.');
   const blob=await (await fetch(value.data)).blob(),hashes=[];
   for(let i=0;i<blob.size;i+=CHUNK)hashes.push(await hash(await blob.slice(i,i+CHUNK).arrayBuffer()));
   files[slot]=blob;media[slot]={size:blob.size,type:blob.type,hashes};
  }
  return {files,card:{version:1,language:snapshot.language,fields:snapshot.fields,media,musicEnabled:snapshot.musicEnabled,openingChime:snapshot.openingChime}};
 }
 get('prepareDelivery').onclick=async()=>{
  if(busy||!verified())return;if(processing){say('Wait for your uploads to finish.');return;}
  if(!get('deliveryEmail').reportValidity())return;
  const current=revision;busy=true;buttons();get('deliveryProgress').hidden=false;get('deliveryProgress').value=0;
  say('Preparing your private card and checking its media…');
  try{
   if(!job){const snapshot=state();delete snapshot.fields.brief;const files=await filesFor(snapshot);job={...files,requestKey:random(16),viewToken:random(32),recipientEmail:get('deliveryEmail').value.trim(),recipientName:get('deliveryName').value.trim()||snapshot.fields.to,note:get('deliveryNote').value.trim()};}
   const pending=job;const unchanged=()=>{if(current!==revision)throw Error('Your card changed while preparing. Prepare again to include your latest edits.');};unchanged();
   const r=await request('create',{body:{card:pending.card,requestKey:pending.requestKey,viewToken:pending.viewToken,recipientEmail:pending.recipientEmail,recipientName:pending.recipientName,note:pending.note}});pending.id=r.id;
   let uploaded=0;const total=Object.values(pending.files).reduce((n,b)=>n+b.size,0);
   if(!r.ready)for(const [slot,blob] of Object.entries(pending.files))for(let start=0;start<blob.size;start+=CHUNK){
    unchanged();const bytes=await blob.slice(start,start+CHUNK).arrayBuffer();await request('upload',{id:r.id,slot,part:start/CHUNK,bytes});uploaded+=bytes.byteLength;get('deliveryProgress').value=total?Math.round(uploaded/total*100):100;say('Saving your card securely… '+get('deliveryProgress').value+'%');
   }
   unchanged();const done=await request('finish',{id:r.id,body:{}});unchanged();
   const url=location.origin+'/app/view-card.html#'+r.id+'.'+pending.viewToken;
   prepared={id:r.id,viewToken:pending.viewToken,url,recipientEmail:pending.recipientEmail,recipientName:pending.recipientName,expiresAt:done.expiresAt,owner:session.email};
   saveRecord(prepared);get('deliveryProgress').value=100;get('deliveryReady').hidden=false;get('deliverySummary').textContent=`Ready for ${prepared.recipientName||prepared.recipientEmail} · ${prepared.recipientEmail} · Available until ${new Date(prepared.expiresAt).toLocaleDateString()}`;
   get('viewSavedCard').href=url;get('sendCardEmail').disabled=false;get('shareCardLink').hidden=!navigator.share;say('Your private card link is ready. Tap Send HUGS Card to email it. No card email has been sent yet.');
  }catch(e){say(e.message);}finally{busy=false;buttons();}
 };
 get('sendCardEmail').onclick=async()=>{
  if(!prepared||busy)return;const card=prepared;busy=true;buttons();get('sendCardEmail').disabled=true;get('emailResult').textContent='Sending your HUGS Card email…';
  try{await request('send',{id:card.id,body:{viewToken:card.viewToken}});get('emailResult').textContent='Email accepted for sending to '+card.recipientEmail+'. Inbox delivery is not yet confirmed. Ask the recipient to check spam if needed.';saveRecord({...card,emailed:true});}catch(e){get('emailResult').textContent=e.message;get('sendCardEmail').disabled=false;}finally{busy=false;buttons();}
 };
 async function copy(url){try{await navigator.clipboard.writeText(url);say('Private card link copied. Anyone with this link can open it.');}catch{const input=document.createElement('input');input.value=url;input.readOnly=true;get('deliveryStatus').replaceChildren(input);input.focus();input.select();}}
 get('copyCardLink').onclick=()=>{if(prepared)copy(prepared.url);};
 get('shareCardLink').onclick=async()=>{if(!prepared)return;try{await navigator.share({title:'A HUGS Card for you',text:'I made this HUG just for you.',url:prepared.url});say('Link handed to your chosen app. Finish sending there.');}catch(e){if(e.name!=='AbortError')say('Use Copy card link to share this HUG.');}};
 function history(){
  const list=get('savedCardList');list.replaceChildren();const saved=records().filter(r=>verified()&&r.owner===session.email&&/^[a-f0-9]{32}$/.test(r.id));get('savedCardHistory').hidden=!saved.length;
  for(const record of saved){
   const li=document.createElement('li'),label=document.createElement('span');label.textContent=(record.recipientName||record.recipientEmail)+' · '+new Date(record.expiresAt).toLocaleDateString()+(record.emailed?' · emailed':' · link ready');li.append(label);const expired=new Date(record.expiresAt)<=new Date();if(expired)label.textContent+=' · expired';
   const copyButton=document.createElement('button');copyButton.className='secondary';copyButton.textContent='Copy link';copyButton.disabled=expired;copyButton.onclick=()=>copy(record.url);li.append(copyButton);
   if(!record.emailed&&!expired){const send=document.createElement('button');send.className='secondary';send.textContent='Email card';send.onclick=async()=>{if(!verified()||session.email!==record.owner){say('Verify '+record.owner+' above to email this saved card.');return;}send.disabled=true;try{await request('send',{id:record.id,body:{viewToken:record.viewToken}});saveRecord({...record,emailed:true});say('Email accepted for sending to '+record.recipientEmail+'. Inbox delivery is not yet confirmed.');}catch(e){say(e.message);send.disabled=false;}};li.append(send);}
   const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove card';remove.onclick=async()=>{
    if(!verified()||session.email!==record.owner){say('Verify '+record.owner+' above to remove this saved card.');get('senderEmail').focus();return;}
    if(!confirm('Remove this online card and its media? Its link will stop working for everyone. Your local draft stays on this device.'))return;
    remove.disabled=true;
    try{await request('delete',{id:record.id,body:{}});remember('hugs-private-card-links',records().filter(x=>x.id!==record.id));if(prepared?.id===record.id)invalidate();history();say('Card removed. Its private link no longer works.');}catch(e){say(e.message+' The link may already be disabled; retry removal to finish deleting its media.');remove.disabled=false;}
   };li.append(remove);list.append(li);
  }
 }
 session=read('hugs-card-sender',sessionStorage,null);if(session){get('senderEmail').value=session.email;get('senderStatus').textContent='Sender email verified for this browser session.';}
 history();buttons();
 request('status',{auth:false}).then(r=>{configured=r.configured;buttons();if(!configured)say('Private card delivery is not configured on this preview yet. Your draft and offline download remain available.');}).catch(e=>say(e.message));
})();
