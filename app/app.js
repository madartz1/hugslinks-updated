'use strict';
const catalog=[
 {id:'thinking-of-you',type:'ready',occasion:'thinking-of-you',title:['Lies Cut. Truth Heals.','Las mentiras duelen. La verdad sana.'],tag:['READY TO SEND · $2.99','LISTA PARA ENVIAR · $2.99'],description:['Browse 18 three-page cards with humor and support for hard family moments.','Explora 18 tarjetas de tres páginas con humor y apoyo para momentos familiares difíciles.'],image:'/assets/thinking-of-you/cover.webp',url:'/app/thinking-of-you.html'},
 {id:'anniversary-motion',type:'ready',title:['Anniversary Motion Card','Tarjeta animada de aniversario'],tag:['READY TO SEND · $3.99','LISTA PARA ENVIAR · $3.99'],description:['Send the Moma and Poppa Bear anniversary video with your own message.','Envía el video de aniversario de Moma y Poppa Bear con tu propio mensaje.'],image:'https://hugslinks-card-app.netlify.app/assets/anniversary/motion-poster.webp',url:'/anniversary-motion.html',sendUrl:'https://hugslinks-card-app.netlify.app/'},
 {id:'gen-z-holiday-hugs',type:'ready',holiday:true,title:['Gen Z Holiday Hugs','HUGs festivos Gen Z'],tag:['CARD PREVIEW','VISTA PREVIA'],description:['Choose from 18 illustrated cards for holiday cheer, encouragement, and care.','Elige entre 18 tarjetas ilustradas para celebrar, animar y demostrar cariño.'],image:'/assets/gen-z-holiday-hugs/card-01.webp',url:'/app/gen-z-holiday-hugs.html'},
 {id:'christmas-2026',type:'ready',holiday:true,title:['Christmas HUGs','HUGs de Navidad'],tag:['READY TO SEND · $2.99','LISTA PARA ENVIAR · $2.99'],description:['Choose a Christmas cover, personalize your message, and send your three-page HUG by email.','Elige una portada navideña, personaliza tu mensaje y envía tu HUG de tres páginas por correo.'],image:'https://hugslinks-card-app.netlify.app/assets/christmas-2026/card-16.webp',url:'https://hugslinks-card-app.netlify.app/christmas.html#filters'},
 {id:'thanksgiving-2026',type:'ready',holiday:true,title:['Thanksgiving HUG','HUG de Acción de Gracias'],tag:['READY TO SEND · $2.99','LISTA PARA ENVIAR · $2.99'],description:['Choose a Thanksgiving design, add your message, and send a HUG by email.','Elige un diseño de Acción de Gracias, agrega tu mensaje y envía un HUG por correo.'],image:'https://hugslinks-card-app.netlify.app/assets/thanksgiving-2026/card-01.webp',url:'https://hugslinks-card-app.netlify.app/thanksgiving.html#filters'},
 {id:'nyc',type:'ready',title:['NYC Ride','NYC Ride'],tag:['READY TO SEND · $6.99','LISTA PARA ENVIAR · $6.99'],description:['A cinematic New York moment with HUGS Bear.','Un momento cinematográfico de Nueva York con HUGS Bear.'],image:'/assets/nyc-ride-hugs-card-cover.jpg',url:'/nyc-ride-hugs-card.html'},
 {id:'personal',type:'personal',title:['Make it personal','Hazla personal'],tag:['PERSONALIZED · $16.99','PERSONALIZADA · $16.99'],description:['Names, a message, and a HUG made for someone special.','Nombres, un mensaje y un HUG para alguien especial.'],image:'/assets/hugs-open-envelope.png',url:'/personalized-hugs-card.html'},
 {id:'memorial',type:'free',title:['Always remembered','Siempre en la memoria'],tag:['FREE MEMORIAL GIFT','REGALO CONMEMORATIVO GRATIS'],description:['A tribute to lives, courage, and the communities that carry us.','Un homenaje a la vida, el valor y las comunidades que nos sostienen.'],image:'/assets/memorial-hugs-card-cover.PNG',url:'/free-911-hugs-card.html'},
 {id:'custom',type:'personal',title:['Your idea, a HUG','Tu idea, un HUG'],tag:['CUSTOM DESIGN · FROM $39','DISEÑO A MEDIDA · DESDE $39'],description:['Bring your story to life with a custom card request.','Da vida a tu historia con una tarjeta a medida.'],image:'/assets/custom-hugs-card-cover.PNG',url:'/contact.html?type=custom-hug#request'}
];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
let lang=read('hugs-cards-language','en');if(!['en','es'].includes(lang))lang='en';
let favorites=read('hugs-cards-favorites',[]);if(!Array.isArray(favorites))favorites=[];favorites=favorites.filter(id=>catalog.some(c=>c.id===id));
let filter='all',installPrompt=null,toastTimer;
const tr=(en,es)=>lang==='es'?es:en;
function toast(en,es){const el=document.getElementById('toast');el.textContent=tr(en,es);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500)}
function cardNode(card){const n=lang==='es'?1:0;const article=document.createElement('article');article.className='card';
 const cover=document.createElement('div');cover.className='card-cover';const img=document.createElement('img');img.src=card.image;img.alt=card.title[n];img.loading='lazy';
 if(card.holiday||card.collection){
   const collection=document.createElement('a');
   collection.href=card.url;
   collection.setAttribute('aria-label',tr('Browse '+card.title[n],'Ver '+card.title[n]));
   collection.append(img);
   cover.append(collection);
 }else{
   cover.append(img);
 }
 const save=document.createElement('button');save.type='button';save.className='save';const active=favorites.includes(card.id);save.textContent=active?'♥':'♡';save.setAttribute('aria-pressed',String(active));save.setAttribute('aria-label',tr((active?'Remove ':'Save ')+card.title[n],(active?'Quitar ':'Guardar ')+card.title[n]));save.addEventListener('click',()=>{const container=article.closest('.card-grid').id;favorites=active?favorites.filter(id=>id!==card.id):[...favorites,card.id];const persisted=write('hugs-cards-favorites',favorites);renderCards();toast(persisted?(active?'Removed from favorites.':'Saved on this device.'):'Saved for this visit. Browser storage is unavailable.',persisted?(active?'Eliminada de favoritas.':'Guardada en este dispositivo.'):'Guardada durante esta visita. El almacenamiento no está disponible.');const next=document.querySelector(`#${container} [data-card="${card.id}"] .save`)||document.querySelector(`#${container} .save`)||document.querySelector('a[href="#cards"]');next?.focus()});article.dataset.card=card.id;if(!card.collection||card.id!=='thinking-of-you')cover.append(save);article.append(cover);
 const body=document.createElement('div');body.className='card-body';const tag=document.createElement('span');tag.className='pill';tag.textContent=card.tag[n];const h=document.createElement('h3');h.textContent=card.title[n];const desc=document.createElement('p');desc.textContent=card.description[n];const actions=document.createElement('div');actions.className='card-actions';const link=document.createElement('a');link.className='button navy';link.href=card.url;link.textContent=tr(card.type==='free'?'Open free card →':card.id==='custom'?'Request design →':'View card →',card.type==='free'?'Abrir tarjeta gratis →':card.id==='custom'?'Solicitar diseño →':'Ver tarjeta →');const share=document.createElement('button');share.type='button';share.textContent=tr('Share link','Compartir enlace');share.addEventListener('click',()=>shareCard(card));if(card.holiday||card.collection){link.textContent=card.url.endsWith('#occasion-anniversary')?tr('Browse anniversary cards →','Ver tarjetas de aniversario →'):tr('Choose a card →','Elige una tarjeta →');actions.append(link,share)}else if(card.type==='ready'&&card.sendUrl){link.textContent=tr('Preview Card','Vista previa');const send=document.createElement('a');send.className='button navy';send.href=card.sendUrl;send.textContent=tr('Personalize & Send →','Personalizar y enviar →');actions.append(link,send,share)}else{actions.append(link,share)}body.append(tag,h,desc,actions);article.append(body);return article}
