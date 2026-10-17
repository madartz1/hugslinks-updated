import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawCommercial,inkOn} from '../studio/commercial-design.mjs';
function context(){const text=[],images=[];const ctx={text,images,fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},arc(){},stroke(){},save(){},restore(){},roundRect(){},createLinearGradient(){return{addColorStop(){}}},measureText(value){return{width:String(value).length*13}},fillText(value,x,y){text.push({value,x,y,font:this.font,align:this.textAlign})},drawImage(...args){images.push(args)}};return ctx}
test('client logo renders in each scene and selected typography reaches export drawing',()=>{
 for(const style of ['spotlight','editorial','bold'])for(let index=0;index<4;index++){
 const ctx=context();drawCommercial(ctx,{index,style,font:'editorial',size:'large',align:'left',logo:{naturalWidth:300,naturalHeight:200},business:'Client business',message:'Fresh ideas. Beautiful results.',contact:'example.invalid',brand:'#102b45',accent:'#087bbd',color:'#ffffff',hasMedia:false},()=>{});
 assert.equal(ctx.images.length,1);assert(ctx.text.some(t=>t.font.includes('Georgia')));assert(ctx.text.every(t=>Number.isFinite(t.x)&&t.y>0&&t.y<960));assert(ctx.text.some(t=>t.value.includes(index===3?'Fresh':'Client')));
 }
});
test('CTA contrast uses readable ink for light and dark client accent colors',()=>{assert.equal(inkOn('#ffffff'),'#102b45');assert.equal(inkOn('#087bbd'),'#ffffff')});

test('opening scene prioritizes the client name over the promotional headline',()=>{
 const ctx=context();drawCommercial(ctx,{index:0,font:'modern',style:'spotlight',size:'medium',align:'left',business:'La Rivera Restaurant',message:'Your next favorite meal.',brand:'#102b45',accent:'#087bbd',color:'#ffffff',hasMedia:false},()=>{});
 const brand=ctx.text.find(t=>t.value.includes('La Rivera')),headline=ctx.text.find(t=>t.value.includes('Your next'));assert(brand&&headline);assert.match(brand.font,/800 52px/);assert.match(headline.font,/700 40px/);assert(brand.y<headline.y);
});
