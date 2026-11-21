'use strict';
(() => {
 const get=id=>document.getElementById(id),api='/.netlify/functions/hugs-card-links';
 const t=(en,es)=>document.documentElement.lang==='es'?es:en;
 const read=(key,storage=sessionStorage)=>{try{return JSON.parse(storage.getItem(key));}catch{return null;}};
 let session=read('hugs-card-sender'),challenge=null,cards=[],nextOffset=null,busy=false,loaded=false,synced=false,version=0;
 const say=text=>get('accountStatus').textContent=text;
 function clearSession(){session=null;version++;cards=[];loaded=false;synced=false;try{sessionStorage.removeItem('hugs-card-sender')}catch{}update();render();}
 function update(){
  const signed=!!session;get('accountLogin').hidden=signed;get('accountSignedIn').hidden=!signed;get('librarySignedOut').hidden=signed;get('cardLibrary').hidden=!signed;
  get('accountIdentity').textContent=signed?session.email:'';get('libraryIdentity').textContent=signed?session.email:'';
  const entry=get('memberEntry');entry.dataset.en=signed?'Account':'Sign in';entry.dataset.es=signed?'Cuenta':'Entrar';entry.textContent=t(entry.dataset.en,entry.dataset.es);
 }
 async function request(action,{body,id,offset}={}){
  const q=new URLSearchParams({action});if(id)q.set('id',id);if(offset!==undefined)q.set('offset',offset);
  const isGet=action==='list',headers={};if(session)headers.Authorization='Bearer '+session.session;if(body)headers['Content-Type']='application/json';
  const r=await fetch(api+'?'+q,{method:isGet?'GET':'POST',headers,body:body?JSON.stringify(body):undefined,cache:'no-store',referrerPolicy:'no-referrer'});
  let result;try{result=await r.json()}catch{throw Error(t('The connection was interrupted. Try again.','La conexión se interrumpió. Inténtalo de nuevo.'));}
  if(!r.ok){if(r.status===401&&['list','delete','send','remember-link'].includes(action)){clearSession();say(t('Your session expired. Sign in again to open your cards.','Tu sesión caducó. Entra de nuevo para abrir tus tarjetas.'));}throw Error(result.error||t('Unable to load your cards.','No se pudieron cargar tus tarjetas.'));}
  return result;
 }
 get('cardLoginForm').onsubmit=async event=>{
  event.preventDefault();if(!get('cardLoginForm').reportValidity())return;const button=get('accountRequestCode');button.disabled=true;say(t('Sending your sign-in code…','Enviando tu código…'));
  try{const result=await request('request-code',{body:{email:get('accountEmail').value.trim()}});challenge=result.challenge;get('cardCodeForm').hidden=false;say(t('Check your inbox and spam folder for a six-digit code. It expires in 10 minutes.','Busca el código de seis dígitos en tu correo o spam. Caduca en 10 minutos.'));get('accountCode').focus();}catch(e){say(e.message);}finally{button.disabled=false;}
 };
 get('accountEmail').addEventListener('input',()=>{challenge=null;get('cardCodeForm').hidden=true;get('accountCode').value='';});
 get('cardCodeForm').onsubmit=async event=>{
  event.preventDefault();if(!challenge||!get('cardCodeForm').reportValidity())return;const button=get('accountVerifyCode');button.disabled=true;
  try{session=await request('verify-code',{body:{challenge,code:get('accountCode').value.trim()}});version++;try{sessionStorage.setItem('hugs-card-sender',JSON.stringify(session))}catch{}get('accountCode').value='';get('cardCodeForm').hidden=true;loaded=false;synced=false;update();say(t('Signed in. Your cards are ready below.','Sesión iniciada. Tus tarjetas están listas.'));location.hash='saved';await load();}catch(e){say(e.message);}finally{button.disabled=false;}
 };
 get('cardSignOut').onclick=()=>{clearSession();location.hash='account';say(t('Signed out of this tab. Your online cards are still saved.','Se cerró la sesión de esta pestaña. Tus tarjetas siguen guardadas en línea.'));};
 async function restoreLinks(){
  if(synced||!session)return;synced=true;
  const previous=read('hugs-private-card-links',localStorage);if(!Array.isArray(previous))return;
  const items=previous.filter(r=>r.owner===session.email&&/^[a-f0-9]{32}$/.test(r.id)&&/^[a-f0-9]{64}$/.test(r.viewToken)&&new Date(r.expiresAt)>new Date()).slice(0,30);
  for(let i=0;i<items.length;i+=3)await Promise.all(items.slice(i,i+3).map(r=>request('remember-link',{id:r.id,body:{viewToken:r.viewToken}}).catch(()=>{})));
 }
 async function load(more=false){
  if(!session||busy)return;busy=true;const stamp=version;get('refreshLibrary').disabled=true;get('moreLibrary').disabled=true;get('libraryStatus').textContent=t('Loading your cards…','Cargando tus tarjetas…');
  try{await restoreLinks();if(!session||stamp!==version)return;const result=await request('list',{offset:more?nextOffset:0});if(stamp!==version)return;cards=more?[...cards,...result.cards]:result.cards;nextOffset=result.nextOffset;loaded=true;render();}
  catch(e){get('libraryStatus').textContent=e.message;}
  finally{busy=false;get('refreshLibrary').disabled=false;get('moreLibrary').disabled=false;}
 }
 get('refreshLibrary').onclick=()=>load();get('moreLibrary').onclick=()=>{if(nextOffset!==null)load(true);};
 const date=value=>new Date(value).toLocaleDateString(document.documentElement.lang==='es'?'es':'en-US');
 function render(){
  const grid=get('onlineCardGrid');grid.replaceChildren();get('moreLibrary').hidden=nextOffset===null||!session;
  if(!session)return;
  get('libraryStatus').textContent=cards.length?t(`${cards.length} prepared card${cards.length===1?'':'s'}.`,`${cards.length} tarjetas preparadas.`):t('No online cards yet. Create a card and prepare its private link to keep it here.','Todavía no hay tarjetas en línea. Crea una tarjeta y prepara su enlace privado para guardarla aquí.');
  for(const card of cards){
   const expired=new Date(card.expiresAt)<=new Date(),ready=card.state==='ready',article=document.createElement('article');article.className='card library-card';
   const state=document.createElement('span');state.className='pill';state.textContent=expired?t('Expired','Caducada'):ready?(card.emailState==='sent'?t('Email accepted','Correo aceptado'):t('Ready to send','Lista para enviar')):t('Upload incomplete','Carga incompleta');
   const title=document.createElement('h2');title.textContent=card.title;
   const recipient=document.createElement('p');recipient.textContent=t('For: ','Para: ')+(card.recipientName||card.recipientEmail);
   const email=document.createElement('p');email.textContent=card.recipientEmail;
   const dates=document.createElement('p');dates.textContent=t('Saved ','Guardada ')+date(card.createdAt)+' · '+t('Available until ','Disponible hasta ')+date(card.expiresAt);
   const actions=document.createElement('div');actions.className='card-actions';
   if(ready&&!expired){
    const open=document.createElement('a');open.className='button navy';open.href='/app/view-card.html#owner.'+card.id;open.textContent=t('Open card →','Abrir tarjeta →');actions.append(open);
    if(card.viewToken){
     const copy=document.createElement('button');copy.textContent=t('Copy link','Copiar enlace');copy.onclick=async()=>{try{await navigator.clipboard.writeText(card.viewUrl);get('libraryStatus').textContent=t('Private link copied. Anyone with the link can open the card.','Enlace privado copiado. Quien tenga el enlace podrá abrir la tarjeta.');}catch{window.prompt(t('Copy your private card link:','Copia tu enlace privado:'),card.viewUrl);}};actions.append(copy);
     if(card.emailState!=='sent'){
      const send=document.createElement('button');send.textContent=t('Email card','Enviar tarjeta');send.onclick=async()=>{if(!confirm(t('Email this card to ','¿Enviar esta tarjeta a ')+card.recipientEmail+'?'))return;send.disabled=true;try{await request('send',{id:card.id,body:{viewToken:card.viewToken}});card.emailState='sent';render();get('libraryStatus').textContent=t('Email accepted for sending. Inbox delivery is not confirmed.','Correo aceptado para envío. La entrega no está confirmada.');}catch(e){get('libraryStatus').textContent=e.message;send.disabled=false;}};actions.append(send);
     }
    }else{const hint=document.createElement('p');hint.textContent=t('Your original share link stays on the sending device. Sign in there once to restore it here.','El enlace original está en el dispositivo desde el que enviaste. Entra allí una vez para restaurarlo aquí.');article.append(hint);}
   }
   const remove=document.createElement('button');remove.className='remove-card';remove.textContent=t('Remove card','Eliminar tarjeta');remove.onclick=async()=>{
    if(!confirm(t('Remove this online card and its media? The recipient link will stop working.','¿Eliminar esta tarjeta y sus archivos? El enlace dejará de funcionar.')))return;remove.disabled=true;
    try{await request('delete',{id:card.id,body:{}});cards=cards.filter(c=>c.id!==card.id);render();get('libraryStatus').textContent=t('Card removed. Its link no longer works.','Tarjeta eliminada. El enlace ya no funciona.');}catch(e){get('libraryStatus').textContent=e.message;remove.disabled=false;}
   };actions.append(remove);article.append(state,title,recipient,email,dates,actions);grid.append(article);
  }
 }
 document.addEventListener('cards:route',()=>{update();if(session&&location.hash==='#saved'&&!loaded)load();else if(loaded)render();});
 update();if(session)load();
})();
