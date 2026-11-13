// Only the isolated mobile sandbox; all accounts and messages are QA local.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),mysql=require(path.join(root,'backend/node_modules/mysql2/promise'));
const base='http://127.0.0.1:3328/api';let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function call(route,{token,method='GET',body,status=200}={}){const form=body instanceof FormData,r=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(value).slice(0,250));checks++;return value;}
async function main(){const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades',multipleStatements:true});try{
 const [[env]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
 const migration=await fs.readFile(path.join(root,'database/MODERACION_Y_BLOQUEOS.sql'),'utf8');await db.query(migration);await db.query(migration);
 const suffix=Date.now(),password=randomBytes(24).toString('base64url');async function user(name){return call('/auth/register',{method:'POST',status:201,body:{email:`qa-mod-${name}-${suffix}@qa.invalid`,password,firstName:'QA '+name,lastName:'Local'}});}
 const a=await user('A'),b=await user('B'),c=await user('C');const credentials=JSON.parse(await fs.readFile(path.join(root,'tmp/mobile-local/credentials.json'),'utf8'));const administrator=await call('/auth/login',{method:'POST',status:201,body:credentials}),admin=administrator.access_token;
 const clip=await fs.readFile(path.join(root,'tmp/mobile-local/example-0.mp4'));async function video(session,published=true){const form=new FormData();form.append('file',new Blob([clip],{type:'video/mp4'}),'qa.mp4');form.append('title','QA Moderación '+suffix);form.append('request_id',randomUUID());if(published)form.append('publish','true');return call('/manage/videos',{token:session.access_token,method:'POST',status:201,body:form});}
 const va=await video(a),vb=await video(b),vc=await video(c),draft=await video(a,false);
 async function comment(session,vid,text){const rows=await call('/videos/'+vid.id+'/comments',{method:'POST',status:201,token:session.access_token,body:{body:text}});return rows.find(row=>row.body===text);}
 const ca=await comment(a,vc,'QA comentario A '+suffix),cb=await comment(b,vc,'QA comentario B '+suffix);await comment(b,va,'QA actividad B '+suffix);
 const chat=await call('/messages/conversations',{method:'POST',status:201,token:a.access_token,body:{recipient_id:b.user.id}});
 await call('/messages/conversations/'+chat.id,{method:'POST',status:201,token:a.access_token,body:{client_id:randomUUID(),body:'QA antes del bloqueo'}});
 await call('/video-profiles/'+a.user.id+'/follow',{method:'POST',status:201,token:b.access_token,body:{active:true}});
 await call('/videos/'+va.id+'/save',{method:'POST',status:201,token:b.access_token,body:{active:true}});
 await call('/me/blocks/'+a.user.id,{method:'POST',status:201,token:b.access_token,body:{active:true}});
 for(const [viewer,hidden] of [[b,va],[a,vb]])check(!(await call('/videos?video_id='+hidden.id,{token:viewer.access_token})).items.length,'Mutual block filters both feeds');
 await call('/video-profiles/'+a.user.id,{token:b.access_token,status:403});
 await call('/videos/'+va.id+'/comments',{method:'POST',status:403,token:b.access_token,body:{body:'No permitido'}});
 await call('/video-profiles/'+a.user.id+'/follow',{method:'POST',status:403,token:b.access_token,body:{active:true}});
 await call('/messages/conversations',{method:'POST',status:403,token:b.access_token,body:{recipient_id:a.user.id}});
 for(const session of [a,b])await call('/messages/conversations/'+chat.id,{method:'POST',status:403,token:session.access_token,body:{client_id:randomUUID(),body:'No permitido'}});
 check((await call('/messages/conversations/'+chat.id,{token:b.access_token})).participant.available===false,'Existing chat is read-only');
 check(!(await call('/messages/conversations',{token:b.access_token})).items.some(row=>row.id===chat.id),'Blocked conversation hidden in inbox');
 const comments=await call('/videos/'+vc.id+'/comments',{token:b.access_token});check(!comments.some(row=>row.id===ca.id)&&comments.some(row=>row.id===cb.id),'Other video comments filter blocked author only');
 check(!(await call('/video-profiles/'+b.user.id+'/videos?saved=true',{token:b.access_token})).items.some(row=>row.id===va.id),'Saved gallery excludes blocked author');
 check(!(await call('/me/activity',{token:a.access_token})).items.some(row=>row.actor_id===b.user.id),'Activity excludes blocked author');
 check((await call('/videos?video_id='+va.id,{token:c.access_token})).items.length===1,'Personal block does not hide video from third user');
 await call('/me/blocks/'+b.user.id,{method:'POST',status:400,token:b.access_token,body:{active:true}});
 check((await call('/me/blocks',{token:b.access_token})).items.some(row=>row.id===a.user.id),'Block list persists');
 await call('/me/blocks/'+a.user.id,{method:'POST',status:201,token:b.access_token,body:{active:false}});check((await call('/videos?video_id='+va.id,{token:b.access_token})).items.length===1,'Unblock restores visibility');
 const report=await call('/reports',{method:'POST',status:201,token:b.access_token,body:{kind:'video',target_id:va.id,reason:'scam',details:'QA review'}});
 check((await call('/reports',{method:'POST',status:201,token:b.access_token,body:{kind:'video',target_id:va.id,reason:'scam'}})).id===report.id,'Duplicate report is idempotent');
 await call('/reports',{method:'POST',status:404,token:b.access_token,body:{kind:'video',target_id:draft.id,reason:'spam'}});
 await call('/admin/moderation/reports',{token:b.access_token,status:403});await call('/admin/moderation/reports/'+report.id,{method:'PATCH',status:403,token:b.access_token,body:{action:'hide',note:'Unauthorized'}});
 check((await call('/videos?video_id='+va.id)).items.length===1,'Reports do not automatically hide content');
 const detail=await call('/admin/moderation/reports/'+report.id,{token:admin});check(detail.snapshot.title===va.title&&!!detail.preview?.url,'Admin receives evidence and private preview');
 await call('/admin/moderation/reports/'+report.id,{method:'PATCH',token:admin,body:{action:'hide',note:'QA infracción confirmada'}});
 check(!(await call('/videos?video_id='+va.id)).items.length,'Hidden video removed from public feed');
 check((await call('/videos/'+va.id+'/social',{token:a.access_token})).moderation_hidden===true,'Owner sees moderation state');
 const content=await fetch(base+'/videos/'+va.id+'/content');check(content.status===404,'Hidden MP4 denied');const hls=await fetch(base+'/videos/'+va.id+'/hls/master.m3u8');check(hls.status===404,'Hidden HLS denied');
 await call('/manage/videos/'+va.id,{method:'PATCH',status:403,token:a.access_token,body:{status:'published'}});
 await call('/admin/moderation/reports/'+report.id,{method:'PATCH',status:409,token:admin,body:{action:'dismiss',note:'Revisión duplicada'}});
 await call('/admin/moderation/restore/video/'+va.id,{method:'POST',status:201,token:admin,body:{note:'QA apelación aceptada'}});check((await call('/videos?video_id='+va.id)).items.length===1,'Restore makes an otherwise published video visible');
 const commentReport=await call('/reports',{method:'POST',status:201,token:c.access_token,body:{kind:'comment',target_id:ca.id,reason:'harassment'}});await call('/admin/moderation/reports/'+commentReport.id,{method:'PATCH',token:admin,body:{action:'hide',note:'QA ocultar comentario'}});
 check(!(await call('/videos/'+vc.id+'/comments')).some(row=>row.id===ca.id),'Hidden comment absent from list');await call('/videos/'+vc.id+'/comments?comment_id='+ca.id,{status:404});
 await call('/admin/moderation/restore/comment/'+ca.id,{method:'POST',status:201,token:admin,body:{note:'QA restaurar comentario'}});
 const userReport=await call('/reports',{method:'POST',status:201,token:c.access_token,body:{kind:'user',target_id:a.user.id,reason:'scam'}});await call('/admin/moderation/reports/'+userReport.id,{method:'PATCH',token:admin,body:{action:'suspend',note:'QA suspender cuenta'}});
 await call('/auth/profile',{token:a.access_token,status:401});check(!(await call('/videos?video_id='+va.id)).items.length,'Suspended author content hidden');
 await call('/admin/moderation/restore/user/'+a.user.id,{method:'POST',status:201,token:admin,body:{note:'QA reactivar cuenta'}});await call('/auth/profile',{token:a.access_token});
 const adminReport=await call('/reports',{method:'POST',status:201,token:c.access_token,body:{kind:'user',target_id:administrator.user.id,reason:'other'}});await call('/admin/moderation/reports/'+adminReport.id,{method:'PATCH',status:403,token:admin,body:{action:'suspend',note:'No debe permitir'}});
 await call('/admin/moderation/reports/'+adminReport.id,{method:'PATCH',token:admin,body:{action:'dismiss',note:'QA descartar reporte'}});
 const history=await call('/admin/moderation/reports/'+report.id,{token:admin});check(history.actions.some(row=>row.action==='hide')&&history.actions.some(row=>row.action==='restore'),'Audit preserves moderator decisions and restores');await db.query(migration);check((await call('/admin/moderation/reports/'+report.id,{token:admin})).status==='resolved','Repeating migration preserves review');
 console.log(`PASS: ${checks} moderation/block API checks. Local QA only; production connections: 0.`);
}finally{await db.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
