(() => {
  'use strict';
  const card = document.getElementById('card-details');
  const help = document.getElementById('help-details');
  const buttons = [...document.querySelectorAll('[data-mode]')];
  if (!card || !help) return;
  const topic=document.getElementById('contactTopic');
  const request=document.getElementById('requestType');
  const submit=document.getElementById('request-submit');
  const summary=document.getElementById('request-summary');
  const studioVisit=new URLSearchParams(location.search).get('from')==='card-studio';
  let lang=(localStorage.getItem(studioVisit?'hugs-cards-language':'hugsLanguage')||localStorage.getItem(studioVisit?'hugsLanguage':'hugs-cards-language'))==='es'?'es':'en';
  const translations={
    'HUGS Cards':'Tarjetas HUGS','Art':'Arte','Food':'Alimentos','Housing':'Vivienda','Business':'Negocios','About':'Nosotros','Contact':'Contacto','NYC Updates':'Actualizaciones de NYC','HUGSLinks · Produced by Resile Corp':'HUGSLinks · Producido por Resile Corp','Home':'Inicio','Shop':'Tienda','Help App':'App de ayuda','Resources':'Recursos','Custom card design':'Diseño de tarjeta personalizada','Menu':'Menú',
    'Create Your HUGS Card':'Crea tu HUGS Card','Want to make it yourself? Upload your photos and video, add your message, and open a live preview. For a design made by an artist, continue with the request below.':'¿Quieres crearla tú mismo? Sube tus fotos y video, añade tu mensaje y abre una vista previa. Para un diseño hecho por un artista, continúa con la solicitud de abajo.','Create Your HUGS Card →':'Crea tu HUGS Card →',
    'Your idea. A meaningful HUG.':'Tu idea. Un HUG con significado.','A HUG designed':'Un HUG diseñado','around your story.':'alrededor de tu historia.','Create a custom card for someone you love, a moment worth celebrating, or a story that deserves to be shared.':'Crea una tarjeta personalizada para alguien que amas, un momento que merece celebrarse o una historia que merece compartirse.','Start your custom card':'Comienza tu tarjeta personalizada','Explore ready-made cards →':'Explora tarjetas listas →','Tell us your idea. We’ll confirm the scope, price and timing before design work begins.':'Cuéntanos tu idea. Confirmaremos el alcance, el precio y el plazo antes de comenzar el diseño.','Explore a HUGS Card →':'Explora una HUGS Card →',
    'Choose a format':'Elige un formato','Illustrated, animated or storybook.':'Ilustrada, animada o tipo cuento.','Share your idea':'Comparte tu idea','Occasion, message and creative details.':'Ocasión, mensaje y detalles creativos.','Confirm your design':'Confirma tu diseño','Agree on the scope, price and timing.':'Acuerda el alcance, el precio y el plazo.',
    'Start here':'Comienza aquí','What would you like to create?':'¿Qué te gustaría crear?','Custom card design is selected below. You can also request community help, or do both.':'El diseño de tarjeta personalizada está seleccionado. También puedes solicitar ayuda comunitaria o ambas cosas.','Custom card':'Tarjeta personalizada','Design a HUGS Card':'Diseña una HUGS Card','Community help':'Ayuda comunitaria','Request support or guidance':'Solicita apoyo u orientación','Both':'Ambas','A card request + community help':'Una tarjeta + ayuda comunitaria',
    'Your name':'Tu nombre','Email':'Correo electrónico','(required)':'(obligatorio)','(optional)':'(opcional)','Your custom card':'Tu tarjeta personalizada','Choose the experience you want to create.':'Elige la experiencia que deseas crear.','Illustrated card':'Tarjeta ilustrada','A single original visual and message.':'Una imagen original y un mensaje.','Animated card':'Tarjeta animada','A visual card brought to life with movement.':'Una tarjeta visual que cobra vida con movimiento.','Comic / storybook':'Cómic / cuento','A story told across illustrated pages.':'Una historia narrada en páginas ilustradas.','Help me choose':'Ayúdame a elegir','Tell us your idea and we’ll discuss the format.':'Cuéntanos tu idea y hablaremos del formato.',
    'Occasion or theme':'Ocasión o tema','Choose a theme':'Elige un tema','Love / anniversary':'Amor / aniversario','Birthday / celebration':'Cumpleaños / celebración','Family / friendship':'Familia / amistad','Healing / encouragement':'Sanación / ánimo','Memorial / remembrance':'Memorial / recuerdo','Culture / dance / music':'Cultura / baile / música','Holiday / comic lesson':'Festividad / lección ilustrada','Business / community message':'Mensaje empresarial / comunitario','Another theme':'Otro tema','Who is the card for?':'¿Para quién es la tarjeta?','Your design idea':'Tu idea de diseño','Preferred date':'Fecha preferida','Timing is confirmed after we review your idea.':'El plazo se confirma después de revisar tu idea.','Budget':'Presupuesto',
    'Your community help request':'Tu solicitud de ayuda comunitaria','Share the type of support you need. This is separate from your card design details.':'Comparte el tipo de apoyo que necesitas. Esto está separado de los detalles del diseño de tu tarjeta.','Type of help':'Tipo de ayuda','Choose a support category':'Elige una categoría de apoyo','Food Support':'Apoyo alimentario','Housing Help':'Ayuda de vivienda','Shop / Purchase':'Tienda / compra','Food Partnership':'Colaboración alimentaria','Business Services':'Servicios empresariales','Art & Community':'Arte y comunidad','Other community support':'Otro apoyo comunitario','What help are you looking for?':'¿Qué ayuda estás buscando?','Open the HUGS Help App →':'Abre la app de ayuda HUGS →','Explore community resources →':'Explora recursos comunitarios →',
    'This sends an inquiry. Payment and design work are arranged after review.':'Esto envía una consulta. El pago y el trabajo de diseño se coordinan después de la revisión.','Give a HUG. Get a HUG.':'Da un HUG. Recibe un HUG.','Explore HUGS Cards':'Explora HUGS Cards','Help Center':'Centro de ayuda'
  };
  const placeholders={'A name, group or community':'Un nombre, grupo o comunidad','Tell us the story, message, characters, colors and feeling you want your card to express.':'Cuéntanos la historia, el mensaje, los personajes, los colores y la emoción que quieres expresar.','Your range, or help me estimate':'Tu presupuesto o ayúdame a calcularlo','Describe the support or guidance you need and your neighborhood or city.':'Describe el apoyo u orientación que necesitas y tu vecindario o ciudad.'};
  const ariaTranslations={'Open navigation menu':'Abrir menú de navegación','Explore the featured NYC Ride HUGS Card':'Explora la tarjeta destacada NYC Ride de HUGS','Custom card process':'Proceso de tarjeta personalizada','Choose your request':'Elige tu solicitud','Cambiar a español':'Cambiar a español'};
  const originals=new WeakMap();
  let importedFromStudio=false,studioData=null,lastImportedMessage='';
  const labels={
    en:{card:['Custom HUG / Commission','Custom card design','Send custom card request','You’re sending a custom card design request.'],help:['Community Help','Community help','Send community help request','You’re sending a community help request.'],both:['Custom HUG + Community Help','Custom card design and community help','Send both requests','You’re sending a card design request and a separate community help request.']},
    es:{card:['HUG personalizado / Encargo','Diseño de tarjeta personalizada','Enviar solicitud de tarjeta','Estás enviando una solicitud de diseño de tarjeta personalizada.'],help:['Ayuda comunitaria','Ayuda comunitaria','Enviar solicitud de ayuda','Estás enviando una solicitud de ayuda comunitaria.'],both:['HUG personalizado + Ayuda comunitaria','Diseño de tarjeta y ayuda comunitaria','Enviar ambas solicitudes','Estás enviando una solicitud de diseño y otra de ayuda comunitaria.']}
  };
  const importedNotice=()=>lang==='es'?'Los detalles del estudio fueron añadidos. Revísalos, añade tus datos de contacto y adjunta los archivos por separado si se solicitan.':'Your Card Studio details were added. Review them, add your contact information, and attach media separately if requested.';
  function importedMessage(saved){
    const es=lang==='es';
    const lines=[saved.title&&(es?'Título de portada: ':'Cover title: ')+saved.title,saved.message&&(es?'Mensaje personal: ':'Personal message: ')+saved.message,saved.brief&&(es?'Dirección creativa: ':'Creative direction: ')+saved.brief,saved.sender&&(es?'Preparado por: ':'Prepared by: ')+saved.sender];
    const media=Object.entries(saved.media||{}).filter(([,name])=>name).map(([kind,name])=>kind+': '+name);
    if(media.length)lines.push((es?'Archivos elegidos en el estudio (adjuntar por separado): ':'Media selected in Card Studio (attach separately): ')+media.join(', '));
    return lines.filter(Boolean).join('\n\n').slice(0,5000);
  }
  function translatePage(){
    const globalSelect=document.getElementById('hugs-language-select');
    if(globalSelect){globalSelect.value=lang;globalSelect.dispatchEvent(new Event('change',{bubbles:true}));}
    document.documentElement.lang=lang;
    document.querySelectorAll('.topbar *, .cc-page *, .cc-footer *').forEach(el=>{
      for(const node of el.childNodes){
        if(node.nodeType!==Node.TEXT_NODE||!node.nodeValue.trim())continue;
        if(!originals.has(node))originals.set(node,node.nodeValue);
        const original=originals.get(node),key=original.trim(),value=lang==='es'?(translations[key]||key):key;
        node.nodeValue=original.replace(key,value);
      }
      for(const [attr,map] of [['placeholder',placeholders],['aria-label',ariaTranslations]]){
        if(!el.hasAttribute?.(attr))continue;
        const data='original'+attr.replace('-','');
        if(!el.dataset[data])el.dataset[data]=el.getAttribute(attr);
        const original=el.dataset[data];
        el.setAttribute(attr,lang==='es'?(map[original]||translations[original]||original):original);
      }
    });
    const language=document.getElementById('contact-language');
    language.textContent=lang==='es'?'English':'Español';
    language.setAttribute('aria-label',lang==='es'?'Switch to English':'Cambiar a español');
    document.title=lang==='es'?'Diseño de HUGS Card personalizada | HUGSLinks':'Custom HUGS Card Design | HUGSLinks';
    if(studioData){const message=document.getElementById('contactMessage');if(!message.value||message.value===lastImportedMessage){lastImportedMessage=importedMessage(studioData);message.value=lastImportedMessage;}}
  }
  function setMode(mode,animate=false){
    if(!labels.en[mode])mode='card';
    const cardOn=mode!=='help',helpOn=mode!=='card';
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    for(const [panel,on] of [[card,cardOn],[help,helpOn]]){
      const wasHidden=panel.hidden;panel.hidden=!on;
      panel.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=!on;});
      if(on&&wasHidden&&animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&panel.animate){panel.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});}
    }
    document.getElementById('contactMessage').required=cardOn;
    document.querySelectorAll('[name=card_format]').forEach(el=>el.required=cardOn);
    document.getElementById('occasion').required=cardOn;
    document.getElementById('help-type').required=helpOn;
    document.getElementById('help-message').required=helpOn;
    [topic.value,request.value]=labels.en[mode];
    [,,submit.textContent,summary.textContent]=labels[lang][mode];
    if(helpOn&&document.getElementById('help-type').value)topic.value=mode==='help'?document.getElementById('help-type').value:'Custom HUG + '+document.getElementById('help-type').value;
  }
  buttons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode,true)));
  document.getElementById('help-type').addEventListener('change',()=>setMode(buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.mode||'card'));
  const params=new URLSearchParams(location.search),type=params.get('type');
  const legacy={'food-partnership':'Food Partnership','business-service':'Business Services','food':'Food Support','housing':'Housing Help','need-help':'HUGS Help App','give-help':'HUGS Help App'};
  let mode=params.get('mode')||'card';
  if(type==='memorial-hug')document.getElementById('occasion').value='Memorial / remembrance';
  if(legacy[type]){mode='help';document.getElementById('help-type').value=legacy[type];}
  if(params.get('from')==='card-studio'){
    try{
      const saved=JSON.parse(sessionStorage.getItem('hugslinks-artist-brief')||'null');
      if(saved?.version===1){
        studioData=saved;
        document.getElementById('recipient').value=String(saved.recipient||'').slice(0,160);
        const occasion=document.getElementById('occasion');
        const occasionMap={'Just because':'Another theme','Porque sí':'Another theme','Love & anniversary':'Love / anniversary','Amor y aniversario':'Love / anniversary','Birthday':'Birthday / celebration','Cumpleaños':'Birthday / celebration','Celebration':'Birthday / celebration','Celebración':'Birthday / celebration','Encouragement':'Healing / encouragement','Ánimo':'Healing / encouragement','Healing & support':'Healing / encouragement','Sanación y apoyo':'Healing / encouragement','Thank you':'Another theme','Gracias':'Another theme'};
        const selectedOccasion=occasionMap[saved.occasion]||saved.occasion;
        if([...occasion.options].some(option=>option.value===selectedOccasion||option.textContent===selectedOccasion))occasion.value=selectedOccasion;
        lastImportedMessage=importedMessage(saved);
        document.getElementById('contactMessage').value=lastImportedMessage;
        importedFromStudio=true;
      }
    }catch{}
  }
  translatePage();
  setMode(mode);
  if(importedFromStudio)summary.textContent=importedNotice();
  document.getElementById('contact-language').addEventListener('click',()=>{
    lang=lang==='en'?'es':'en';
    localStorage.setItem('hugsLanguage',lang);
    localStorage.setItem('hugs-cards-language',lang);
    translatePage();
    setMode(buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.mode||'card');
    if(importedFromStudio)summary.textContent=importedNotice();
  });
})();
