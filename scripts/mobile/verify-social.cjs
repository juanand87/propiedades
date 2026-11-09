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
  await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'published'}});
  const feed=await call('/videos?video_id='+video.id);
  check(feed.items.length===1&&feed.items[0].property===null,'Published video does not need a property');
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
