// Only the dedicated local sandbox; never accepts a remote URL.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base='http://127.0.0.1:3328/api';let count=0;
async function call(path,body,token,method=body?'POST':'GET',expected=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));count++;return data;}
(async()=>{
 const env=await call('/mobile/environment');assert.equal(env.environment,'local-mobile');
 const options=await call('/auth/options');assert.equal(options.onboarding,true);assert.equal(options.google,false);
 await call('/auth/google/start',{},null,'POST',503);
 const email='signup-'+crypto.randomUUID()+'@qa.invalid',password=crypto.randomBytes(20).toString('hex');
 const session=await call('/auth/register',{email,password,firstName:'Registro',lastName:'Prueba',role:'admin'},null,'POST',201),token=session.access_token;
 assert.equal(session.user.role,'customer');assert.equal(session.user.account_type,null);
 await call('/auth/register',{email,password,firstName:'Registro',lastName:'Prueba'},null,'POST',409);
 const buyer=await call('/me/account-type',{account_type:'buyer'},token,'POST',201);assert.equal(buyer.account_type,'buyer');assert.ok(!buyer.advertiser_id);
 await call('/me/account-type',{account_type:'admin'},token,'POST',400);
 await call('/me/account-type',{account_type:'seller'},null,'POST',401);
 const seller=await call('/me/account-type',{account_type:'seller'},token,'POST',201);assert.ok(seller.advertiser_id);assert.equal(seller.advertiser_status,'pending');
 const seller2=await call('/me/account-type',{account_type:'seller'},token,'POST',201);assert.equal(seller2.advertiser_id,seller.advertiser_id);
 const allowance=await call('/me/publication-allowance',null,token);assert.equal(allowance.can_create,true);
 const body={title:'Propiedad QA registro',description:'Propiedad ficticia para verificar el registro y la membresía en el entorno de pruebas local.',type_id:'house',price_amount:'50000000',price_unit:'CLP',bedrooms:2,bathrooms:1,built_area:80,land_area:120};
 const results=await Promise.all([fetch(base+'/manage/properties',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)}),fetch(base+'/manage/properties',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,403]);count+=2;
 const p=await results.find(r=>r.status===201).json();const denied=await results.find(r=>r.status===403).json();assert.equal(denied.code,'MEMBERSHIP_REQUIRED');
 await call('/manage/properties/'+p.id,{title:'Propiedad QA editada'},token,'PATCH');
 await call('/manage/properties/'+p.id+'/status',{status:'archived'},token,'PATCH');
 await call('/manage/properties',body,token,'POST',403);
 await call('/me/account-type',{account_type:'buyer'},token,'POST',201);
 await call('/me/account-type',{account_type:'seller'},token,'POST',201);
 await call('/manage/properties',body,token,'POST',403);
 const login=await call('/auth/login',{email,password},null,'POST',201);assert.equal(login.user.account_type,'seller');
 const stats=await call('/manage/stats',null,token);assert.equal(stats.likes,0);await call('/manage/inquiries',null,token);
 console.log(`PASS: ${count} HTTP checks, concurrent quota, role escalation, profile persistence, archive/profile-switch bypass, Google disabled. Production connections: 0`);
})().catch(e=>{console.error(e);process.exitCode=1});
