'use strict';
(() => {
 const get=id=>document.getElementById(id),urls=[];
 const match=location.hash.match(/^#([a-f0-9]{32})\.([a-f0-9]{64})$/);
 const api='/.netlify/functions/hugs-card-links';
 let busy=false;
 async function request(action,extra=''){
  const r=await fetch(api+'?action='+action+'&id='+match[1]+extra,{headers:{Authorization:'Bearer '+match[2]},cache:'no-store',referrerPolicy:'no-referrer'});
  if(!r.ok){let error;try{error=(await r.json()).error}catch{}throw Error(error||'Unable to load your HUG. Please try again.');}return r;
 }
 async function open(){
  if(busy)return;busy=true;get('retryCard').hidden=true;
  try{
   if(!match)throw Error('This card link is incomplete. Open the full link from your email, including the part after #.');
   get('viewStatus').textContent='Loading your private card…';get('viewProgress').value=0;
   const {card,expiresAt}=await (await request('view')).json();
   let loaded=0;const total=Object.values(card.media).reduce((n,m)=>n+m.size,0);
   const media={};
   for(const [slot,m] of Object.entries(card.media)){
    const chunks=[];
    for(let part=0;part<m.parts;part++){
     const bytes=await (await request('part','&slot='+slot+'&part='+part)).arrayBuffer();
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
     if(hash!==m.hashes[part])throw Error('A media upload is incomplete. Ask the sender for a new card link.');
     chunks.push(bytes);loaded+=bytes.byteLength;get('viewProgress').value=total?Math.round(loaded/total*100):100;
     get('viewStatus').textContent=`Getting your photos, video, and music ready… ${get('viewProgress').value}%`;
    }
    const url=URL.createObjectURL(new Blob(chunks,{type:m.type}));urls.push(url);media[slot]={data:url};
   }
   const s={...card,media};
   let html=await cardHTML(s);
   const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'";
   html=html.replace('<head>','<head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="'+policy+'">');
   const frame=get('recipientFrame');frame.srcdoc=html;frame.hidden=false;get('cardLoading').hidden=true;
  }catch(e){urls.splice(0).forEach(URL.revokeObjectURL);get('viewStatus').textContent=e.message;get('retryCard').hidden=!match;}
  finally{busy=false;}
 }
 get('retryCard').onclick=open;
 window.addEventListener('pagehide',()=>urls.splice(0).forEach(URL.revokeObjectURL));open();
})();
