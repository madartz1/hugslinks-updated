'use strict';
(() => {
 const core=[
  {id:'swan',title:'Swan — The Eye',artist_name:'Swan the Artist',image_url:'/assets/swan-eye.jpg'},
  {id:'cityscape',title:'Golden Horizon',artist_name:'Swan the Artist',image_url:'/assets/golden-horizon.jpg'}
 ];
 const works=core.slice(),rooms=[];
 const safeImage=value=>{try{const u=new URL(value,location.origin);return !u.username&&!u.password&&(u.protocol==='https:'||u.origin===location.origin)&&['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
 const label=work=>work.title+' · '+work.artist_name;
 function option(work){const o=document.createElement('option');o.value=work.id;o.textContent=label(work);return o}
 function renderState(room,work){
  room.select.value=work.id;
  room.credit.textContent=label(work);
  room.frame.setAttribute('aria-label',work.title+' in '+room.name+'. Activate to switch painting.');
  room.element.querySelectorAll('[data-art]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.art===work.id)));
 }
 function choose(room,id){
  const work=works.find(w=>w.id===id);if(!work)return;
  const sequence=++room.sequence;
  if(id===room.current){renderState(room,work);room.status.textContent='';return}
  room.status.textContent='Loading artwork…';room.frame.setAttribute('aria-busy','true');
  const image=new Image();
  image.onload=()=>{
   if(sequence!==room.sequence)return;
   room.art.src=work.image_url;room.art.alt=work.title+' by '+work.artist_name;
   room.current=id;renderState(room,work);room.status.textContent='';room.frame.removeAttribute('aria-busy');
  };
  image.onerror=()=>{
   if(sequence!==room.sequence)return;
   room.select.value=room.current;room.status.textContent='This artwork could not load. Your previous painting is still displayed. Choose another artwork.';
   room.frame.removeAttribute('aria-busy');
  };
  image.src=work.image_url;
 }
 document.querySelectorAll('.interactive-room').forEach(element=>{
  const room={element,name:element.querySelector('h3').textContent,frame:element.querySelector('.room-frame'),art:element.querySelector('.room-art'),select:element.querySelector('.room-choice'),credit:element.querySelector('.room-credit'),status:element.querySelector('.room-status'),current:element.dataset.initial,sequence:0};
  room.select.replaceChildren(...works.map(option));renderState(room,works.find(w=>w.id===room.current));
  const next=()=>choose(room,works[(works.findIndex(w=>w.id===room.current)+1)%works.length].id);
  room.frame.addEventListener('click',next);
  element.querySelector('.room-next').addEventListener('click',next);
  room.select.addEventListener('change',()=>choose(room,room.select.value));
  element.querySelectorAll('[data-art]').forEach(b=>b.addEventListener('click',()=>choose(room,b.dataset.art)));
  rooms.push(room);
 });
 const gallery=document.getElementById('dynamicGallery');
 function addGallery(work){
  const article=document.createElement('article'),img=document.createElement('img'),box=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),button=document.createElement('button');
  img.src=work.image_url;img.alt=work.title+' by '+work.artist_name;img.loading='lazy';
  h.textContent=work.title;p.textContent=work.artist_name+(work.medium?' · '+work.medium:'');
  button.type='button';button.className='gallery-room-action';button.textContent='Preview in rooms';
  button.addEventListener('click',()=>{rooms.forEach(room=>choose(room,work.id));document.querySelector('.room-grid').scrollIntoView({behavior:'smooth',block:'start'})});
  box.append(h,p,button);article.append(img,box);gallery.append(article);
 }
 // Replace the static gallery only after the interactive room controls are ready.
 gallery.replaceChildren();core.forEach(addGallery);
 (async()=>{
  try{
   const response=await fetch('/.netlify/functions/art-gallery',{cache:'no-store'});if(!response.ok)throw Error('Gallery unavailable');
   const data=await response.json();if(data.ok!==true||!Array.isArray(data.works))throw Error('Gallery unavailable');
   const seen=new Set(core.map(w=>safeImage(w.image_url)));
   data.works.filter(w=>w&&(w.featured===true||w.collection==='Luxe Collection')).forEach(w=>{
    const image=safeImage(w.image_url);if(!image||seen.has(image))return;seen.add(image);
    const work={id:'published-'+works.length,title:String(w.title||'Untitled'),artist_name:String(w.artist_name||'Featured artist'),image_url:image,medium:String(w.medium||'')};
    works.push(work);rooms.forEach(room=>room.select.append(option(work)));addGallery(work);
   });
  }catch{
   const note=document.createElement('p');note.textContent='Featured artwork is temporarily unavailable. Swan and Cityscape previews are still available.';gallery.after(note);
  }
 })();
})();
