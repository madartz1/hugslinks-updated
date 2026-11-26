/* Shared buyer-only animation pricing preview. No paid generation until backend is verified. */
(() => {
  "use strict";
  const prices = Object.freeze({15:699,30:999,45:1299,60:1599});
  const money = cents => "$"+(cents/100).toFixed(2);
  function mount({image, title, message, cardId, custom=false, anchor=image}) {
    if (!anchor || anchor.dataset.motionMounted || new URLSearchParams(location.hash.slice(1)).has("hug") || new URLSearchParams(location.hash.slice(1)).has("complimentary") || new URLSearchParams(location.search).has("session_id")) return;
    anchor.dataset.motionMounted="true";
    const button=document.createElement("button");
    button.type="button";button.textContent=custom?"Create with AI · from $3.99":"Make It Move · from $4 extra";
    button.style.cssText="display:block;margin:12px auto;padding:12px 18px;border:1px solid #639ec8;border-radius:12px;background:#15365c;color:white;cursor:pointer";
    anchor.insertAdjacentElement("afterend",button);
    const dialog=document.createElement("dialog");
    dialog.style.cssText="width:min(92vw,440px);max-height:85vh;overflow:auto;border:1px solid #9fc8e3;border-radius:16px;padding:22px;color:#15365c;background:white";
    dialog.innerHTML='<form method="dialog"><button aria-label="Close pricing" style="float:right" value="cancel">×</button><h2></h2><p>One-time prices include the card.</p><fieldset><legend>Choose your experience</legend><div data-options></div></fieldset><label style="display:block;margin-top:12px"><span data-label></span><textarea maxlength="600" rows="3" style="display:block;width:100%;box-sizing:border-box"></textarea></label><p data-total aria-live="polite"></p><p>Preview only — animation checkout is not yet available. No payment will be taken.</p><button value="cancel">Return to card</button></form>';
    dialog.querySelector("h2").textContent=custom?"Create with AI":"Make It Move";
    dialog.querySelector("[data-label]").textContent=custom?"Describe your card":"Optional personal direction";
    const opts=dialog.querySelector("[data-options]");
    const entries=custom?[[0,399],...Object.entries(prices).map(([s,p])=>[s,p+100])]:Object.entries(prices);
    entries.forEach(([s,p],i)=>{const label=document.createElement("label");label.style.cssText="display:block;padding:8px 0";const radio=document.createElement("input");radio.type="radio";radio.name="duration";radio.value=s;radio.checked=i===0;radio.dataset.cents=p;label.append(radio,document.createTextNode(" "+(Number(s)?s+" seconds":"Illustrated card")+" — "+money(p)));opts.append(label)});
    function total(){dialog.querySelector("[data-total]").textContent="Total: "+money(Number(opts.querySelector(":checked").dataset.cents))}
    opts.addEventListener("change",total);total();document.body.append(dialog);
    button.addEventListener("click",()=>{if(image && (image.hidden || !image.getAttribute("src")))return;dialog.querySelector("textarea").value="";dialog.showModal()});
  }
  window.HugsMotionPricing={mount};
})();
