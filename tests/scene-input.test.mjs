import { test } from 'node:test';
import assert from 'node:assert/strict';
import {sceneInput} from '../netlify/functions/_shared/hl-studio-scene-input.mjs';
test('text scene retains existing route and selected proportions',()=>{
 const result=sceneInput({prompt:'A restaurant scene',format:'9/16'});
 assert.equal(result.model,'fal-ai/fast-svd/text-to-video');assert.equal(result.input.video_size,'portrait_16_9');assert.equal(result.input.enable_safety_checker,true);
});
test('photo scene sends image and movement together through image-to-video route',()=>{
 const image='data:image/png;base64,iVBORw0KGgo=';
 const result=sceneInput({prompt:'Slow camera push toward the plate',image});
 assert.equal(result.model,'fal-ai/minimax/video-01/image-to-video');assert.equal(result.input.image_url,image);assert.match(result.input.prompt,/Slow camera push/);assert.equal(result.input.video_size,undefined);
});
test('rejects remote URLs, SVG, forged MIME, malformed and oversized references',()=>{
 for(const image of ['https://example.com/photo.jpg','data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,aGVsbG8=',{},null,'data:image/png;base64,iVBORw0KGgo', 'x'.repeat(2800001)])assert.throws(()=>sceneInput({image}));
});
