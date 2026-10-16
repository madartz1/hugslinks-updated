// Validate inline raster references before consuming allowance or contacting fal.
export function sceneInput(body) {
 const prompt=String(body.prompt||'').trim()+', cinematic advertising shot, realistic, no text overlays, no watermark';
 if(body.image===undefined)return {model:'fal-ai/fast-svd/text-to-video',input:{prompt,video_size:body.format==='16/9'?'landscape_16_9':body.format==='1/1'?'square':'portrait_16_9',fps:10,enable_safety_checker:true}};
 if(typeof body.image!=='string'||body.image.length>2800000)throw Error('Photo must be a JPG, PNG or WebP under 2 MB after preparation.');
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image);
 if(!match||match[2].length%4)throw Error('Invalid photo attachment.');
 const bytes=Buffer.from(match[2],'base64');
 const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid||bytes.length>2*1024*1024)throw Error('Invalid photo attachment.');
 return {model:'fal-ai/minimax/video-01/image-to-video',input:{prompt,image_url:body.image,prompt_optimizer:true}};
}
