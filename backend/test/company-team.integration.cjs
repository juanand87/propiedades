// Only uses the isolated local QA MySQL instance. Sends no email.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {DataSource}=require('typeorm');
const {ConfigService}=require('@nestjs/config');
const {JwtService}=require('@nestjs/jwt');
const {EstateService}=require('../dist/estate/estate.service');
const {CompanyTeamService}=require('../dist/estate/company-team.service');
(async()=>{
 const db=new DataSource({type:'mysql',host:'127.0.0.1',port:3317,username:'root',database:'propiedades',charset:'utf8mb4_unicode_ci'});await db.initialize();
 const ids=Array.from({length:7},()=>randomUUID());const [owner,agent,stranger,advertiser,otherAdvertiser,property,otherProperty]=ids;
 let checks=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};const reject=async(fn,match)=>{await assert.rejects(fn,match);checks++};
 try{
  const [server]=await db.query('SELECT @@datadir location,@@port port');assert.equal(Number(server.port),3317);assert.ok(String(server.location).replace(/\\/g,'/').toLowerCase().includes('/propiedades/tmp/qa-mysql-data'));
  for(const [id,name]of[[owner,'Company QA'],[agent,'Agent QA'],[stranger,'Stranger QA']])await db.query('INSERT INTO users(id,email,password,firstName,lastName,role,isActive) VALUES (?,?,?, ?,?,?,1)',[id,id+'@example.invalid','unused',name,'QA','vendor']);
  for(const [id,user,name]of[[advertiser,owner,'Company QA'],[otherAdvertiser,stranger,'Other company QA']])await db.query("INSERT INTO advertisers(id,user_id,slug,display_name,status,kind) VALUES (?,?,?,?,'approved','agency')",[id,user,id,name]);
  await db.query("INSERT INTO estate_profile_identity(user_id,profile_kind,username) VALUES (?,'company',?),(?,'agent',?),(?,'company',?)",[owner,'q'+owner.slice(0,20),agent,'q'+agent.slice(0,20),stranger,'q'+stranger.slice(0,20)]);
  for(const [id,ad,user]of[[property,advertiser,owner],[otherProperty,otherAdvertiser,stranger]])await db.query("INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,description,price_amount,price_unit) VALUES (?,?,?,?,?,'Casa QA','Descripción original',5000,'UF')",[id,ad,user,id.slice(0,12),id]);
  const estate=new EstateService(db,new JwtService({secret:'isolated-qa-not-a-production-secret'}));
  const service=new CompanyTeamService(db,estate,{sendCompanyInvitation:async()=>{throw Error('No outbound email in QA')}},new ConfigService({FRONTEND_URL:'https://example.invalid'}));
  const ownerActor=await estate.actor(owner),agentActor=await estate.actor(agent),strangerActor=await estate.actor(stranger);
  check(await service.available(),true);
  const team=await service.create(ownerActor);check((await service.overview(ownerActor)).team.id,team.id);
  const invite=await service.invite(ownerActor,agentActor.email);check(invite.mail_sent,false);check(new URL(invite.invitation_url).search,'');
  const token=new URLSearchParams(new URL(invite.invitation_url).hash.slice(1)).get('token');assert.ok(token);checks++;
  await reject(()=>service.accept(strangerActor,token),/correo/);
  await service.accept(agentActor,token);await reject(()=>service.accept(agentActor,token),/venció/);
  check((await service.overview(agentActor)).memberships.length,1);
  await reject(()=>service.assign(strangerActor,{user_id:agent,property_id:property,can_edit:true}),/propietaria/);
  await reject(()=>service.assign(ownerActor,{user_id:agent,property_id:otherProperty,can_edit:true}),/tus propiedades/);
  await service.assign(ownerActor,{user_id:agent,property_id:property,can_edit:false});
  const list=await service.assigned(agentActor,team.id);check(list.items.length,1);check(list.items[0].team_can_edit,false);check(list.items[0].revision,1);
  await reject(()=>service.propose(agentActor,team.id,property,{revision:1,changes:{title:'Nueva casa'}}),/lectura/);
  await service.assign(ownerActor,{user_id:agent,property_id:property,can_edit:true});
  await reject(()=>service.propose(agentActor,team.id,property,{revision:1,changes:{publication_status:'published'}}),/autorizados/);
  const proposal=await service.propose(agentActor,team.id,property,{revision:1,changes:{title:'Casa propuesta',price_amount:6500}});
  check((await db.query('SELECT title FROM properties WHERE id=?',[property]))[0].title,'Casa QA');
  await reject(()=>service.review(strangerActor,proposal.id,true),/propietaria/);
  await service.review(ownerActor,proposal.id,true);
  const [saved]=await db.query('SELECT title,price_amount,description,advertiser_id,revision FROM properties WHERE id=?',[property]);
  check(saved.title,'Casa propuesta');check(Number(saved.price_amount),6500);check(saved.description,'Descripción original');check(saved.advertiser_id,advertiser);check(saved.revision,2);
  check((await db.query('SELECT status FROM estate_company_property_proposals WHERE id=?',[proposal.id]))[0].status,'applied');
  await reject(()=>service.review(ownerActor,proposal.id,true),/no disponible/);
  await reject(()=>service.propose(agentActor,team.id,property,{revision:1,changes:{title:'Vieja'}}),/cambió/);
  const pending=await service.propose(agentActor,team.id,property,{revision:2,changes:{title:'Pendiente'}});
  await service.revoke(ownerActor,agent);check((await service.assigned(agentActor,team.id)).items.length,0);
  await reject(()=>service.propose(agentActor,team.id,property,{revision:2,changes:{title:'Sin acceso'}}),/retirado/);
  check((await db.query('SELECT status FROM estate_company_property_proposals WHERE id=?',[pending.id]))[0].status,'rejected');
  console.log(`${checks} real database checks passed: invitation, ownership, assignment, proposal, review and revocation.`);
 }finally{try{
  await db.query('DELETE FROM estate_company_property_proposals WHERE user_id=?',[agent]);
  await db.query('DELETE pa FROM estate_company_property_assignments pa JOIN estate_company_teams t ON t.id=pa.team_id WHERE t.owner_user_id=?',[owner]);
  await db.query('DELETE i FROM estate_company_invitations i JOIN estate_company_teams t ON t.id=i.team_id WHERE t.owner_user_id=?',[owner]);
  await db.query('DELETE m FROM estate_company_members m JOIN estate_company_teams t ON t.id=m.team_id WHERE t.owner_user_id=?',[owner]);
  await db.query('DELETE FROM estate_company_teams WHERE owner_user_id=?',[owner]);
  await db.query('DELETE FROM property_status_history WHERE property_id IN (?,?)',[property,otherProperty]);
  await db.query('DELETE FROM property_private_locations WHERE property_id IN (?,?)',[property,otherProperty]);
  await db.query('DELETE FROM properties WHERE id IN (?,?)',[property,otherProperty]);
  await db.query('DELETE FROM advertisers WHERE id IN (?,?)',[advertiser,otherAdvertiser]);
  await db.query('DELETE FROM estate_profile_identity WHERE user_id IN (?,?,?)',[owner,agent,stranger]);
  await db.query('DELETE FROM users WHERE id IN (?,?,?)',[owner,agent,stranger]);
  }finally{await db.destroy()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
