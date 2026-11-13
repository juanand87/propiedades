// Isolated local integration tests. Never connect to production.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID,randomBytes} = require('node:crypto');
const root=path.resolve(__dirname,'../..');
const mysql=require(path.join(root,'backend/node_modules/mysql2/promise'));
const base='http://127.0.0.1:3328/api';
let checks=0;
function check(value,message){assert.ok(value,message); checks++;}
async function call(route,{token,method='GET',body,status=200}={}) {
  const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const value=await response.json();assert.equal(response.status,status,route+': '+JSON.stringify(value).slice(0,200)); checks++; return value;
}
async function main(){
  const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades',multipleStatements:true});
  try {
    const [[env]]=await db.query('SELECT @@port p,@@datadir d');
    assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
    const migration=await fs.readFile(path.join(root,'database/ACTIVIDAD_PROPPIX.sql'),'utf8');
    await db.query(migration);await db.query(migration);
    const qa=JSON.parse(await fs.readFile(path.join(root,'tmp/mobile-local/social-qa.json'),'utf8'));
    const login=await call('/auth/login',{method:'POST',status:201,body:{email:qa.email,password:qa.password}}),token=login.access_token;
    const other=await call('/auth/register',{method:'POST',status:201,body:{email:`qa-activity-${Date.now()}@qa.invalid`,password:randomBytes(24).toString('base64url'),firstName:'QA Activity',lastName:'Local'}});
    await call('/me/activity',{status:401});
    await call('/me/activity?before=bad',{token,status:400});
    const route='/videos/'+qa.videoId+'/comments';
    await db.query('DELETE FROM estate_push_devices WHERE user_id=?',[qa.userId]);
    const suffix=randomUUID();
    const comments=await call(route,{method:'POST',status:201,token,body:{body:'Activity own '+suffix}});
    const parent=comments.find(c=>c.body==='Activity own '+suffix);
    const first=await call('/me/activity?limit=1',{token});
    check(first.items.length===1&&first.items[0].comment_id===parent.id&&!first.items[0].read_at,'New own comment is unread even without relying on push delivery');
    const firstId=first.items[0].id;
    await call('/me/activity/'+firstId+'/read',{method:'POST',status:404,token:other.access_token});
    await call('/me/activity/'+firstId+'/read',{method:'POST',status:201,token});
    await call('/me/activity/'+firstId+'/read',{method:'POST',status:201,token});
    check((await call('/me/activity',{token})).items.find(x=>x.id===firstId).read_at,'Read state persists and is idempotent');
    await call(route,{method:'POST',status:201,token,body:{body:'Activity reply '+suffix,parent_id:parent.id}});
    const replyPage=await call('/me/activity?limit=1',{token});
    check(replyPage.items[0].kind==='reply'&&replyPage.items[0].body==='Activity reply '+suffix,'Reply to own comment is one reply event');
    const [[dedup]]=await db.query('SELECT COUNT(*) n FROM estate_activity WHERE user_id=? AND comment_id=?',[qa.userId,replyPage.items[0].comment_id]);
    check(Number(dedup.n)===1,'Owner and parent recipient deduplicated');
    check(!!replyPage.next_cursor,'Pagination exposes next cursor');
    const older=await call('/me/activity?limit=1&before='+replyPage.next_cursor,{token});
    check(older.items.length===1&&older.items[0].id===firstId,'Cursor does not repeat newest item');
    const snapshot=replyPage.items[0].id;
    await call(route,{method:'POST',status:201,token,body:{body:'Activity later '+suffix}});
    await call('/me/activity/read-all',{method:'POST',status:201,token,body:{through_id:snapshot}});
    const unread=await call('/me/activity?unread=true',{token});
    check(unread.items.some(x=>x.body==='Activity later '+suffix)&&!unread.items.some(x=>x.id===snapshot),'Mark all does not consume activity created after the displayed snapshot');
    const latest=unread.items.find(x=>x.body==='Activity later '+suffix);
    await db.query(migration);
    check((await call('/me/activity?unread=true',{token})).items.some(x=>x.id===latest.id),'Repeating migration preserves unread events');
    await call('/me/activity/comments/'+latest.comment_id+'/read',{method:'POST',status:201,token:other.access_token});
    check((await call('/me/activity?unread=true',{token})).items.some(x=>x.id===latest.id),'Another account cannot mark own comment activity read');
    await call('/me/activity/comments/'+latest.comment_id+'/read',{method:'POST',status:201,token});
    check(!(await call('/me/activity?unread=true',{token})).items.some(x=>x.id===latest.id),'Tapping push can mark its matching activity read');
    check(!(await call('/me/activity',{token:other.access_token})).items.some(x=>x.comment_id===parent.id),'Inbox does not leak another account activity');
    await call('/me/activity/read-all',{method:'POST',status:400,token,body:{through_id:'bad'}});
    const foreignComments=await call(route,{method:'POST',status:201,token:other.access_token,body:{body:'Activity foreign parent '+suffix}});
    const foreignParent=foreignComments.find(c=>c.body==='Activity foreign parent '+suffix);
    await call(route,{method:'POST',status:201,token,body:{body:'Activity foreign reply '+suffix,parent_id:foreignParent.id}});
    check((await call('/me/activity',{token:other.access_token})).items.some(x=>x.body==='Activity foreign reply '+suffix),'Original commenter receives a reply without a registered device');
    try {
      await db.query("UPDATE property_videos SET status='draft' WHERE id=?",[qa.videoId]);
      check(!(await call('/me/activity',{token:other.access_token})).items.some(x=>x.video_id===qa.videoId),'Inbox hides a video that became private');
      check((await call('/me/activity',{token})).items.some(x=>x.video_id===qa.videoId),'Owner retains activity on their own draft');
    } finally {await db.query("UPDATE property_videos SET status='published' WHERE id=?",[qa.videoId]);}
    console.log(`PASS: ${checks} activity checks. Local DB only; production connections: 0.`);
  } finally {await db.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
