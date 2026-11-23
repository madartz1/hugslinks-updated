/* HUGSLinks sender-path celebration. Existing links and checkout handlers remain intact. */
(()=>{'use strict';
const style=document.createElement('style');style.textContent=`
.hugs-purchase-spark{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden}
.hugs-purchase-spark i{position:absolute;left:var(--x);top:var(--y);font-style:normal;color:#7de2ff;font-size:var(--size);text-shadow:0 0 12px #37baff,0 0 24px #d7faff;animation:hugs-purchase-rise 1.2s ease-out forwards}
@keyframes hugs-purchase-rise{0%{opacity:0;transform:translate(-50%,0) scale(.35)}20%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),var(--dy)) rotate(var(--rot)) scale(1.3)}}
.hugs-purchase-shimmer{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 0 18px #48caff66!important}
.hugs-purchase-shimmer:after{content:"";position:absolute;inset:-70% auto -70% -45%;width:35%;background:linear-gradient(90deg,transparent,#ffffff77,transparent);transform:rotate(22deg);animation:hugs-purchase-shine 2.5s linear infinite;pointer-events:none}
@keyframes hugs-purchase-shine{to{left:145%}}
@media(prefers-reduced-motion:reduce){.hugs-purchase-spark{display:none}.hugs-purchase-shimmer:after{animation:none;display:none}}
`;document.head.append(style);
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
function eligible(el){if(!el||el.closest('header,nav,footer,[role="navigation"]'))return false;
const text=(el.textContent||'').trim().toLowerCase();const href=(el.getAttribute('href')||'').toLowerCase();
if(el.matches('button')&&/send hugs card|send this hug|send a hug/.test(text))return true;
if(!el.matches('a[href]'))return false;
if(/^(mailto:|tel:|javascript:)/.test(href))return false;
return /send a hug|send this hug|create your hugs card|create your own|ready to send|choose a hug|explore app-style hugs|create an app-style hug|send nyc ride|preview anniversary motion card|browse ready-made cards|continue to send your card/i.test(text)
||(/buy\.stripe\.com/.test(href)&&/hug|card|send/i.test(text));}
function burst(el){if(reduce.matches)return;const r=el.getBoundingClientRect(),layer=document.createElement('div');layer.className='hugs-purchase-spark';layer.setAttribute('aria-hidden','true');
for(let i=0;i<32;i++){const h=document.createElement('i');h.textContent=i%3?'♡':'♥';h.style.setProperty('--x',r.left+r.width*(.15+Math.random()*.7)+'px');h.style.setProperty('--y',r.top+r.height/2+'px');h.style.setProperty('--size',14+Math.random()*19+'px');h.style.setProperty('--dx',(Math.random()-.5)*350+'px');h.style.setProperty('--dy',-90-Math.random()*300+'px');h.style.setProperty('--rot',(Math.random()-.5)*100+'deg');layer.append(h)}document.body.append(layer);setTimeout(()=>layer.remove(),1350)}
function chime(){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const ctx=new A();if(ctx.state==='suspended')ctx.resume();const t=ctx.currentTime;[523.25,659.25,783.99].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),s=t+i*.09;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.055,s+.03);g.gain.exponentialRampToValueAtTime(.0001,s+.36);o.connect(g).connect(ctx.destination);o.start(s);o.stop(s+.37)});setTimeout(()=>ctx.close().catch(()=>{}),1000)}catch(_){}}
function decorate(){document.querySelectorAll('a[href],button').forEach(el=>{if(eligible(el))el.classList.add('hugs-purchase-shimmer')})}
document.addEventListener('click',e=>{const el=e.target.closest('a[href],button');if(!eligible(el))return;burst(el);chime();
if(el.matches('a[href]')&&!e.defaultPrevented&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&(!el.target||el.target==='_self')&&!reduce.matches){const url=el.href;if(!url||url.startsWith('javascript:')||el.hasAttribute('download'))return;e.preventDefault();setTimeout(()=>location.assign(url),850)}},false);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();
new MutationObserver(()=>decorate()).observe(document.documentElement,{childList:true,subtree:true});
})();
