// Isolated local sandbox only. Never reads production credentials.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const {randomUUID,randomBytes} = require('node:crypto');
const root=path.resolve(__dirname,'../..'),mysql=require(path.join(root,'backend/node_modules/mysql2/promise')),bcrypt=require(path.join(root,'backend/node_modules/bcrypt')),sharp=require(path.join(root,'backend/node_modules/sharp'));
const base='http://127.0.0.1:3328/api'; let checks=0;
async function call(route,{token,body,method='GET',status=200}={}) {
 const multipart=body instanceof FormData;
 const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!multipart?{'Content-Type':'application/json'}:{})},...(body?{body:multipart?body:JSON.stringify(body)}:{})});
 const result=await response.json(); assert.equal(response.status,status,route+': '+JSON.stringify(result).slice(0,200));checks++;return result;
}
async function main(){
 const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades',multipleStatements:true});
 try {
 const [[env]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').includes('/propiedades/tmp/mobile-local/mysql-data'));
 const migration=await fs.readFile(path.join(root,'database/IMAGENES_MENSAJES.sql'),'utf8');await db.query(migration);await db.query(migration); checks++;
 const suffix=Date.now(),password=randomBytes(24).toString('base64url'),hash=await bcrypt.hash(password,10);
 async function account(label){const id=randomUUID(),email=`qa-image-${label}-${suffix}@qa.invalid`;await db.query('INSERT INTO users(id,email,password,firstName,lastName,role) VALUES (?,?,?,?,?,?)',[id,email,hash,'QA '+label,'Images','customer']);return call('/auth/login',{method:'POST',body:{email,password},status:201});}
 const a=await account('sender'),b=await account('recipient'),other=await account('other');
 const chat=await call('/messages/conversations',{token:a.access_token,method:'POST',body:{recipient_id:b.user.id},status:201});
 const token='fcm_qa_message_image_'+suffix;await call('/messages/devices',{token:b.access_token,method:'POST',body:{token},status:201});
 const bytes=await sharp({create:{width:160,height:100,channels:3,background:'#0866f5'}}).jpeg().toBuffer();
 async function image(session){const form=new FormData();form.append('file',new Blob([bytes],{type:'image/jpeg'}),'qa.jpg');return call('/manage/media',{token:session.access_token,method:'POST',body:form,status:201});}
 const media=await image(a),foreign=await image(other);
 const send=(body,status=201)=>call('/messages/conversations/'+chat.id,{token:a.access_token,method:'POST',body,status});
 await send({client_id:randomUUID(),image_id:foreign.id},403);
 await send({client_id:randomUUID(),image_id:randomUUID()},403);
 const body={client_id:randomUUID(),body:'Foto de prueba',image_id:media.id};
 const first=await send(body);assert.equal(first.image.id,media.id);checks++;
 const retry=await send(body);assert.equal(retry.id,first.id);checks++;
 await send({...body,body:'Cambió el texto'},409);
 await send({...body,client_id:randomUUID()},409);
 const history=await call('/messages/conversations/'+chat.id,{token:b.access_token});assert.equal(history.items[0].image.id,media.id);checks++;
 const url=new URL(history.items[0].image.url,'http://127.0.0.1:3328');assert.equal(url.origin,'http://127.0.0.1:3328');
 const file=await fetch(url);assert.equal(file.status,200);assert.match(file.headers.get('content-type'),/image\/webp/);checks++;
 assert.equal((await fetch('http://127.0.0.1:3328/api/media/'+media.id)).status,404);checks++;
 await call('/messages/conversations/'+chat.id,{token:other.access_token,status:404});
 await call('/manage/media/'+media.id,{token:a.access_token,method:'DELETE',status:409});
 const media2=await image(a);const photoOnly=await send({client_id:randomUUID(),image_id:media2.id});assert.equal(photoOnly.body,'');assert.equal(photoOnly.image.id,media2.id);checks++;
 const inbox=await call('/messages/conversations',{token:b.access_token});assert.equal(inbox.items[0].last_message,'📷 Imagen');checks++;
 await call('/messages/conversations/'+chat.id+'/read',{token:b.access_token,method:'POST',body:{last_message_id:photoOnly.id},status:201});
 const {PushService}=require(path.join(root,'backend/dist/estate/push.service'));
 const ids=[String(first.id),String(photoOnly.id)];
 const adapter={query:async(sql,params)=>{const [rows]=await db.query(sql,params);return sql.includes('SELECT CAST(d.message_id')?rows.filter(r=>ids.includes(String(r.message_id))):rows;},createQueryRunner:()=>({connect:async()=>{},release:async()=>{},query:async(sql,params)=>{const [rows]=await db.query(sql,params);return rows;}})};
 const worker=new PushService(adapter,{get:()=>undefined});worker.credentials=()=>({});worker.flushVideoComments=worker.flushSearchMatches=worker.flushVisits=async()=>{};
 const deliveries=[];worker.sendFcm=async(row)=>{deliveries.push(row);return 'sent';};
 await worker.flush();assert.equal(deliveries.length,2);assert.ok(deliveries.every(r=>r.user_id===b.user.id));checks++;
 await worker.flush();assert.equal(deliveries.length,2);checks++;
 const [[count]]=await db.query('SELECT COUNT(*) n FROM estate_direct_messages WHERE conversation_id=?',[chat.id]);assert.equal(Number(count.n),2);checks++;
 console.log(`PASS: ${checks} checks: private image delivery, authorization, repeatable SQL, idempotency, deletion protection and read-before-push race. Production connections: 0.`);
 } finally {await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
