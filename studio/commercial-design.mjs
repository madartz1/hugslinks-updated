import {wrapLines} from './commercial-model.mjs';
export const fonts={modern:'Arial, Helvetica, sans-serif',editorial:'Georgia, "Times New Roman", serif',bold:'Impact, "Arial Black", sans-serif',rounded:'"Trebuchet MS", Arial, sans-serif',classic:'Verdana, Geneva, sans-serif'};
export function inkOn(hex){const rgb=hex.replace('#','').match(/../g)?.map(v=>parseInt(v,16))||[0,0,0];return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>155?'#102b45':'#ffffff'}
export function drawCommercial(ctx,s,drawMedia){
 const family=fonts[s.font]||fonts.modern,align=['left','center','right'].includes(s.align)?s.align:'left',x=align==='left'?64:align==='right'?476:270;
 const scale={small:.82,medium:1,large:1.16}[s.size]||1,base=s.brand||'#102b45',accent=s.accent||'#087bbd',color=s.color||'#ffffff',style=s.style||'spotlight';
 const text=(value,y,size,max=4,weight='700',paint=color,width=412)=>{ctx.font=weight+' '+Math.round(size*scale)+'px '+family;ctx.textAlign=align;ctx.fillStyle=paint;const rows=wrapLines(ctx,value,width,max);for(const line of rows){ctx.fillText(line,x,y);y+=Math.round(size*scale)*1.16}return y};
 const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
 const round=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
 rect(0,0,540,960,base);let gradient=ctx.createLinearGradient(0,0,540,960);gradient.addColorStop(0,'#ffffff0c');gradient.addColorStop(1,'#00000088');ctx.fillStyle=gradient;ctx.fillRect(0,0,540,960);
 if(!s.hasMedia){
  ctx.save();ctx.globalAlpha=.30;ctx.fillStyle=accent;
  if(style==='bold'){ctx.beginPath();ctx.moveTo(320,0);ctx.lineTo(540,0);ctx.lineTo(540,820);ctx.lineTo(0,960);ctx.lineTo(0,820);ctx.closePath();ctx.fill();ctx.globalAlpha=.15;ctx.fillRect(0,180,540,9);ctx.fillRect(0,200,540,3)}
  else{ctx.beginPath();ctx.arc(490,220,230,0,Math.PI*2);ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.arc(475,250,270,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(475,250,290,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
 }else{drawMedia();gradient=ctx.createLinearGradient(0,0,0,960);gradient.addColorStop(0,'#00000085');gradient.addColorStop(.35,'#00000000');gradient.addColorStop(.55,'#00000035');gradient.addColorStop(1,'#000000e8');ctx.fillStyle=gradient;ctx.fillRect(0,0,540,960)}
 if(s.index!==3&&s.logo){const image=s.logo,ratio=Math.min(150/image.naturalWidth,100/image.naturalHeight),w=image.naturalWidth*ratio,h=image.naturalHeight*ratio,lx=align==='left'?64:align==='right'?476-w:270-w/2;round(lx-9,85,w+18,h+18,14,'#ffffff');ctx.drawImage(image,lx,94,w,h)}
 if(s.index===3){
  if(s.hasMedia)rect(0,0,540,960,'#00000075');
  if(s.logo){const image=s.logo,ratio=Math.min(180/image.naturalWidth,150/image.naturalHeight);const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;const lx=align==='left'?64:align==='right'?476-width:270-width/2;round(lx-12,188-12,width+24,height+24,18,'#ffffff');ctx.drawImage(image,lx,188,width,height)}
  text(s.business||'Your business',s.logo?412:280,40,3);
  const cta=wrapLines((ctx.font='700 '+Math.round(36*scale)+'px '+family,ctx),s.message,376,3),height=Math.max(100,cta.length*Math.round(36*scale)*1.16+42),top=s.logo?525:470;
  round(46,top,448,height,style==='bold'?2:18,accent);ctx.save();ctx.textAlign='center';ctx.fillStyle=inkOn(accent);let y=top+Math.round(36*scale)+19;for(const row of cta){ctx.fillText(row,270,y);y+=Math.round(36*scale)*1.16}ctx.restore();
  text(s.contact||'',Math.min(top+height+65,785),23,3,'400','#ffffff');
 }else if(style==='editorial'){
  const panel=inkOn(color)==='#102b45'?'#0b2138f0':'#fffffff2';round(38,215,464,565,20,panel);
  const brandColor=inkOn(color)==='#102b45'?'#c1e4fa':'#23435b';text(s.business||'Your business',280,20,2,'400',brandColor);
  rect(64,350,72,5,accent);text(s.message,425,49,5,'700',color);
 }else{
  text(s.business||'Your business',s.logo?250:190,22,2,'400','#ffffff');
  const titleY=s.hasMedia?605:style==='bold'?390:380;
  if(s.hasMedia||inkOn(color)==='#ffffff'){round(42,titleY-65,456,Math.min(300,4*58*scale+50),16,inkOn(color)==='#ffffff'?'#fffffff2':'#061322ae')}
  ctx.save();ctx.shadowColor='#00000055';ctx.shadowBlur=14;ctx.shadowOffsetY=2;text(s.message,titleY,style==='bold'?60:52,s.hasMedia?3:4,'700',color);ctx.restore();
  rect(64,778,412,1,'#ffffff45');rect(64,775,85,6,accent);
 }
}
