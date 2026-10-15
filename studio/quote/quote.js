const byId = id => document.getElementById(id);
const message = byId('message');
let token = location.hash.slice(1);
if (/^[a-f0-9]{64}$/.test(token)) {
  try { sessionStorage.setItem('hl-pilot-quote', token); } catch {}
  history.replaceState(null, '', location.pathname);
} else {
  try { token = sessionStorage.getItem('hl-pilot-quote') || ''; } catch { token = ''; }
}
async function call(action, data = {}) {
  const response = await fetch('/.netlify/functions/hl-studio-pilot?action=' + action, {
    method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,token})
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Unable to load quote.');
  return result;
}
async function load() {
  if (!token) { message.textContent = 'Open the private quote link from your email in this browser.'; return; }
  try {
    const {quote} = await call('quote-view');
    byId('business').textContent = quote.business;
    byId('amount').textContent = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(quote.amount/100);
    byId('scope').textContent = quote.scope;
    byId('status').textContent = 'Quote: ' + quote.status + ' · Sandbox payment: ' + quote.payment;
    byId('approval').hidden = quote.status !== 'sent';
    byId('pay').hidden = quote.status !== 'approved' || quote.payment === 'paid';
    byId('quote').hidden = false;
    message.textContent = quote.payment === 'paid' ? 'Sandbox payment verified. Your test is complete; no real money was charged.' : 'Review your quote below. This is a sandbox demonstration.';
  } catch(error) { message.textContent = error.message; byId('quote').hidden = true; }
}
byId('approve').addEventListener('click',async()=>{
  if (!byId('consent').checked) { message.textContent = 'Check the confirmation box to approve the sandbox quote.'; return; }
  byId('approve').disabled = true;
  try { await call('quote-approve',{consent:true}); await load(); } catch(error) { message.textContent = error.message; }
  finally { byId('approve').disabled = false; }
});
byId('pay').addEventListener('click',async()=>{
  byId('pay').disabled = true;
  try {
    const result = await call('quote-checkout');
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw Error('Invalid checkout destination.');
    location.assign(url.href);
  } catch(error) { message.textContent = error.message; byId('pay').disabled = false; }
});
byId('refresh').addEventListener('click',load);
load();
