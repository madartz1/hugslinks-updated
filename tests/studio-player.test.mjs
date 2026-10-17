import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('recovered video keeps branded cover until playback, and restores it when idle or unavailable',async()=>{
 const nodes=new Map();const node=id=>{if(nodes.has(id))return nodes.get(id);const listeners={};const element={hidden:false,disabled:false,src:'',paused:true,ended:false,muted:false,textContent:'',attributes:{},addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn)},emit:event=>{for(const fn of listeners[event]||[])fn()},setAttribute(name,value){this.attributes[name]=value},getAttribute(name){return name==='src'?this.src||null:this.attributes[name]||null},load(){},scrollIntoView(){},pause(){this.paused=true;this.emit('pause')},async play(){this.paused=false;this.emit('play');this.emit('playing')}};nodes.set(id,element);return element};
 const context={document:{getElementById:node,addEventListener(){}},console,fetch:async url=>({ok:true,json:async()=>url.includes('config')?{enabled:true,limits:{video:1,music:1},used:{}}:{jobs:[{id:'saved-video',kind:'video',status:'completed',url:'https://example.invalid/saved.mp4'}]}})};
 vm.runInNewContext(await readFile(new URL('../studio/ai-media.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 const cover=node('hlVideoPlaceholder'),video=node('generatedScene'),play=node('hlPlayPause');
 assert.equal(video.src,'https://example.invalid/saved.mp4');assert.equal(cover.hidden,false);assert.equal(play.disabled,false);assert.equal(node('hlPlayerLoading').hidden,true);
 await video.play();assert.equal(cover.hidden,true);
 video.pause();assert.equal(cover.hidden,false);assert.match(node('hlPlayerMessage').textContent,/paused/);
 video.ended=true;video.emit('ended');assert.equal(cover.hidden,false);assert.match(play.textContent,/Replay/);
 video.emit('error');assert.equal(cover.hidden,false);assert.match(node('hlPlayerMessage').textContent,/could not load/);
});
