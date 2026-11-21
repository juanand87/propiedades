// Local isolated sandbox only. Restores demo properties/videos after checks.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),mysql=require(root+'/backend/node_modules/mysql2/promise');
const {DEMO_ADVERTISER_ID}=require(root+'/backend/dist/estate/demo-properties');
let checks=0;
async function call(route,{method='GET',body,token,status=200}={}){const r=await fetch('http://127.0.0.1:3328/api'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(j).slice(0,100));checks++;return j;}
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades',multipleStatements:true});let sources=[],target,admin;try{
const [[instance]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(instance.p),3327);assert.equal(path.resolve(instance.d).toLowerCase(),path.join(root,'tmp/mobile-local/mysql-data').toLowerCase());assert.equal((await call('/mobile/environment')).environment,'local-mobile');
const migration=await fs.readFile(root+'/database/PUBLICACION_CONJUNTA_VIDEO.sql','utf8');await db.query(migration);await db.query(migration);checks++;
admin=await call('/auth/login',{method:'POST',body:JSON.parse(await fs.readFile(root+'/tmp/mobile-local/credentials.json','utf8')),status:201});const token=admin.access_token;
const [rows]=await db.query("SELECT v.id,v.property_id,v.status FROM property_videos v JOIN properties p ON p.id=v.property_id WHERE p.advertiser_id=? AND v.status='published' LIMIT 3",[DEMO_ADVERTISER_ID]);assert.equal(rows.length,3);sources=rows;
const [[property]]=await db.query("SELECT id,publication_status FROM properties WHERE advertiser_id=? AND publication_status='published' LIMIT 1",[DEMO_ADVERTISER_ID]);assert.ok(property);target=property;
const source=sources[0].id,manual=sources[1].id,hidden=sources[2].id;
async function state(id){const [[r]]=await db.query('SELECT status FROM property_videos WHERE id=?',[id]);return r.status;}
async function intent(id){const [[r]]=await db.query('SELECT COUNT(*) n FROM estate_property_video_publication WHERE video_id=?',[id]);return Number(r.n);}
async function link(id,extra={}){return call('/manage/videos/'+id+'/property',{method:'POST',token,body:{property_id:target.id,...extra},status:201});}
async function propertyStatus(status){return call('/manage/properties/'+target.id+'/status',{method:'PATCH',token,body:{status}});}
await propertyStatus('draft');
for(const id of [source,manual,hidden])await call('/manage/videos/'+id,{method:'PATCH',token,body:{status:'draft'}});
// A draft property and its source video remain private until approval.
await link(source); assert.equal(await state(source),'draft');assert.equal(await intent(source),1);checks+=2;
await propertyStatus('pending_review');assert.equal(await state(source),'draft');assert.equal((await call('/properties/'+target.id+'/videos')).items.length,0);checks+=2;
// A manually selected draft cancels the automatic publication request.
await link(manual);await call('/manage/videos/'+manual,{method:'PATCH',token,body:{status:'draft'}});assert.equal(await intent(manual),0);checks++;
// Moderator-hidden videos must not be published by property approval.
await link(hidden);await db.query("INSERT INTO estate_content_moderation(target_kind,target_id,hidden,moderator_id,note) VALUES ('video',?,1,?,'Local QA') ON DUPLICATE KEY UPDATE hidden=1",[hidden,admin.user.id]);
const approved=await propertyStatus('published');assert.equal(approved.videos_published,1);assert.equal(await state(source),'published');assert.equal(await state(manual),'draft');assert.equal(await state(hidden),'draft');assert.equal(await intent(source),0);checks+=5;
const visible=await call('/properties/'+target.id+'/videos');assert.ok(visible.items.some(v=>v.id===source));assert.ok(!visible.items.some(v=>[manual,hidden].includes(v.id)));checks+=2;
await propertyStatus('published');assert.equal(await state(manual),'draft');checks++;
// New client: approval before explicit linking is safe and needs no second action.
await link(manual,{publish_with_property:true});assert.equal(await state(manual),'published');assert.equal(await intent(manual),0);checks+=2;
// Legacy client: linking after submission still registers an approval intent.
await db.query("DELETE FROM estate_content_moderation WHERE target_kind='video' AND target_id=?",[hidden]);await propertyStatus('draft');await propertyStatus('pending_review');await link(hidden);assert.equal(await state(hidden),'draft');await propertyStatus('published');assert.equal(await state(hidden),'published');checks+=2;
// Unlinking cancels intent; a future approval cannot publish it as standalone.
await propertyStatus('draft');await call('/manage/videos/'+source,{method:'PATCH',token,body:{status:'draft'}});await link(source);await call('/manage/videos/'+source+'/property',{method:'POST',token,body:{property_id:null},status:201});assert.equal(await intent(source),0);await propertyStatus('pending_review');await propertyStatus('published');assert.equal(await state(source),'draft');checks+=2;
await call('/manage/videos/'+source+'/property',{method:'POST',token,body:{property_id:target.id,publish_with_property:'true'},status:400});
console.log(JSON.stringify({passed:checks,productionChanges:0}));
}finally{for(const v of sources){await db.query('DELETE FROM estate_property_video_publication WHERE video_id=?',[v.id]);await db.query("DELETE FROM estate_content_moderation WHERE target_kind='video' AND target_id=?",[v.id]);await db.query('UPDATE property_videos SET property_id=?,status=? WHERE id=?',[v.property_id,v.status,v.id]);}if(target)await db.query('UPDATE properties SET publication_status=? WHERE id=?',[target.publication_status,target.id]);await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
