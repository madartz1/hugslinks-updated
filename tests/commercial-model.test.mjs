import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sceneAt,timings,templates,wrapLines,exportProfile,timeline,sceneLength,moveScene,clipRange} from '../studio/commercial-model.mjs';
test('15-second timeline switches cleanly at each boundary',()=>{
 assert.equal(timings.reduce((a,b)=>a+b,0),15);
 for(const [time,index,elapsed] of [[0,0,0],[2.99,0,2.99],[3,1,0],[8.5,1,5.5],[9,2,0],[12,3,0],[15,3,3]])assert.deepEqual(sceneAt(time),{index,elapsed,duration:timings[index]});
});
test('overlay wrapping bounds long copy, URLs and brand names',()=>{
 const ctx={measureText:text=>({width:[...text].length*10})};
 for(const text of ['A friendly local restaurant with delicious food and a wonderful atmosphere','https://example.invalid/verylongbookingaddresswithoutspaces','LongBusinessNameWithoutAnySpacesAtAll']){
 const lines=wrapLines(ctx,text,100,3);assert(lines.length<=3);assert(lines.every(line=>ctx.measureText(line).width<=100));assert(lines.at(-1).endsWith('…'));
 }
 assert.deepEqual(wrapLines(ctx,'Visit us',100,3),['Visit us']);
});
test('each template produces a complete four-slot storyboard with a CTA',()=>{
 assert.equal(Object.keys(templates).length,5);
 for(const t of Object.values(templates)){assert.equal(t.lines.length,4);assert.equal(t.shots.length,4);assert(t.lines[3].trim());assert(t.goal&&t.audience)}
});

test('export profiles preserve vertical proportions and Full HD fallback',()=>{
 for(const quality of ['fullhd','hd','compact']){const p=exportProfile(quality);assert.equal(p.width/p.height,9/16);assert(p.bitrate>=3000000)}
 assert.equal(exportProfile('fullhd').width,1080);assert.equal(exportProfile('fullhd').height,1920);assert.deepEqual(exportProfile('invalid'),exportProfile('fullhd'));assert.equal(exportProfile('compact').width,540);
});

test('reordering preserves scene identity and recalculates timing boundaries',()=>{
 const original=[0,1,2,3],order=moveScene(original,3,-1),lengths=[3,7.5,2,4];assert.deepEqual(original,[0,1,2,3]);assert.deepEqual(order,[0,1,3,2]);
 const entries=timeline(order,lengths);assert.deepEqual(entries.map(s=>[s.id,s.start,s.end]),[[0,0,3],[1,3,10.5],[3,10.5,14.5],[2,14.5,16.5]]);assert.equal(order[sceneAt(10.5,entries.map(s=>s.duration)).index],3);assert.deepEqual(moveScene(order,0,-1),order);assert.deepEqual(moveScene(order,2,1),order);
});
test('scene length limits constrain invalid saved or edited timing',()=>{assert.equal(sceneLength(100),10);assert.equal(sceneLength(-2),1);assert.equal(sceneLength('invalid'),3);assert.equal(sceneLength(3.7),3.5)});
test('video trims remain within the source and maintain a nonempty range',()=>{
 assert.deepEqual(clipRange(2,5,8),{start:2,end:5});assert.deepEqual(clipRange(-1,20,8),{start:0,end:8});const end=clipRange(20,1,8);assert(end.start<end.end);assert.equal(end.end,8);assert.throws(()=>clipRange(0,3,Infinity));assert.throws(()=>clipRange(0,3,0));
});