function renderCards(){
 const grid=document.getElementById('card-grid'),saved=document.getElementById('saved-grid');
 const anniversary=catalog.find(card=>card.id==='anniversary-motion');
 const cards=filter==='occasions'?[{
   ...anniversary,
   collection:true,
   title:['Anniversary','Aniversario'],
   tag:['OCCASION','OCASIÓN'],
   description:['Browse cards for an anniversary.','Explora las tarjetas de aniversario.'],
   url:'/app/#occasion-anniversary'
 },{
   ...catalog.find(card=>card.id==='thinking-of-you'),
   collection:true,
   title:['Thinking of You','Pensando en ti'],
   tag:['OCCASION','OCASIÓN'],
   description:['Find a card for a gentle check-in.','Encuentra una tarjeta para acompañar a alguien.'],
   url:'/app/thinking-of-you.html'
 }]:catalog.filter(card=>filter==='all'||(filter==='holidays'?card.holiday:filter==='anniversary'?card.id==='anniversary-motion':filter==='thinking-of-you'?card.occasion===filter:filter==='birthday'||filter==='wedding'?false:card.type===filter));
 grid.replaceChildren(...cards.map(cardNode));
 document.getElementById('occasion-heading').hidden=filter!=='anniversary';
 document.getElementById('category-empty').hidden=grid.childElementCount>0;
 saved.replaceChildren(...catalog.filter(card=>favorites.includes(card.id)).map(cardNode));
 document.getElementById('saved-empty').hidden=favorites.length>0;
 document.querySelectorAll('[data-filter]').forEach(button=>{
   const selected=button.dataset.filter===(['anniversary','thinking-of-you'].includes(filter)?'occasions':filter);
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
 });
}
async function shareCard(card){const url=new URL(card.url,location.origin).href;const payload={title:card.title[lang==='es'?1:0],text:tr('A HUG for someone who matters.','Un HUG para alguien especial.'),url};try{if(navigator.share){await navigator.share(payload);return}await navigator.clipboard.writeText(url);toast('Card link copied.','Enlace de la tarjeta copiado.')}catch(e){if(e.name==='AbortError')return;window.prompt(tr('Copy this card link:','Copia este enlace:'),url)}}
function translate(){document.documentElement.lang=lang;document.querySelectorAll('[data-en]').forEach(el=>el.textContent=el.dataset[lang]);document.querySelectorAll('[data-alt-en]').forEach(el=>el.alt=el.dataset[lang==='es'?'altEs':'altEn']);const b=document.getElementById('language');b.textContent=lang==='en'?'Español':'English';b.setAttribute('aria-label',tr('Cambiar a español','Switch to English'));renderCards()}
function route(){const id=location.hash.slice(1);if(['collection','holidays','occasions','occasion-anniversary','occasion-thinking-of-you'].includes(id)){if(id!=='collection'){filter=['occasions','holidays'].includes(id)?id:id.slice('occasion-'.length);renderCards()}else if(['holidays','occasions','anniversary','thinking-of-you'].includes(filter)){filter='all';renderCards()}document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='cards');document.getElementById('collection').scrollIntoView();return}const current=['cards','saved','giveaway','account','membership'].includes(id)?id:'cards';document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==current);document.querySelectorAll('.bottom-nav a').forEach(a=>{if(a.hash==='#'+current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.title=tr({cards:'Cards',saved:'My Cards',giveaway:'Free Giveaway',account:'Account',membership:'Membership'}[current],{cards:'Tarjetas',saved:'Mis tarjetas',giveaway:'Sorteo gratis',account:'Cuenta',membership:'Membresía'}[current])+' · HUGSLinks';window.scrollTo(0,0);document.dispatchEvent(new Event('cards:route'));}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.filter==='occasions'){if(location.hash!=='#occasions')location.hash='occasions';return}if(['#holidays','#occasions','#occasion-anniversary','#occasion-thinking-of-you'].includes(location.hash))history.replaceState(null,'','#collection');filter=b.dataset.filter;renderCards()}));
document.getElementById('language').addEventListener('click',()=>{lang=lang==='en'?'es':'en';write('hugs-cards-language',lang);translate();route()});
document.getElementById('clear-saved').addEventListener('click',()=>{if(!confirm(tr('Clear all favorites saved on this device?','¿Borrar todas las favoritas de este dispositivo?')))return;favorites=[];write('hugs-cards-favorites',favorites);renderCards();toast('Saved favorites cleared.','Favoritas borradas.')});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});const dialog=document.getElementById('install-dialog');document.querySelectorAll('.install-trigger').forEach(b=>b.addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else dialog.showModal()}));dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});window.addEventListener('appinstalled',()=>document.querySelectorAll('.install-trigger').forEach(b=>b.hidden=true));
function connection(){document.getElementById('offline').hidden=navigator.onLine}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
window.addEventListener('hashchange',route);translate();route();if(matchMedia('(display-mode: standalone)').matches)document.querySelectorAll('.install-trigger').forEach(b=>b.hidden=true);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).catch(()=>{});
