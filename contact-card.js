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
  const labels={
    card:['Custom HUG / Commission','Custom card design','Send custom card request','You’re sending a custom card design request.'],
    help:['Community Help','Community help','Send community help request','You’re sending a community help request.'],
    both:['Custom HUG + Community Help','Custom card design and community help','Send both requests','You’re sending a card design request and a separate community help request.']
  };
  function setMode(mode,animate=false){
    if(!labels[mode])mode='card';
    const cardOn=mode!=='help',helpOn=mode!=='card';
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    for(const [panel,on] of [[card,cardOn],[help,helpOn]]){
      const wasHidden=panel.hidden;panel.hidden=!on;
      panel.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=!on;});
      if(on&&wasHidden&&animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&panel.animate){
        panel.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
      }
    }
    document.getElementById('contactMessage').required=cardOn;
    document.querySelectorAll('[name=card_format]').forEach(el=>el.required=cardOn);
    document.getElementById('occasion').required=cardOn;
    document.getElementById('help-type').required=helpOn;
    document.getElementById('help-message').required=helpOn;
    [topic.value,request.value,submit.textContent,summary.textContent]=labels[mode];
    if(helpOn&&document.getElementById('help-type').value)topic.value=mode==='help'?document.getElementById('help-type').value:'Custom HUG + '+document.getElementById('help-type').value;
  }
  buttons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode,true)));
  document.getElementById('help-type').addEventListener('change',()=>setMode(buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.mode||'card'));
  const params=new URLSearchParams(location.search),type=params.get('type');
  const legacy={'food-partnership':'Food Partnership','business-service':'Business Services','food':'Food Support','housing':'Housing Help','need-help':'HUGS Help App','give-help':'HUGS Help App'};
  let mode=params.get('mode')||'card';
  if(type==='memorial-hug')document.getElementById('occasion').value='Memorial / remembrance';
  if(legacy[type]){mode='help';document.getElementById('help-type').value=legacy[type];}
  setMode(mode);
})();
