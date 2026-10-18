const byId=id=>document.getElementById(id);
const btn=byId('aiGenerate'),status=byId('aiMessageStatus');
btn?.addEventListener('click',async()=>{
 const prompt=byId('aiPrompt').value.trim(),tone=byId('aiTone').value;
 if(prompt.length<12){status.textContent='Please describe your message in a little more detail.';return}
 btn.disabled=true;status.textContent='Writing your message…';
 try{
  const response=await fetch('/api/hugs-cards/generate-message',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,tone,occasion:byId('occasion').value})});
  const result=await response.json();
  if(!response.ok||typeof result.message!=='string')throw Error(result.error||'Generation is unavailable');
  byId('message').value=result.message.slice(0,1500);
  byId('message').dispatchEvent(new Event('input',{bubbles:true}));
  status.textContent='Message added to your card. You can edit it before sending.';
 }catch(error){status.textContent=error.message||'Unable to generate right now.'}
 finally{btn.disabled=false}
});