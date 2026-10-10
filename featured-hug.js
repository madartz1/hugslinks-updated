(() => {
  'use strict';
  const slots = [...document.querySelectorAll('[data-featured-hug]')];
  if (!slots.length) return;
  const words = {
    en: {label:'Featured HUGS Card', open:'Discover this HUG', share:'Share the featured HUG', note:'Preview the card before you choose to send it.', copied:'Featured HUG link copied.', fallback:'Featured card unavailable right now.', browse:'Browse HUGS Cards'},
    es: {label:'Tarjeta HUGS destacada', open:'Descubre este HUG', share:'Comparte el HUG destacado', note:'Mira la vista previa antes de elegir enviarlo.', copied:'Enlace del HUG destacado copiado.', fallback:'La tarjeta destacada no está disponible en este momento.', browse:'Ver tarjetas HUGS'}
  };
  let card;
  function language() { return document.documentElement.dataset.hugsLanguage || document.documentElement.lang || 'en'; }
  function safeUrl(value) {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Only same-site card and artwork paths are accepted.');
    return url.href;
  }
  function render() {
    if (!card) return;
    const es = language() === 'es', w = words[es ? 'es' : 'en'];
    document.querySelectorAll('[data-fh-en]').forEach(el => {el.textContent = el.dataset[es ? 'fhEs' : 'fhEn'];});
    slots.forEach(slot => {
      slot.replaceChildren();
      const section = document.createElement('section');
      section.className = 'fh-feature';
      const artLink = document.createElement('a');
      artLink.className = 'fh-image-link'; artLink.href = safeUrl(card.cardUrl); artLink.setAttribute('aria-label',w.open);
      const image = document.createElement('img');
      image.className = 'fh-image'; image.src = safeUrl(card.image); image.alt = card.imageAlt || card.title;
      artLink.append(image);
      const copy = document.createElement('div'); copy.className = 'fh-copy';
      const label = document.createElement('span'); label.className = 'fh-label'; label.textContent = w.label;
      const title = document.createElement('h2'); title.textContent = es ? card.titleEs || card.title : card.title;
      const description = document.createElement('p'); description.textContent = es ? card.descriptionEs || card.description : card.description;
      const actions = document.createElement('div'); actions.className = 'fh-actions';
      const open = document.createElement('a'); open.className = 'fh-button'; open.href = safeUrl(card.cardUrl); open.textContent = w.open;
      const share = document.createElement('button'); share.type = 'button'; share.className = 'fh-button fh-button-secondary'; share.textContent = w.share;
      const status = document.createElement('p'); status.className = 'fh-small'; status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      share.addEventListener('click',async()=>{
        const url = new URL('/featured-hug.html',location.origin).href;
        try {
          if (navigator.share) await navigator.share({title:'HUGSLinks — '+card.title, url});
          else if (navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText(url);status.textContent=w.copied;}
          else {status.textContent=url;}
        } catch(error) {if(error.name!=='AbortError') status.textContent=url;}
      });
      actions.append(open,share);
      const note = document.createElement('p');note.className='fh-small';note.textContent=w.note;
      copy.append(label,title,description,actions,note,status);section.append(artLink,copy);slot.append(section);
    });
    const toggle=document.getElementById('fh-language');
    if(toggle){toggle.textContent=es?'English':'Español';toggle.setAttribute('aria-label',es?'Switch to English':'Cambiar a español');}
  }
  const toggle=document.getElementById('fh-language');
  if(toggle){
    try {document.documentElement.lang=localStorage.getItem('hugsLanguage')==='es'?'es':'en';}catch{}
    toggle.addEventListener('click',()=>{const lang=language()==='es'?'en':'es';document.documentElement.lang=lang;document.documentElement.dataset.hugsLanguage=lang;try{localStorage.setItem('hugsLanguage',lang);}catch{}render();});
  }
  document.addEventListener('hugs-language-change',render);
  fetch('/featured-hug.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Feature unavailable');return r.json();}).then(data=>{
    if(!data.title||!data.cardUrl||!data.image)throw new Error('Incomplete feature');
    safeUrl(data.cardUrl);safeUrl(data.image);card=data;render();
  }).catch(()=>{
    const w=words[language()==='es'?'es':'en'];
    slots.forEach(slot=>{const box=document.createElement('div');box.className='fh-error';const p=document.createElement('p');p.textContent=w.fallback;const a=document.createElement('a');a.href='/hugs-cards.html';a.textContent=w.browse;box.append(p,a);slot.replaceChildren(box);});
  });
})();
