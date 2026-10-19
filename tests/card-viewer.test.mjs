import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
const source=readFileSync(new URL('../app/card-viewer.js',import.meta.url),'utf8');
async function run(tampered=false,owner=false){
 const nodes=new Map(),bytes=Buffer.from('test media'),hash=createHash('sha256').update(bytes).digest('hex');let rendered;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:0,textContent:''});return nodes.get(id);};
 const card={fields:{title:'A HUG'},media:{inside:{type:'image/png',parts:1,size:bytes.length,hashes:[hash]},video:{type:'video/mp4',parts:1,size:bytes.length,hashes:[hash]},audio:{type:'audio/mpeg',parts:1,size:bytes.length,hashes:[hash]}}};
 const context=vm.createContext({document:{getElementById:get,body:{classList:{add(){}}}},location:{hash:owner?'#owner.'+'a'.repeat(32):'#'+'a'.repeat(32)+'.'+'b'.repeat(64)},sessionStorage:{getItem:()=>JSON.stringify({session:'owner-session'})},crypto:webcrypto,Uint8Array,Blob,FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload();});}},fetch:async url=>({ok:true,json:async()=>({card,expiresAt:'2099-01-01'}),arrayBuffer:async()=>Uint8Array.from(tampered?Buffer.from('wrong media'):bytes).buffer}),cardHTML:async s=>{rendered=s;return '<html><head></head><body>Card</body></html>';}});
 vm.runInContext(source,context);for(let i=0;i<20&&!get('recipientFrame').srcdoc&&!get('viewStatus').textContent.includes('incomplete');i++)await new Promise(r=>setImmediate(r));
 return {get,rendered};
}
test('recipient frame receives self-contained media instead of inaccessible parent blob URLs',async()=>{const h=await run();assert.match(h.rendered.media.inside.data,/^data:image\/png;base64,/);assert.match(h.rendered.media.video.data,/^data:video\/mp4;base64,/);assert.match(h.rendered.media.audio.data,/^data:audio\/mpeg;base64,/);assert.equal(h.get('recipientFrame').hidden,false);assert.match(h.get('recipientFrame').srcdoc,/media-src data:/);const html=readFileSync(new URL('../app/view-card.html',import.meta.url),'utf8');assert.match(html,/sandbox="allow-scripts"/);assert.doesNotMatch(html,/allow-same-origin/);});
test('altered recipient media does not reach the card renderer',async()=>{const h=await run(true);assert.equal(h.rendered,undefined);assert.match(h.get('viewStatus').textContent,/incomplete/);});

test('signed-in owner view uses the same media renderer without a recipient token in its URL',async()=>{const h=await run(false,true);assert.equal(h.get('recipientFrame').hidden,false);assert.equal(h.get('viewerBack').hidden,false);assert.match(h.rendered.media.video.data,/^data:video\/mp4;base64,/);});
