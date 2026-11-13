// Real API/SQL checks against the guarded local mobile sandbox only.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {DataSource}=require(path.join(root,'backend/node_modules/typeorm'));
const {ConfigService}=require(path.join(root,'backend/node_modules/@nestjs/config'));
const {SavedSearchService}=require(path.join(root,'backend/dist/estate/saved-search.service'));
const base='http://127.0.0.1:3328/api';let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function call(route,{token,method='GET',body,status=200}={}){const r=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(value).slice(0,250));checks++;return value;}
async function main(){const db=new DataSource({type:'mariadb',host:'127.0.0.1',port:3327,username:'root',database:'propiedades',synchronize:false,extra:{supportBigNumbers:true,bigNumberStrings:true}});await db.initialize();try{
 const [env]=await db.query('SELECT @@port p,@@datadir d');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
 const migration=await fs.readFile(path.join(root,'database/BUSQUEDAS_Y_ALERTAS.sql'),'utf8');for(let i=0;i<2;i++)for(const statement of migration.split(';').filter(s=>s.trim()))await db.query(statement);
 const qa=JSON.parse(await fs.readFile(path.join(root,'tmp/mobile-local/social-qa.json'),'utf8'));
 const login=await call('/auth/login',{method:'POST',status:201,body:{email:qa.email,password:qa.password}}),token=login.access_token;
 const other=await call('/auth/register',{method:'POST',status:201,body:{email:`qa-search-${Date.now()}@qa.invalid`,password:randomBytes(24).toString('base64url'),firstName:'QA Search',lastName:'Local'}});
 const [owner]=await db.query('SELECT advertiser_id FROM properties WHERE id=?',[qa.propertyId]);await db.query("UPDATE advertisers SET status='approved' WHERE id=?",[owner.advertiser_id]);
 const marker='QA Buscar '+randomBytes(5).toString('hex');
 async function property({price='70000000',unit='CLP',status='published',availability='available'}={}){const id=randomUUID(),code='QAS'+randomBytes(6).toString('hex');await db.query('INSERT INTO properties(id,advertiser_id,created_by,code,slug,title,description,type_id,operation_type,price_amount,price_unit,bedrooms,publication_status,availability,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',[id,owner.advertiser_id,qa.userId,code,code.toLowerCase(),marker,'Local saved search QA','house','sale',price,unit,3,status,availability]);return id;}
 const baseline=await property();const filters={search:marker,type_id:'house',operation_type:'sale',price_unit:'CLP',max_price:'80000000',bedrooms:'2'};
 await call('/me/saved-searches',{status:401});
 const saved=await call('/me/saved-searches',{method:'POST',status:201,token,body:{name:'QA casa hasta 80 millones',filters}});
 const again=await call('/me/saved-searches',{method:'POST',status:201,token,body:{name:'Same filters',filters:{...filters,max_price:'80000000.00'}}});check(saved.id===again.id,'Equivalent searches are not duplicated');
 await call('/me/saved-searches/'+saved.id,{token:other.access_token,status:404});
 await call('/me/saved-searches/'+saved.id,{method:'PATCH',token:other.access_token,status:404,body:{enabled:false}});
 await call('/me/saved-searches/'+saved.id,{method:'DELETE',token:other.access_token,status:404});
 await call('/me/saved-searches',{method:'POST',status:400,token,body:{name:'Bad',filters:{status:'draft'}}});
 const service=new SavedSearchService(db,new ConfigService({NODE_ENV:'development'}));await service.scan();
 check(!(await call('/me/saved-searches/matches',{token})).items.some(m=>m.property_id===baseline),'Saving does not alert existing properties');
 await call('/messages/devices',{method:'POST',status:201,token,body:{token:'fcm_local_saved_search_0123456789'}});
 const matching=await property(),overBudget=await property({price:'90000000'}),uf=await property({unit:'UF',price:'3000'}),draft=await property({status:'draft'}),sold=await property({availability:'sold'});
 const catalog=await call('/properties?'+new URLSearchParams(filters));check(catalog.items.some(p=>p.id===matching)&&!catalog.items.some(p=>p.id===overBudget||p.id===uf),'Catalog uses same price and currency filters');
 await service.scan();await service.scan();const matches=await call('/me/saved-searches/matches',{token});const found=matches.items.filter(m=>m.property_id===matching);
 check(found.length===1,'New property alerts once across scans');check(!matches.items.some(m=>[baseline,overBudget,uf,draft,sold].includes(m.property_id)),'No old, expensive, UF, draft or unavailable matches');
 const [queued]=await db.query('SELECT COUNT(*) n FROM estate_search_push_deliveries WHERE match_id=?',[found[0].id]);check(Number(queued.n)===1,'FCM delivery queued once');
 await call('/me/saved-searches/matches/'+found[0].id+'/read',{method:'POST',status:201,token:other.access_token});
 check(!(await call('/me/saved-searches/matches',{token})).items.find(m=>m.id===found[0].id).read_at,'Another user cannot read own alert');
 await call('/me/saved-searches/matches/'+found[0].id+'/read',{method:'POST',status:201,token});check(!!(await call('/me/saved-searches/matches',{token})).items.find(m=>m.id===found[0].id).read_at,'Read state persists');
 await call('/me/saved-searches/'+saved.id,{method:'PATCH',token,body:{enabled:false}});const whilePaused=await property();await service.scan();check(!(await call('/me/saved-searches/matches',{token})).items.some(m=>m.property_id===whilePaused),'Paused search produces no alert');
 await call('/me/saved-searches/'+saved.id,{method:'PATCH',token,body:{enabled:true}});await service.scan();check(!(await call('/me/saved-searches/matches',{token})).items.some(m=>m.property_id===whilePaused),'Resume does not flood paused-period listings');
 const resumed=await property();await service.scan();check((await call('/me/saved-searches/matches',{token})).items.some(m=>m.property_id===resumed),'Resume alerts future properties');
 await db.query("UPDATE properties SET publication_status='paused' WHERE id=?",[matching]);check(!(await call('/me/saved-searches/matches',{token})).items.some(m=>m.property_id===matching),'Withdrawn property hidden from alerts');
 await call('/me/saved-searches/'+saved.id,{method:'DELETE',token});await call('/me/saved-searches/'+saved.id,{token,status:404});const [orphans]=await db.query('SELECT COUNT(*) n FROM estate_search_matches WHERE search_id=?',[saved.id]);check(Number(orphans.n)===0,'Delete cleans matches and stops alerts');
 console.log(`PASS: ${checks} saved search API/SQL checks. Local DB only; production connections: 0.`);
}finally{await db.destroy();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
