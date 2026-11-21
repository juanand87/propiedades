// Uses only the isolated local mobile sandbox, never production.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../..'), mysql=require(root+'/backend/node_modules/mysql2/promise');
const {DEMO_ADVERTISER_ID}=require(root+'/backend/dist/estate/demo-properties');
let checks=0;
async function call(route,{method='GET',body,token,status=200}={}){const r=await fetch('http://127.0.0.1:3328/api'+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,status,route);checks++;return r.status===404?null:r.json();}
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades'});let video,target;try{
const [[instance]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(instance.p),3327);assert.equal(path.resolve(instance.d).toLowerCase(),path.join(root,'tmp/mobile-local/mysql-data').toLowerCase());
assert.equal((await call('/mobile/environment')).environment,'local-mobile');
const credentials=JSON.parse(await fs.readFile(root+'/tmp/mobile-local/credentials.json','utf8'));const admin=await call('/auth/login',{method:'POST',body:credentials,status:201});const token=admin.access_token;
const [[v]]=await db.query("SELECT v.id,v.status,v.property_id FROM property_videos v JOIN properties p ON p.id=v.property_id WHERE p.advertiser_id=? AND v.status='published' LIMIT 1",[DEMO_ADVERTISER_ID]);assert.ok(v);video=v;
const [[p]]=await db.query("SELECT id,publication_status FROM properties WHERE advertiser_id=? AND id<>? AND publication_status='published' LIMIT 1",[DEMO_ADVERTISER_ID,v.property_id]);assert.ok(p);target=p;
const before=await call('/properties/'+video.property_id+'/videos');assert.ok(before.items.some(x=>x.id===video.id));assert.ok(before.items.every(x=>x.property_id===video.property_id));checks+=2;
await db.query("UPDATE properties SET publication_status='draft' WHERE id=?",[target.id]);
await call('/manage/videos/'+video.id+'/property',{method:'POST',token,body:{property_id:target.id},status:201});
const [[linked]]=await db.query('SELECT status,property_id FROM property_videos WHERE id=?',[video.id]);assert.equal(linked.status,'published');assert.equal(linked.property_id,target.id);checks+=2;
assert.ok(!(await call('/properties/'+video.property_id+'/videos')).items.some(x=>x.id===video.id));
assert.equal((await call('/properties/'+target.id+'/videos')).items.length,0);checks+=2;
await call('/videos/'+video.id+'/content',{status:404});
await db.query("UPDATE properties SET publication_status='published' WHERE id=?",[target.id]);
const published=await call('/properties/'+target.id+'/videos');assert.ok(published.items.some(x=>x.id===video.id));assert.ok(published.items.every(x=>x.property_id===target.id));checks+=2;
await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'draft'}});
assert.ok(!(await call('/properties/'+target.id+'/videos')).items.some(x=>x.id===video.id));checks++;
await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'published'}});
await call('/manage/videos/'+video.id+'/property',{method:'POST',token,body:{property_id:null},status:201});
const [[unlinked]]=await db.query('SELECT status,property_id FROM property_videos WHERE id=?',[video.id]);assert.equal(unlinked.status,'draft');assert.equal(unlinked.property_id,null);checks+=2;
await call('/properties/not-a-uuid/videos',{status:400});
console.log(JSON.stringify({passed:checks,productionChanges:0}));
}finally{if(video)await db.query('UPDATE property_videos SET property_id=?,status=? WHERE id=?',[video.property_id,video.status,video.id]);if(target)await db.query('UPDATE properties SET publication_status=? WHERE id=?',[target.publication_status,target.id]);await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
