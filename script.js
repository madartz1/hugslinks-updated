document.querySelectorAll('.menu').forEach(btn=>btn.addEventListener('click',()=>document.querySelector('.navlinks').classList.toggle('open')));
const path=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('.navlinks a').forEach(a=>{if(a.getAttribute('href')===path)a.classList.add('active')});

/* Sitewide HUGS electric buttons and visitor-controlled sound */
(() => {
  const buttonSelector = [
    '.btn',
    '.button',
    '.product-button',
    '.free-btn',
    'a.buy',
    'button.buy',
    'a.personalize',
    'button.personalize',
    '.personalize-button',
    '.view-button'
  ].join(',');

  document.querySelectorAll(buttonSelector).forEach(button => {
    button.classList.add('electric-interactive');
  });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hugs-sound-toggle';
  toggle.setAttribute('aria-label', 'Turn HUGS interaction sounds on');
  toggle.setAttribute('aria-pressed', 'false');
  toggle.innerHTML = '<span class="sound-wave" aria-hidden="true">♪</span><span class="sound-label">Sound off</span>';
  document.body.appendChild(toggle);

  let soundEnabled = sessionStorage.getItem('hugsSoundEnabled') === 'true';
  let audioContext;

  if (soundEnabled) {
    toggle.setAttribute('aria-pressed', 'true');
    toggle.setAttribute('aria-label', 'Turn HUGS interaction sounds off');
    toggle.querySelector('.sound-label').textContent = 'Sound on';
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioContext = new AudioContext();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone(frequency, delay = 0, duration = .075, volume = .035) {
    const context = getAudioContext();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function playInteractionSound(element) {
    const label = (element.textContent || '').toLowerCase();
    if (/open|download|save|your hug has arrived/.test(label)) {
      tone(523.25, 0, .11, .038);
      tone(783.99, .085, .16, .03);
    } else if (/send|buy|shop|support|choose|personalize/.test(label)) {
      tone(392, 0, .08, .03);
      tone(587.33, .055, .12, .025);
    } else {
      tone(440, 0, .07, .022);
    }
  }

  toggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    sessionStorage.setItem('hugsSoundEnabled', String(soundEnabled));
    toggle.setAttribute('aria-pressed', String(soundEnabled));
    toggle.setAttribute('aria-label', soundEnabled ? 'Turn HUGS interaction sounds off' : 'Turn HUGS interaction sounds on');
    toggle.querySelector('.sound-label').textContent = soundEnabled ? 'Sound on' : 'Sound off';
    if (soundEnabled) {
      tone(523.25, 0, .1, .035);
      tone(659.25, .07, .14, .03);
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest(buttonSelector);
    if (!button || button === toggle) return;
    button.classList.add('is-electric-pressed');
    window.setTimeout(() => button.classList.remove('is-electric-pressed'), 180);
    if (soundEnabled) playInteractionSound(button);
  });
})();


/* Sitewide HUGS Live Help */
(()=>{
 if(document.querySelector('.hugs-help-launcher'))return;
 const style=document.createElement('style');style.textContent=`.hugs-help-launcher{position:fixed;right:18px;bottom:78px;z-index:9997;border:0;border-radius:999px;background:#071f3b;color:#fff;padding:13px 17px;font-weight:900;box-shadow:0 10px 30px rgba(7,31,59,.28);cursor:pointer}.hugs-help-panel{position:fixed;right:18px;bottom:132px;z-index:9998;width:min(380px,calc(100vw - 28px));max-height:min(650px,75vh);overflow:auto;background:#fff;border:1px solid #dce7ef;border-radius:24px;box-shadow:0 24px 70px rgba(7,31,59,.25);display:none}.hugs-help-panel.open{display:block}.hh-head{padding:20px;background:linear-gradient(135deg,#071f3b,#174d80);color:#fff;border-radius:23px 23px 0 0}.hh-head strong{font-size:1.2rem}.hh-body{padding:18px}.hh-options{display:grid;gap:9px}.hh-option{border:1px solid #dce7ef;background:#f7fafc;border-radius:14px;padding:12px;text-align:left;font-weight:800;color:#071f3b;cursor:pointer}.hh-form{display:none}.hh-form label{display:block;font-weight:800;color:#071f3b;margin:10px 0 5px}.hh-form input,.hh-form textarea{width:100%;box-sizing:border-box;border:1px solid #ccdbe6;border-radius:12px;padding:11px;font:inherit}.hh-form textarea{min-height:90px}.hh-send{width:100%;margin-top:12px;border:0;border-radius:13px;background:#1267ff;color:#fff;padding:12px;font-weight:900}.hh-small{color:#68758b;font-size:.82rem;line-height:1.45;margin-top:10px}.hh-close{float:right;background:transparent;border:0;color:#fff;font-size:1.2rem;cursor:pointer}@media(max-width:520px){.hugs-help-launcher{right:12px;bottom:72px}.hugs-help-panel{right:8px;bottom:124px;width:calc(100vw - 16px)}}`;document.head.appendChild(style);
 const tawkConfig=window.HUGS_TAWK||{};let tawkReady=false,tawkStatus='offline';
 function loadTawk(){if(!tawkConfig.propertyId||!tawkConfig.widgetId||document.getElementById('hugs-tawk-script'))return;window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();window.Tawk_API.onLoad=function(){tawkReady=true;tawkStatus=window.Tawk_API.getStatus?window.Tawk_API.getStatus():'offline';if(window.Tawk_API.hideWidget)window.Tawk_API.hideWidget()};window.Tawk_API.onStatusChange=function(status){tawkStatus=status};const s=document.createElement('script');s.id='hugs-tawk-script';s.async=true;s.charset='UTF-8';s.setAttribute('crossorigin','*');s.src='https://embed.tawk.to/'+encodeURIComponent(tawkConfig.propertyId)+'/'+encodeURIComponent(tawkConfig.widgetId);document.head.appendChild(s)}
 loadTawk();
 const launch=document.createElement('button');launch.className='hugs-help-launcher';launch.type='button';launch.textContent='♡ Need a HUG?';launch.setAttribute('aria-label','Open HUGS Live Help');
 const panel=document.createElement('aside');panel.className='hugs-help-panel';panel.setAttribute('aria-label','HUGS Live Help');panel.innerHTML=`<div class="hh-head"><button class="hh-close" aria-label="Close help">×</button><strong>HUGS Live Help</strong><div style="margin-top:5px;font-size:.9rem;opacity:.86">How can we help you today?</div></div><div class="hh-body"><div class="hh-options"><button class="hh-option" data-cat="Order Help">🛍️ Help with an order</button><button class="hh-option" data-cat="HUG Request">🤝 Check my HUG request</button><button class="hh-option" data-cat="Food Partner">🚚 Food donation / pickup help</button><button class="hh-option" data-cat="Artist Help">🎨 Artist submission help</button><button class="hh-option" data-cat="Donation or Payment">💳 Donation or payment help</button><button class="hh-option" data-cat="Website Direction">🧭 Help finding something</button><button class="hh-option" data-cat="General Support">💬 Talk to HUGSLinks</button></div><form class="hh-form"><button type="button" class="hh-back" style="border:0;background:none;padding:0;color:#1267ff;font-weight:800">← Back</button><h3 class="hh-title" style="color:#071f3b;margin:12px 0 5px"></h3><label>Name *</label><input name="name" required autocomplete="name"><label>Email *</label><input name="email" type="email" required autocomplete="email"><label>Reference number</label><input name="reference" placeholder="Order, HUG, FOOD or ARTIST number"><label>How can we help? *</label><textarea name="message" required></textarea><input type="text" name="bot_field" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px"><button class="hh-send" type="submit">Send to HUGSLinks</button><div class="hh-small">Please don't send passwords, payment-card numbers, medical documents or exact private recipient addresses in chat.</div></form><div class="hh-result" aria-live="polite"></div></div>`;
 document.body.append(panel,launch);const options=panel.querySelector('.hh-options'),form=panel.querySelector('.hh-form'),title=panel.querySelector('.hh-title'),result=panel.querySelector('.hh-result');let category='General Support';
 launch.onclick=()=>panel.classList.toggle('open');panel.querySelector('.hh-close').onclick=()=>panel.classList.remove('open');panel.querySelector('.hh-back').onclick=()=>{form.style.display='none';options.style.display='grid';result.innerHTML=''};
 panel.querySelectorAll('.hh-option').forEach(b=>b.onclick=()=>{category=b.dataset.cat;if(tawkReady&&tawkStatus==='online'&&window.Tawk_API){try{window.Tawk_API.setAttributes&&window.Tawk_API.setAttributes({help_category:category,website_page:location.pathname},()=>{});window.Tawk_API.addTags&&window.Tawk_API.addTags([category.replace(/[^a-z0-9]+/gi,'-').toLowerCase()]);window.Tawk_API.showWidget&&window.Tawk_API.showWidget();window.Tawk_API.maximize&&window.Tawk_API.maximize();panel.classList.remove('open');return}catch(e){}}title.textContent=category;options.style.display='none';form.style.display='block'});
 form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('.hh-send'),fd=new FormData(form);btn.disabled=true;btn.textContent='Sending…';try{const res=await fetch('/.netlify/functions/submit-support',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',body:JSON.stringify({category,name:fd.get('name'),email:fd.get('email'),reference:fd.get('reference'),message:fd.get('message'),bot_field:fd.get('bot_field'),page:location.pathname})});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'Message could not be sent.');form.reset();form.style.display='none';result.innerHTML='<div style="padding:14px;border-radius:14px;background:#effaf4;color:#174b2d"><strong>Message received.</strong><br>Your support reference is <strong>'+data.support_id+'</strong>. Save it for follow-up.</div>'}catch(err){result.textContent=err.message}finally{btn.disabled=false;btn.textContent='Send to HUGSLinks'}});
})();