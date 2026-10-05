import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
export class ApiError extends Error { constructor(status,message){super(message);this.status=status} }
const fail=(s,m)=>{throw new ApiError(s,m)};
export const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const id=prefix=>prefix+'-'+randomUUID();
const clean=(v,max=200)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
const secureEq=(a,b)=>{const x=new TextEncoder().encode(a||''),y=new TextEncoder().encode(b||'');return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)};
const email=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const checkToken=v=>/^[a-f0-9]{64}$/.test(v||'');
const keyFor=(kind,v)=>{if(!new RegExp('^'+kind+'-[a-f0-9-]{36}$').test(v||''))fail(400,'Invalid record ID.');return kind+'/'+v};
const now=()=>new Date().toISOString();
export function safeImage(v){
 if(!v)return '';
 if(typeof v==='string'&&/^\/\.netlify\/functions\/restaurant-image\?id=MEDIA-[a-f0-9-]{36}$/.test(v))return v;
 if(typeof v!=='string'||v.length>1100000)fail(400,'Use a JPEG, PNG or WebP image smaller than 750 KB.');
 const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);if(!m)fail(400,'Upload a JPEG, PNG or WebP photo.');
 const binary=atob(m[2]),b=Uint8Array.from(binary,c=>c.charCodeAt(0));if(b.length>750000||btoa(binary)!==m[2])fail(400,'Invalid or oversized photo.');
 const valid=m[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:m[1]==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):String.fromCharCode(...b.subarray(0,4))==='RIFF'&&String.fromCharCode(...b.subarray(8,12))==='WEBP';
 if(!valid)fail(400,'Photo format does not match the uploaded file.');return v;
}
export function normalizeItem(b,existingId){
 const name=clean(b.name,100),description=clean(b.description,500),category=clean(b.category,60)||'Meals';
 if(!name||!integer(b.price_cents,100,100000))fail(400,'Each item needs a name and a price from $1 to $1,000.');
 const groups=(Array.isArray(b.options)?b.options:[]).slice(0,6).map(g=>{
  const options=(Array.isArray(g.choices)?g.choices:[]).slice(0,12).map(o=>({id:clean(o.id,60)||id('OPT'),name:clean(o.name,80),price_cents:o.price_cents}));
  if(!clean(g.name,80)||!options.length||options.some(o=>!o.name||!integer(o.price_cents,0,10000))||new Set(options.map(o=>o.id)).size!==options.length)fail(400,'Invalid item options.');
  return {id:clean(g.id,60)||id('GRP'),name:clean(g.name,80),required:g.required===true,choices:options};
 });
 if(new Set(groups.map(g=>g.id)).size!==groups.length)fail(400,'Option groups must have unique IDs.');
 return {id:existingId||id('ITEM'),name,description,category,price_cents:b.price_cents,available:b.available!==false,image:safeImage(b.image),options:groups};
}
export const publicRestaurant=r=>({id:r.id,name:r.name,cuisine:r.cuisine,description:r.description,area:r.area,pickup_address:r.pickup_address,hours:r.hours,delivery_zips:r.delivery_zips,paused:r.paused,photo:r.photo,items:r.items,updated_at:r.updated_at});
export const publicOrder=o=>({id:o.id,restaurant_id:o.restaurant_id,restaurant_name:o.restaurant_name,status:o.status,fulfillment:o.fulfillment,items:o.items,pricing:o.pricing,test_only:true,created_at:o.created_at,updated_at:o.updated_at,timeline:o.timeline});
function normalizeProfile(b){
 const r={name:clean(b.name,120),cuisine:clean(b.cuisine,100),description:clean(b.description,700),area:clean(b.area,100),pickup_address:clean(b.pickup_address,250),hours:clean(b.hours,300),contact_name:clean(b.contact_name,100),email:clean(b.email,254).toLowerCase(),phone:clean(b.phone,40),photo:safeImage(b.photo),delivery_zips:[...new Set((Array.isArray(b.delivery_zips)?b.delivery_zips:[]).map(v=>clean(v,5)))].slice(0,20)};
 if(!r.name||!r.area||!r.pickup_address||!r.hours||!r.contact_name||!email(r.email)||!r.phone||r.delivery_zips.some(v=>!/^\d{5}$/.test(v)))fail(400,'Complete restaurant, location, hours, contact, and valid delivery ZIP codes.');return r;
}
export function buildQuote(r,b){
 if(r.status!=='approved'||r.paused)fail(409,'This restaurant is not accepting test orders.');
 if(!['pickup','delivery'].includes(b.fulfillment))fail(400,'Choose pickup or delivery.');
 if(b.fulfillment==='delivery'&&!r.delivery_zips.includes(clean(b.zip,5)))fail(400,'Delivery is outside this restaurant’s test service area.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)fail(400,'Choose 1 to 30 menu items.');
 const items=b.items.map(line=>{
  const item=r.items.find(i=>i.id===line.item_id);if(!item||!item.available)fail(409,'A selected menu item is unavailable.');
  if(!integer(line.quantity,1,20))fail(400,'Item quantity must be 1 to 20.');
  const chosen=Array.isArray(line.choices)?line.choices:[];
  if(chosen.length>6||new Set(chosen.map(c=>c.group_id)).size!==chosen.length)fail(400,'Choose at most one option per group.');
  if(chosen.some(c=>!item.options.some(g=>g.id===c.group_id)))fail(400,'Invalid option group.');
  const options=item.options.flatMap(g=>{const selection=chosen.find(c=>c.group_id===g.id);if(!selection){if(g.required)fail(400,'Select '+g.name+' for '+item.name+'.');return []}const opt=g.choices.find(x=>x.id===selection.choice_id);if(!opt)fail(400,'Invalid item option.');return [{group:g.name,name:opt.name,price_cents:opt.price_cents}]});
  const unit=item.price_cents+options.reduce((s,c)=>s+c.price_cents,0);
  return {item_id:item.id,name:item.name,quantity:line.quantity,options,unit_cents:unit,line_cents:unit*line.quantity};
 });
 const subtotal=items.reduce((s,l)=>s+l.line_cents,0);if(subtotal>100000)fail(400,'Test orders must be $1,000 or less.');
 const delivery=b.fulfillment==='delivery'?599:0,service=199;
 return {items,pricing:{subtotal_cents:subtotal,delivery_cents:delivery,service_cents:service,total_cents:subtotal+delivery+service,tax_cents:null,currency:'USD',label:'Test estimate — tax excluded, no payment collected'}};
}
export function createService(store,env={}){
 const read=async(kind,key)=>{const record=await store.getWithMetadata(keyFor(kind,key),{type:'json',consistency:'strong'});if(!record)fail(404,'Record not found.');return record};
 const write=async(kind,key,data,etag)=>{const result=await store.setJSON(keyFor(kind,key),data,etag?{onlyIfMatch:etag}:{onlyIfNew:true});if(!result.modified)fail(409,'This record changed. Refresh and try again.');return data};
 const putImage=async value=>{if(!value||value.startsWith('/.netlify/functions/restaurant-image'))return value;const m=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(safeImage(value));const imageId=id('MEDIA');await store.set('MEDIA/'+imageId,Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0)),{metadata:{content_type:m[1]},onlyIfNew:true});return '/.netlify/functions/restaurant-image?id='+imageId};
 const list=async(kind)=>{const out=[];for await(const page of store.list({prefix:kind+'/',paginate:true})){for(const b of page.blobs){if(out.length>=500)fail(503,'Too many records for this pilot. Contact HUGSLinks.');const record=await store.getWithMetadata(b.key,{type:'json',consistency:'strong'});if(record)out.push(record.data)}}return out};
 const admin=auth=>{if(!env.HUGS_ADMIN_TOKEN||!secureEq(auth,env.HUGS_ADMIN_TOKEN))fail(401,'Admin access key required.')};
 const merchant=async(restaurantId,auth)=>{const rec=await read('REST',restaurantId);if(!checkToken(auth)||!secureEq(hash(auth),rec.data.key_hash))fail(401,'Restaurant access key required.');return rec};
 const helper=async(helperId,auth)=>{const rec=await read('HELP',helperId);if(!checkToken(auth)||!rec.data.active||!secureEq(hash(auth),rec.data.key_hash))fail(401,'Approved helper access key required.');return rec};
 const viewMerchant=r=>({...publicRestaurant(r),status:r.status,contact_name:r.contact_name,email:r.email,phone:r.phone});
 return async(action,b={},auth='')=>{
  if(action==='restaurants'){return {restaurants:(await list('REST')).filter(r=>r.status==='approved').map(r=>{const p=publicRestaurant(r);delete p.items;return p}),mode:'test',payments_enabled:false}}
  if(action==='restaurant'){const r=(await read('REST',b.restaurant_id)).data;if(r.status!=='approved')fail(404,'Restaurant not found.');return {restaurant:publicRestaurant(r)}}
  if(action==='register'){
   if(b.consent!==true)fail(400,'Confirm permission to publish your restaurant details and photos.');
   const profile=normalizeProfile(b),key=token(),restaurant={...profile,id:id('REST'),status:'pending',paused:true,items:[],key_hash:hash(key),created_at:now(),updated_at:now(),consent_at:now()};
   restaurant.photo=await putImage(restaurant.photo);await write('REST',restaurant.id,restaurant);return {restaurant:viewMerchant(restaurant),access_key:key,message:'Application saved. Keep your access key private; approval is required before listing.'};
  }
  if(action==='merchant'){const r=await merchant(b.restaurant_id,auth);return {restaurant:viewMerchant(r.data)}}
  if(action==='profile'){
   const r=await merchant(b.restaurant_id,auth),profile=normalizeProfile(b.profile||{});
   // Identity/address changes require another review; hours and descriptive edits can remain approved.
   const changed=['name','pickup_address','email'].some(k=>profile[k]!==r.data[k]);
   profile.photo=await putImage(profile.photo);const updated={...r.data,...profile,status:changed?'pending':r.data.status,paused:changed?true:r.data.paused,updated_at:now()};
   await write('REST',updated.id,updated,r.etag);return {restaurant:viewMerchant(updated)};
  }
  if(action==='menu-save'||action==='menu-delete'||action==='pause'){
   const r=await merchant(b.restaurant_id,auth),updated={...r.data,updated_at:now()};
   if(action==='pause')updated.paused=b.paused!==false;
   else if(action==='menu-delete'){if(!updated.items.some(i=>i.id===b.item_id))fail(404,'Menu item not found.');updated.items=updated.items.filter(i=>i.id!==b.item_id)}
   else{const existing=b.item?.id?updated.items.find(i=>i.id===b.item.id):null;if(b.item?.id&&!existing)fail(404,'Menu item not found.');if(!existing&&updated.items.length>=60)fail(400,'Pilot menus support up to 60 items.');const item=normalizeItem(b.item||{},existing?.id);item.image=await putImage(item.image);updated.items=existing?updated.items.map(i=>i.id===item.id?item:i):[...updated.items,item]}
   if(updated.status!=='approved')updated.paused=true;await write('REST',updated.id,updated,r.etag);return {restaurant:viewMerchant(updated)};
  }
  if(action==='admin-list'){admin(auth);return {restaurants:(await list('REST')).map(viewMerchant),helpers:(await list('HELP')).map(h=>({id:h.id,name:h.name,active:h.active})),orders:(await list('ORDER')).map(publicOrder)}}
  if(action==='admin-restaurant'){
   admin(auth);if(!['approved','declined','pending'].includes(b.status))fail(400,'Invalid review status.');const rec=await read('REST',b.restaurant_id),r={...rec.data,status:b.status,paused:b.status!=='approved',updated_at:now()};if(b.status==='approved'&&!r.items.length)fail(400,'Add at least one menu item before approval.');await write('REST',r.id,r,rec.etag);return {restaurant:viewMerchant(r)};
  }
  if(action==='admin-helper'){
   admin(auth);if(b.helper_id){const rec=await read('HELP',b.helper_id),h={...rec.data,active:b.active===true};await write('HELP',h.id,h,rec.etag);return {helper:{id:h.id,name:h.name,active:h.active}}}
   const name=clean(b.name,100);if(!name)fail(400,'Enter the approved helper’s name.');const key=token(),h={id:id('HELP'),name,active:true,key_hash:hash(key),created_at:now()};await write('HELP',h.id,h);return {helper:{id:h.id,name,active:true},access_key:key};
  }
  if(action==='quote'){const r=await read('REST',b.restaurant_id);return {...buildQuote(r.data,b),test_only:true}}
  if(action==='order-create'){
   if(b.test_only!==true)fail(503,'Live checkout is not enabled. Only test orders are accepted.');
   if(!checkToken(auth)||!checkToken(b.idempotency_key))fail(400,'A secure customer key and submission key are required.');
   const orderId='ORDER-'+[hash(b.idempotency_key).slice(0,8),hash(b.idempotency_key).slice(8,12),hash(b.idempotency_key).slice(12,16),hash(b.idempotency_key).slice(16,20),hash(b.idempotency_key).slice(20,32)].join('-');
   const prior=await store.getWithMetadata(keyFor('ORDER',orderId),{type:'json',consistency:'strong'});
   if(prior){if(!secureEq(prior.data.customer_key_hash,hash(auth)))fail(409,'Submission key already used.');return {order:publicOrder(prior.data),replayed:true}}
   const r=(await read('REST',b.restaurant_id)).data,q=buildQuote(r,b);
   const customer={name:clean(b.customer?.name,100),phone:clean(b.customer?.phone,40),address:b.fulfillment==='delivery'?clean(b.customer?.address,250):'',zip:b.fulfillment==='delivery'?clean(b.zip,5):'',notes:clean(b.customer?.notes,500)};
   if(!customer.name||!customer.phone||(b.fulfillment==='delivery'&&!customer.address))fail(400,'Enter a test name, phone, and delivery address when needed.');
   const date=now(),o={id:orderId,restaurant_id:r.id,restaurant_name:r.name,customer,customer_key_hash:hash(auth),pickup_address:r.pickup_address,fulfillment:b.fulfillment,...q,status:'submitted',helper_id:null,test_only:true,created_at:date,updated_at:date,timeline:[{status:'submitted',at:date}]};
   try{await write('ORDER',o.id,o)}catch(e){if(e.status!==409)throw e;const rec=await read('ORDER',o.id);if(!secureEq(rec.data.customer_key_hash,hash(auth)))throw e;return {order:publicOrder(rec.data),replayed:true}}
   return {order:publicOrder(o)};
  }
  if(action==='customer-order'){
   const rec=await read('ORDER',b.order_id);if(!checkToken(auth)||!secureEq(rec.data.customer_key_hash,hash(auth)))fail(401,'Customer tracking key required.');return {order:publicOrder(rec.data)};
  }
  if(action==='merchant-orders'){await merchant(b.restaurant_id,auth);return {orders:(await list('ORDER')).filter(o=>o.restaurant_id===b.restaurant_id).map(o=>({...publicOrder(o),customer:{name:o.customer.name,phone:o.customer.phone,notes:o.customer.notes}}))}}
  if(action==='helper-orders'){
   await helper(b.helper_id,auth);return {orders:(await list('ORDER')).filter(o=>o.fulfillment==='delivery'&&((o.status==='ready'&&!o.helper_id)||o.helper_id===b.helper_id)).map(o=>o.helper_id===b.helper_id?{...publicOrder(o),pickup_address:o.pickup_address,customer:o.customer}:{...publicOrder(o),area:o.customer.zip})};
  }
  if(action==='order-status'){
   const rec=await read('ORDER',b.order_id),o=rec.data,next=b.status;let allowed=[];
   if(b.role==='merchant'){await merchant(o.restaurant_id,auth);allowed=o.status==='submitted'?['accepted','declined']:o.status==='accepted'?['preparing','cancelled']:o.status==='preparing'?['ready','cancelled']:o.status==='ready'&&o.fulfillment==='pickup'?['completed','cancelled']:[]}
   else if(b.role==='helper'){await helper(b.helper_id,auth);if(o.fulfillment!=='delivery')fail(409,'Pickup orders do not need a helper.');if(next==='assigned'&&o.status==='ready'&&!o.helper_id){allowed=['assigned']}else if(o.helper_id===b.helper_id){allowed=o.status==='assigned'?['picked_up']:o.status==='picked_up'?['delivered']:[]}}
   else if(b.role==='customer'){if(!checkToken(auth)||!secureEq(hash(auth),o.customer_key_hash))fail(401,'Customer key required.');allowed=o.status==='submitted'?['cancelled']:[]}
   else if(b.role==='admin'){admin(auth);allowed=!['delivered','completed','cancelled','declined'].includes(o.status)?['cancelled']:[]}
   else fail(400,'Choose a valid role.');
   if(!allowed.includes(next))fail(409,'This order cannot move from '+o.status+' to '+next+'.');
   if(next==='delivered'&&!clean(b.confirmation,200))fail(400,'Enter a delivery confirmation note.');
   const date=now(),updated={...o,status:next,updated_at:date,timeline:[...o.timeline,{status:next,at:date}]};
   if(next==='assigned')updated.helper_id=b.helper_id;
   if(next==='delivered')updated.delivery_confirmation=clean(b.confirmation,200);
   await write('ORDER',o.id,updated,rec.etag);return {order:publicOrder(updated)};
  }
  fail(400,'Unsupported marketplace action.');
 };
}
