// Real SQL only in the verified isolated sandbox. Never uses production credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),{DataSource}=require(root+'/backend/node_modules/typeorm'),{JwtService}=require(root+'/backend/node_modules/@nestjs/jwt'),{EstateService}=require(root+'/backend/dist/estate/estate.service');
let passed=0;const check=v=>{assert.ok(v);passed++};
(async()=>{const db=new DataSource({type:'mysql',host:'127.0.0.1',port:3327,username:'root',database:'propiedades'});await db.initialize();const fixtureUser=randomUUID(),inquiries=[randomUUID(),randomUUID()];let property;
try{
const [instance]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(instance.p),3327);assert.equal(path.resolve(instance.d).toLowerCase(),path.join(root,'tmp/mobile-local/mysql-data').toLowerCase());
const [source]=await db.query("SELECT id,advertiser_id,title FROM properties WHERE publication_status='published' LIMIT 1");assert.ok(source);property=source;
const service=new EstateService(db,new JwtService({secret:'isolated-workspace-test'}));const owner={id:fixtureUser,role:'vendor',advertiser_id:property.advertiser_id};
const baseline=await service.list({insights:'1',search:property.title},owner);const original=baseline.items.find(p=>p.id===property.id);check(original?.insights);
const before=await service.stats(owner);
await db.query('INSERT INTO property_favorites(user_id,property_id) VALUES (?,?)',[fixtureUser,property.id]);
for(const [i,status]of ['new','contacted'].entries())await db.query('INSERT INTO property_inquiries(id,property_id,name,email,message,status,consent_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())',[inquiries[i],property.id,'Local workspace QA','local@example.invalid','Local workspace QA',status]);
const result=await service.list({insights:'1',search:property.title},owner),item=result.items.find(p=>p.id===property.id);
assert.equal(item.insights.favorites,original.insights.favorites+1);passed++;
assert.equal(item.insights.inquiries,original.insights.inquiries+2);passed++;
assert.equal(item.insights.new_inquiries,original.insights.new_inquiries+1);passed++;
check(result.items.every(p=>p.advertiser_id===property.advertiser_id));
const [videos]=await db.query("SELECT COUNT(*) n,COALESCE(SUM(status='published'),0) published FROM property_videos WHERE property_id=? AND status<>'archived'",[property.id]);
assert.equal(item.insights.video_count,Number(videos.n));passed++;assert.equal(item.insights.published_videos,Number(videos.published));passed++;
const after=await service.stats(owner);assert.equal(Number(after.likes),Number(before.likes)+1);passed++;assert.equal(Number(after.inquiries),Number(before.inquiries)+2);passed++;assert.equal(after.new_inquiries,before.new_inquiries+1);passed++;
check(['drafts','rejected','paused','archived','pending','published'].every(k=>Number.isFinite(Number(after[k]))));
const stranger=await service.list({insights:'1'}, {...owner,advertiser_id:randomUUID()});check(stranger.total===0&&stranger.items.length===0);
const publicList=await service.list({insights:'1'});check(publicList.items.every(p=>!Object.hasOwn(p,'insights')));
const legacy=await service.list({},owner);check(legacy.items.every(p=>!Object.hasOwn(p,'insights')));
const filtered=await service.list({insights:'1',status:'draft',limit:'1'},owner);check(filtered.items.every(p=>p.publication_status==='draft')&&filtered.items.length<=1);
const paged=await service.list({insights:'1',limit:'1',page:'2'},owner);check(paged.page===2&&paged.items.length<=1);
// Guidance accepts legitimate zeros and mirrors the existing publication checks.
const ts=require(root+'/frontend/node_modules/typescript'),context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/frontend/src/lib/managed-property.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const missing=context.exports.propertyMissingFields;const complete={title:'Casa con jardín',description:'Una casa con todos los datos necesarios para publicar.',price_amount:'50000000',commune_id:'1',media:[{url:'x'}],type_id:'house',built_area:70,land_area:100,bedrooms:0,bathrooms:0};
check(missing(complete).length===0);check(missing({...complete,media:[]}).includes('al menos una fotografía'));check(missing({...complete,price_amount:0}).includes('precio'));check(missing({...complete,bedrooms:null}).includes('dormitorios'));check(missing({...complete,show_exact_address:true,location:{}}).includes('dirección autorizada'));check(!missing({...complete,type_id:'land',built_area:null,bedrooms:null,bathrooms:null}).includes('dormitorios'));
console.log(JSON.stringify({passed,realSql:true,productionChanges:0}));
}finally{for(const id of inquiries)await db.query('DELETE FROM property_inquiries WHERE id=?',[id]);if(property)await db.query('DELETE FROM property_favorites WHERE user_id=? AND property_id=?',[fixtureUser,property.id]);await db.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1});
