// Integration checks against the isolated local mobile DB only. Never production.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const mysql = require(path.join(root, 'backend/node_modules/mysql2/promise'));
const base = 'http://127.0.0.1:3328/api';
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
async function call(route, { token, body, method = 'GET', status = 200 } = {}) {
  const r = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  const raw = await r.text(); let result; try { result = JSON.parse(raw); } catch { result = raw; }
  assert.equal(r.status, status, `${route}: ${raw.slice(0, 300)}`); checks++;
  return result;
}
async function main() {
  const db = await mysql.createConnection({ host: '127.0.0.1', port: 3327, user: 'root', database: 'propiedades', multipleStatements: true });
  try {
    const [[server]] = await db.query('SELECT @@datadir d,@@port p');
    assert.equal(Number(server.p), 3327);
    assert.ok(server.d.replaceAll('\\', '/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
    const [before] = await db.query('SELECT id,property_id,created_by FROM property_videos ORDER BY id');
    for (let i=0;i<2;i++) await db.query(await fs.readFile(path.join(root,'database/PERFILES_Y_VIDEOS_SOCIALES.sql'),'utf8'));
    for (let i=0;i<2;i++) await db.query(await fs.readFile(path.join(root,'database/NOTIFICACIONES_Y_PORTADAS.sql'),'utf8'));
    for (let i=0;i<2;i++) await db.query(await fs.readFile(path.join(root,'database/NOTIFICACIONES_COMENTARIOS.sql'),'utf8'));
    const [after] = await db.query('SELECT id,property_id,created_by FROM property_videos ORDER BY id');
    assert.deepEqual(after,before); checks++;
  } finally { await db.end(); }
  check((await call('/mobile/environment')).environment==='local-mobile','Only local environment');
  check((await call('/videos/capabilities')).social===true,'Social feature enabled');
  const suffix = Date.now(), password = randomBytes(24).toString('base64url');
  async function register(kind) {
    return call('/auth/register',{method:'POST',status:201,body:{email:`qa-social-${kind}-${suffix}@qa.invalid`,password,firstName:`QA Social ${kind}`,lastName:'Local'}});
  }
  const a = await register('A'), b = await register('B'), token=a.access_token, viewer=b.access_token;
  const tokenA='fcm_local_social_owner_0123456789', tokenB='fcm_local_social_parent_0123456789';
  await call('/messages/devices',{method:'POST',status:201,token,body:{token:tokenA}});
  await call('/messages/devices',{method:'POST',status:201,token:viewer,body:{token:tokenB}});
  await call('/me/account-type',{method:'POST',status:201,token,body:{account_type:'seller'}});
  const property = await call('/manage/properties',{method:'POST',status:201,token,body:{title:'Propiedad QA social local',type_id:'house'}});
  const foreign = await call('/manage/properties/'+property.id,{token:viewer,status:403});
  check(!!foreign.message,'Property ownership enforced');
  const clip = await fs.readFile(path.join(root,'tmp/mobile-local/example-0.mp4'));
  const requestId=randomUUID();
  function form(){const f=new FormData();f.append('file',new Blob([clip],{type:'video/mp4'}),'social.mp4');f.append('title','Historia QA sin propiedad');f.append('request_id',requestId);return f;}
  const video=await call('/manage/videos',{method:'POST',status:201,token,body:form()});
  check(video.property_id===null && video.status==='draft','Standalone draft saved');
  const again=await call('/manage/videos',{method:'POST',status:201,token,body:form()});
  check(again.id===video.id,'Upload retries do not duplicate');
  const route='/videos/'+video.id;
  await call(route+'/social',{status:404});
  await call(route+'/social',{token:viewer,status:404});
  const gallery=await call(`/video-profiles/${a.user.id}/videos`,{token});
  check(gallery.items.some(x=>x.id===video.id),'Own gallery includes drafts');
  check((await call(`/video-profiles/${a.user.id}/videos`)).items.length===0,'Public gallery excludes drafts');
  await call('/manage/videos/'+video.id+'/preview',{token:viewer,status:403});
  const preview=await call('/manage/videos/'+video.id+'/preview',{token});
  const bytes=await fetch('http://127.0.0.1:3328'+preview.url,{headers:{Range:'bytes=0-99'}});
  check(bytes.status===206&&(await bytes.arrayBuffer()).byteLength===100,'Private Range preview');
  await call(route+'/thumbnail',{status:404});
  const thumbnail = await fetch('http://127.0.0.1:3328'+preview.thumbnail_url);
  check(thumbnail.status===200 && thumbnail.headers.get('content-type').startsWith('image/jpeg'),'Draft poster requires signed access');
  const metadata = await require(path.join(root,'backend/node_modules/sharp'))(Buffer.from(await thumbnail.arrayBuffer())).metadata();
  check(metadata.width<=480 && metadata.height<=640,'Poster is a compact image');
  await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'published'}});
  const feed=await call('/videos?video_id='+video.id);
  check(feed.items.length===1&&feed.items[0].property===null,'Published video does not need a property');
  const publicPoster = await fetch('http://127.0.0.1:3328'+feed.items[0].thumbnail_url);
  check(publicPoster.status===200,'Published poster is available');
  const seed=randomUUID();
  const seededA=await call('/videos?limit=2&seed='+seed),seededB=await call('/videos?limit=2&seed='+seed),seededNext=await call('/videos?limit=2&page=2&seed='+seed);
  check(JSON.stringify(seededA.items.map(x=>x.id))===JSON.stringify(seededB.items.map(x=>x.id)),'Seeded order remains stable across retries');
  check(!seededNext.items.some(x=>seededA.items.some(y=>x.id===y.id)),'Seeded pages do not repeat videos');
  const posterDb = await mysql.createConnection({ host: '127.0.0.1', port: 3327, user: 'root', database: 'propiedades' });
  try {const [[env]]=await posterDb.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').includes('/propiedades/tmp/mobile-local/mysql-data'));await posterDb.query('DELETE FROM property_video_posters WHERE video_id=?',[video.id]);}finally{await posterDb.end();}
  check((await fetch('http://127.0.0.1:3328'+feed.items[0].thumbnail_url)).status===200,'Legacy poster generated once from existing video');
  await call(route+'/like',{method:'POST',status:401,body:{active:true}});
  for(let i=0;i<2;i++)await call(route+'/like',{method:'POST',status:201,token:viewer,body:{active:true}});
  check((await call(route+'/social',{token:viewer})).likes===1,'Likes are idempotent');
  await call(route+'/save',{method:'POST',status:201,token:viewer,body:{active:true}});
  check((await call(`/video-profiles/${b.user.id}/videos?saved=true`,{token:viewer})).items[0].id===video.id,'Saved gallery persists');
  for(let i=0;i<2;i++)await call(`/video-profiles/${a.user.id}/follow`,{method:'POST',status:201,token:viewer,body:{active:true}});
  const profile=await call(`/video-profiles/${a.user.id}`,{token:viewer});
  check(profile.followers===1&&profile.likes===1&&profile.followed,'Real follower and like counters');
  check((await call(`/video-profiles/${b.user.id}`)).following===1,'Real following counter');
  await call(`/video-profiles/${a.user.id}/follow`,{method:'POST',status:400,token,body:{active:true}});
  await call(route+'/comments',{method:'POST',status:201,token:viewer,body:{body:'Comentario de prueba local'}});
  check((await call(route+'/comments'))[0].body==='Comentario de prueba local','Comments persist');
  const parent=(await call(route+'/comments'))[0];
  const ownComments=await call(route+'/comments',{method:'POST',status:201,token,body:{body:'Comentario propio para aviso'}});
  const ownComment=ownComments.find(c=>c.body==='Comentario propio para aviso');
  const replies=await call(route+'/comments',{method:'POST',status:201,token,body:{body:'Respuesta QA para dos destinatarios',parent_id:parent.id}});
  const replyEvent=replies.find(c=>c.body==='Respuesta QA para dos destinatarios');
  const sameRecipient=await call(route+'/comments',{method:'POST',status:201,token,body:{body:'Respuesta al comentario propio',parent_id:ownComment.id}});
  const dedupEvent=sameRecipient.find(c=>c.body==='Respuesta al comentario propio');
  await call(route+'/comments',{method:'POST',status:404,token,body:{body:'Padre inexistente',parent_id:randomUUID()}});
  const noticeDb=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades'});
  try {
    const [[sandbox]]=await noticeDb.query('SELECT @@datadir d,@@port p');assert.equal(Number(sandbox.p),3327);assert.ok(sandbox.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
    const [ownNotices]=await noticeDb.query('SELECT user_id,kind FROM estate_video_push_deliveries WHERE comment_id=?',[ownComment.id]);
    check(ownNotices.length===1&&ownNotices[0].user_id===a.user.id&&ownNotices[0].kind==='comment','Own comments enqueue an owner notification');
    const [replyNotices]=await noticeDb.query('SELECT user_id,kind FROM estate_video_push_deliveries WHERE comment_id=?',[replyEvent.id]);
    check(replyNotices.length===2&&replyNotices.some(n=>n.user_id===a.user.id&&n.kind==='comment')&&replyNotices.some(n=>n.user_id===b.user.id&&n.kind==='reply'),'Reply enqueues owner and original commenter');
    const [dedupNotices]=await noticeDb.query('SELECT user_id,kind FROM estate_video_push_deliveries WHERE comment_id=?',[dedupEvent.id]);
    check(dedupNotices.length===1&&dedupNotices[0].user_id===a.user.id&&dedupNotices[0].kind==='reply','Same owner and parent receives one reply notification');
    await noticeDb.query(await fs.readFile(path.join(root,'database/NOTIFICACIONES_COMENTARIOS.sql'),'utf8'));
    const [[preserved]]=await noticeDb.query('SELECT COUNT(*) n FROM estate_video_push_deliveries WHERE comment_id=?',[replyEvent.id]);
    check(Number(preserved.n)===2,'Repeating migration preserves queued notifications');
  }finally{await noticeDb.end();}
  await call(route+'/comments',{method:'POST',status:400,token:viewer,body:{body:' '}});
  await call('/manage/videos/'+video.id,{method:'PATCH',token:viewer,status:403,body:{title:'No permitido'}});
  await call('/manage/videos/'+video.id+'/property',{method:'POST',status:403,token:viewer,body:{property_id:property.id}});
  await call('/manage/videos/'+video.id+'/property',{method:'POST',status:201,token,body:{property_id:property.id}});
  const linked=await call(route+'/social',{token});
  check(linked.property_id===property.id&&linked.status==='draft','Linking is optional and resets to draft');
  await call('/manage/videos/'+video.id,{method:'PATCH',status:400,token,body:{status:'published'}});
  await call('/manage/videos/'+video.id+'/property',{method:'POST',status:201,token,body:{property_id:null}});
  await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{title:'Historia QA editada',status:'published'}});
  check((await call(route+'/social')).title==='Historia QA editada','Edit and standalone publication persist');
  const photo=new FormData();photo.append('file',new Blob([await fs.readFile(path.join(root,'tmp/mobile-local/example-0.webp'))],{type:'image/webp'}),'avatar.webp');
  const media=await call('/manage/media',{method:'POST',status:201,token,body:photo});
  const saved=await call('/me/video-profile',{method:'POST',status:201,token,body:{display_name:'Perfil QA Social',avatar_media_id:media.id}});
  check(saved.display_name==='Perfil QA Social'&&!!saved.avatar_url,'Name and profile picture persist');
  await call('/me/video-profile',{method:'POST',status:403,token:viewer,body:{avatar_media_id:media.id}});
  const avatar=await fetch('http://127.0.0.1:3328'+saved.avatar_url);
  check(avatar.status===200&&avatar.headers.get('content-type').startsWith('image/'),'Selected profile image is readable');
  await call(route+'/like',{method:'POST',status:201,token:viewer,body:{active:false}});
  check((await call(route+'/social',{token:viewer})).likes===0,'Unlike persists');
  // Leave a published local example for the Android gallery and record test-only access locally.
  await fs.writeFile(path.join(root,'tmp/mobile-local/social-qa.json'),JSON.stringify({email:`qa-social-A-${suffix}@qa.invalid`,password,token,userId:a.user.id,videoId:video.id,propertyId:property.id}));
  console.log(`PASS: ${checks} social video checks. Local DB only; production connections: 0.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
