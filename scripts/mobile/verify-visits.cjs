// Only the isolated mobile sandbox. Never accepts a remote database or API.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),mysql=require(path.join(root,'backend/node_modules/mysql2/promise')),bcrypt=require(path.join(root,'backend/node_modules/bcrypt'));
const base='http://127.0.0.1:3328/api';let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function call(route,{token,method='GET',body,status=200}={}){const r=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(value).slice(0,350));checks++;return value;}
async function main(){const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades',multipleStatements:true});try{
  const [[env]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
  const sql=await fs.readFile(path.join(root,'database/AGENDA_VISITAS.sql'),'utf8');await db.query(sql);await db.query(sql);
  const suffix=Date.now(),password=randomBytes(24).toString('base64url'),hash=await bcrypt.hash(password,10);
  async function user(name,role='customer'){const id=randomUUID(),email=`qa-visit-${name}-${suffix}@qa.invalid`;await db.query('INSERT INTO users(id,email,password,firstName,lastName,role) VALUES (?,?,?,?,?,?)',[id,email,hash,'QA '+name,'Visitas',role]);return call('/auth/login',{method:'POST',status:201,body:{email,password}});}
  const buyer=await user('buyer'),seller=await user('seller','vendor'),other=await user('other');
  const advertiser=randomUUID();await db.query("INSERT INTO advertisers(id,user_id,slug,display_name,status) VALUES (?,?,?,?,'approved')",[advertiser,seller.user.id,'qa-visit-'+suffix,'QA Visitas']);
  async function property(n){const id=randomUUID();await db.query("INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,description,publication_status,published_at) VALUES (?,?,?,?,?,?,?,'published',UTC_TIMESTAMP())",[id,advertiser,seller.user.id,('V'+suffix+n).slice(0,20),'qa-visits-'+suffix+'-'+n,'QA casa '+n,'Prueba de agenda']);return id;}
  const p=await property(1),p2=await property(2);
  const credentials=JSON.parse(await fs.readFile(path.join(root,'tmp/mobile-local/credentials.json'),'utf8'));const administrator=await call('/auth/login',{method:'POST',status:201,body:credentials});
  function parts(instant){const a=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(p=>[p.type,p.value]));return {date:`${a.year}-${a.month}-${a.day}`,time:`${a.hour}:${a.minute}`};}
  const time=parts(new Date(Date.now()+3*86400000)),later=parts(new Date(Date.now()+4*86400000));
  const body={property_id:p,request_id:randomUUID(),...time,note:'QA coordinar visita',consent:true};
  const create=(session,b=body,status=201)=>call('/me/visits',{method:'POST',token:session.access_token,body:b,status});
  const act=(session,v,action,extra={},status=200)=>call('/me/visits/'+v.id,{method:'PATCH',token:session.access_token,body:{action,version:v.version,...extra},status});
  check((await call('/visits/capabilities')).enabled,'Migration ready');
  await call('/me/visits',{status:401});await call('/admin/visits',{token:buyer.access_token,status:403});
  await create(buyer,{...body,consent:false},400);await create(seller,{...body,request_id:randomUUID()},400);
  await create(buyer,{...body,date:'2026-02-30'},400);
  let v=await create(buyer);check(v.state==='requested'&&v.allowed_actions.includes('cancel')&&!v.allowed_actions.includes('accept'),'Buyer cannot accept own request');
  check((await create(buyer)).id===v.id,'Retry is idempotent');await create(buyer,{...body,note:'different'},409);
  await call('/me/visits/'+v.id,{token:other.access_token,status:404});await act(buyer,v,'accept',{},400);await act(administrator,v,'accept',{},403);
  const history=await call('/messages/conversations/'+v.conversation_id,{token:seller.access_token});check(history.items.some(m=>m.visit_id===v.id),'Chat links visit event');
  const inquiries=await call('/manage/inquiries',{token:seller.access_token}),inquiry=inquiries.find(i=>i.booking_id===v.id);check(inquiry?.name.includes('buyer'),'Inquiry retains verified buyer contact');
  await call('/manage/inquiries/'+inquiry.id,{method:'PATCH',token:seller.access_token,body:{visit_status:'confirmed'},status:400});
  v=await act(seller,v,'propose',{...later,note:'Otro horario'});check(v.state==='proposed'&&v.version===2,'Seller can counterpropose');await act(seller,v,'accept',{},400);
  const stale={...v};v=await act(buyer,v,'accept');check(v.state==='confirmed'&&v.version===3,'Buyer confirms counterproposal');await act(seller,stale,'cancel',{},409);
  await act(seller,v,'complete',{},400);
  const [[notices]]=await db.query("SELECT COUNT(*) n FROM estate_visit_notices WHERE booking_id=? AND version=? AND kind IN ('reminder24','reminder1') AND expanded=0",[v.id,v.version]);check(notices.n===4,'Both parties have durable 24h and 1h reminders');
  const [[obsolete]]=await db.query('SELECT COUNT(*) n FROM estate_visit_notices WHERE booking_id=? AND version<? AND expanded=0',[v.id,v.version]);check(obsolete.n===0,'Old notices invalidated');
  await create(other,{...body,property_id:p2,request_id:randomUUID(),...later},409);
  v=await act(buyer,v,'cancel');check(v.state==='cancelled','Buyer can cancel confirmed visit');await act(seller,v,'accept',{},400);
  const [[cancelled]]=await db.query("SELECT COUNT(*) n FROM estate_visit_notices WHERE booking_id=? AND kind IN ('reminder24','reminder1') AND expanded=0",[v.id]);check(cancelled.n===0,'Cancelled visit no longer has active reminders');
  const b1=await create(buyer,{...body,request_id:randomUUID(),...later}),b2=await create(other,{...body,request_id:randomUUID(),...later});
  const racing=await Promise.all([b1,b2].map(async b=>{const r=await fetch(base+'/me/visits/'+b.id,{method:'PATCH',headers:{Authorization:'Bearer '+seller.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'accept',version:b.version})});return r.status;}));check(racing.sort().join(',')==='200,409','Concurrent overlapping confirmations cannot both win');
  const rows=(await call('/me/visits',{token:seller.access_token})).items;check(rows.some(r=>r.id===b1.id)&&rows.some(r=>r.id===b2.id),'Seller sees both requests');check((await call('/me/visits?conversation_id='+b1.conversation_id,{token:buyer.access_token})).items.every(r=>r.conversation_id===b1.conversation_id),'Chat filter stays within own visits');
  let pending=rows.find(r=>r.state==='requested'&&[b1.id,b2.id].includes(r.id));await db.query("UPDATE properties SET availability='sold' WHERE id=?",[p]);
  const unavailable=await call('/me/visits/'+pending.id,{token:seller.access_token});check(!unavailable.property_available&&!unavailable.allowed_actions.includes('accept'),'Unavailable property cannot be confirmed');await act(seller,pending,'accept',{},400);await act(seller,pending,'cancel');
  await db.query("UPDATE properties SET availability='available' WHERE id=?",[p]);
  for(const row of rows.filter(r=>r.state==='confirmed'))await act(seller,row,'cancel');
  await call('/me/blocks/'+buyer.user.id,{method:'POST',status:201,token:seller.access_token,body:{active:true}});await create(buyer,{...body,request_id:randomUUID(),...time},403);
  await call('/me/blocks/'+buyer.user.id,{method:'POST',status:201,token:seller.access_token,body:{active:false}});
  let rejected=await create(buyer,{...body,request_id:randomUUID(),...time});rejected=await act(seller,rejected,'reject');check(rejected.state==='rejected','Seller can reject');
  let adminCancelled=await create(buyer,{...body,request_id:randomUUID(),...time});adminCancelled=await act(administrator,adminCancelled,'cancel');check(adminCancelled.state==='cancelled','Admin cancellation is audited');
  check((await call('/admin/visits',{token:administrator.access_token})).items.length>0,'Admin agenda is accessible');
  // Run the real outbox SQL against QA, replacing only the external Firebase send.
  const {PushService}=require(path.join(root,'backend/dist/estate/push.service'));
  const adapter={query:async(sql,params)=>{const [rows]=await db.query(sql,params);return rows;},transaction:async fn=>{await db.beginTransaction();try{const result=await fn(adapter);await db.commit();return result;}catch(e){await db.rollback();throw e;}}};
  const worker=new PushService(adapter,{get:()=>undefined});const sent=[];
  worker.sendFcm=async(row,_test,_activity,_property,visit)=>{sent.push({row,visit});return 'sent';};
  for(const u of [buyer,seller,other])await db.query('INSERT INTO estate_push_devices(token,user_id) VALUES (?,?)',['fcm_qa_visits_'+suffix+'_'+u.user.id,u.user.id]);
  await worker.flushVisits();check(sent.length>0&&sent.every(s=>s.visit?.id),'Outbox expands devices and sends visit deep links');
  const [[sentOld]]=await db.query("SELECT COUNT(*) n FROM estate_visit_push d JOIN estate_visit_notices n ON n.id=d.notice_id JOIN estate_visit_bookings b ON b.id=n.booking_id WHERE n.version<b.version AND d.status='done' AND d.attempts>0 AND b.id IN (?,?,?)",[v.id,rejected.id,adminCancelled.id]);check(sentOld.n===0,'Worker never sends obsolete versions');
  await db.query("UPDATE estate_visit_bookings SET state='confirmed',version=version+1,starts_at=UTC_TIMESTAMP()+INTERVAL 40 MINUTE WHERE id=?",[adminCancelled.id]);
  const [[reminderVersion]]=await db.query('SELECT version FROM estate_visit_bookings WHERE id=?',[adminCancelled.id]);const reminder=randomUUID();
  await db.query("INSERT INTO estate_visit_notices(id,booking_id,version,user_id,kind,title,due_at) VALUES (?,?,?,?,'reminder1','QA recordatorio',UTC_TIMESTAMP()-INTERVAL 1 MINUTE)",[reminder,adminCancelled.id,reminderVersion.version,buyer.user.id]);
  const beforeReminder=sent.length;await worker.flushVisits();check(sent.length===beforeReminder+1&&sent.at(-1).visit.noticeId===reminder,'Due reminder delivers once');await worker.flushVisits();check(sent.length===beforeReminder+1,'Repeated worker does not redeliver completed notice');
  await db.query("INSERT INTO estate_visit_notices(id,booking_id,version,user_id,kind,title,due_at) VALUES (?,?,?,?,'reminder24','QA obsoleto',UTC_TIMESTAMP()-INTERVAL 1 MINUTE)",[randomUUID(),adminCancelled.id,reminderVersion.version,seller.user.id]);
  await worker.flushVisits();check(sent.length===beforeReminder+1,'Late 24h reminder is suppressed near visit');
  await act(administrator,{...adminCancelled,version:reminderVersion.version},'cancel');
  console.log(`PASS: ${checks} appointment checks; migration repeatable, authorization, chat, idempotency, race exclusion and reminders. Production connections: 0.`);
}finally{await db.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
