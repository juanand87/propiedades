// Runs only on isolated QA MySQL. No email, push, or production access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const{DataSource}=require('typeorm'),{ConfigService}=require('@nestjs/config'),{JwtService}=require('@nestjs/jwt');
const{EstateService}=require('../dist/estate/estate.service'),{CompanyTeamService}=require('../dist/estate/company-team.service'),{InquiryWorkflowService}=require('../dist/estate/inquiry-workflow.service');
(async()=>{
const db=new DataSource({type:'mysql',host:'127.0.0.1',port:3317,username:'root',database:'propiedades',charset:'utf8mb4_unicode_ci',extra:{multipleStatements:true}});await db.initialize();
const[owner,agent,stranger,advertiser,otherAdvertiser,property,otherProperty,first,second,third]=Array.from({length:10},()=>randomUUID());
let checks=0;const check=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++};
let safe=false;
try{
const[server]=await db.query('SELECT @@datadir location,@@port port');assert.equal(Number(server.port),3317);assert.ok(String(server.location).replace(/\\/g,'/').toLowerCase().includes('/propiedades/tmp/qa-mysql-data'));safe=true;
const migration=fs.readFileSync(path.resolve(__dirname,'../../database/INTERESADOS_EQUIPO.sql'),'utf8');await db.query(migration);await db.query(migration);checks+=2;
for(const[id,name]of[[owner,'Empresa Leads QA'],[agent,'Agente Leads QA'],[stranger,'Otra Empresa Leads QA']])await db.query('INSERT INTO users(id,email,password,firstName,lastName,role,isActive) VALUES (?,?,?,?,?,?,1)',[id,id+'@example.invalid','unused',name,'QA','vendor']);
for(const[id,user,name]of[[advertiser,owner,'Empresa Leads QA'],[otherAdvertiser,stranger,'Otra Empresa Leads QA']])await db.query("INSERT INTO advertisers(id,user_id,slug,display_name,status,kind) VALUES (?,?,?,?,'approved','agency')",[id,user,id,name]);
await db.query("INSERT INTO estate_profile_identity(user_id,profile_kind,username) VALUES (?,'company',?),(?,'agent',?),(?,'company',?)",[owner,'q'+owner.slice(0,20),agent,'q'+agent.slice(0,20),stranger,'q'+stranger.slice(0,20)]);
for(const[id,ad,user]of[[property,advertiser,owner],[otherProperty,otherAdvertiser,stranger]])await db.query("INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,description) VALUES (?,?,?,?,?,'Propiedad interesados QA','Sin publicación')",[id,ad,user,id.slice(0,12),id]);
for(const[id,prop]of[[first,property],[second,property],[third,otherProperty]])await db.query("INSERT INTO property_inquiries(id,property_id,name,email,message,consent_at) VALUES (?,?,'Interesado QA','lead@example.invalid','Quiero información',UTC_TIMESTAMP())",[id,prop]);
const leads=new InquiryWorkflowService(db);const estate=new EstateService(db,new JwtService({secret:'isolated-qa-test-secret'}));Object.assign(estate,{inquiryWorkflow:leads});
const teams=new CompanyTeamService(db,estate,{sendCompanyInvitation:async()=>{throw Error('No outbound email')}},new ConfigService());
const own=await estate.actor(owner),ag=await estate.actor(agent),other=await estate.actor(stranger);
const team=await teams.create(own);await teams.create(other);await db.query("INSERT INTO estate_company_members(team_id,user_id,role,status) VALUES (?,?,'agent','active')",[team.id,agent]);
check(await leads.available(),true);check((await leads.list(own)).items.length,2);check((await leads.list(ag)).items.length,0);
await teams.assign(own,{user_id:agent,property_id:property,can_edit:true});check((await leads.list(ag)).items.length,0);
await reject(()=>leads.assign(other,first,agent),/no está asignado/);
await reject(()=>leads.assign(own,first,stranger),/agente activo/);
await leads.assign(own,first,agent);let list=await leads.list(ag);check(list.items.length,1);check(list.items[0].id,first);check(Number(list.items[0].can_manage),0);check(list.agents.length,0);
check((await leads.list(own)).agents[0].user_id,agent);
await reject(()=>leads.assign(ag,first,null),/Solo la empresa/);
await reject(()=>leads.history(ag,second),/no está asignado/);
await reject(()=>leads.update(ag,first,{stage:'published',revision:0}),/inválida/);
await reject(()=>leads.note(ag,first,' '),/Escribe/);
await leads.update(ag,first,{stage:'contacted',revision:0});list=await leads.list(ag);check(list.items[0].stage,'contacted');check(list.items[0].revision,1);
await reject(()=>leads.update(own,first,{stage:'negotiation',revision:0}),/cambió/);check((await leads.list(own)).items.find(i=>i.id===first).stage,'contacted');
await leads.update(own,first,{stage:'visit_scheduled',revision:1});check((await db.query('SELECT status FROM property_inquiries WHERE id=?',[first]))[0].status,'contacted');
await leads.update(ag,first,{stage:'negotiation',revision:2});check((await leads.list(own)).items.find(i=>i.id===first).stage,'negotiation');
await estate.updateInquiry(own,first,{status:'closed'});check((await leads.list(ag)).items[0].stage,'closed');check((await leads.list(ag)).items[0].revision,4);
await leads.note(ag,first,'Llamar al interesado mañana');let history=await leads.history(own,first);check(history.notes[0].message,'Llamar al interesado mañana');check(history.notes[0].author_name,'Agente Leads QA');check(history.events.filter(e=>e.action==='stage').length,4);check(history.events.find(e=>e.action==='assignment').next_name,'Agente Leads QA');
await reject(()=>leads.history(other,first),/no está asignado/);
await leads.assign(own,first,null);check((await leads.list(ag)).items.length,0);await reject(()=>leads.note(ag,first,'Sin permiso'),/retirado/);
await leads.assign(own,first,agent);await teams.revoke(own,agent);check((await leads.list(ag)).items.length,0);check((await db.query('SELECT * FROM estate_inquiry_assignments WHERE inquiry_id=?',[first])).length,0);
await db.query("UPDATE estate_company_members SET status='active' WHERE team_id=? AND user_id=?",[team.id,agent]);check((await leads.list(ag)).items.length,0);history=await leads.history(own,first);check(history.events.filter(e=>e.action==='assignment').length,4);
console.log(`${checks} inquiry workflow database checks passed, including migration repeatability, scope, states, notes, legacy compatibility and revoked access.`);
}finally{try{if(safe){
for(const table of ['estate_inquiry_events','estate_inquiry_assignments','estate_inquiry_workflow','property_inquiry_messages'])await db.query(`DELETE FROM ${table} WHERE inquiry_id IN (?,?,?)`,[first,second,third]);
await db.query('DELETE FROM property_inquiries WHERE id IN (?,?,?)',[first,second,third]);
await db.query('DELETE pa FROM estate_company_property_assignments pa JOIN estate_company_teams t ON t.id=pa.team_id WHERE t.owner_user_id IN (?,?)',[owner,stranger]);
await db.query('DELETE m FROM estate_company_members m JOIN estate_company_teams t ON t.id=m.team_id WHERE t.owner_user_id IN (?,?)',[owner,stranger]);await db.query('DELETE FROM estate_company_teams WHERE owner_user_id IN (?,?)',[owner,stranger]);
await db.query('DELETE FROM properties WHERE id IN (?,?)',[property,otherProperty]);await db.query('DELETE FROM advertisers WHERE id IN (?,?)',[advertiser,otherAdvertiser]);await db.query('DELETE FROM estate_profile_identity WHERE user_id IN (?,?,?)',[owner,agent,stranger]);await db.query('DELETE FROM users WHERE id IN (?,?,?)',[owner,agent,stranger]);
}}finally{await db.destroy()}}
})().catch(e=>{console.error(e);process.exitCode=1});
