// Real SQL regression using temporary tables in the isolated local sandbox.
// No persistent user, follow or block rows are modified.
const mysql=require('../../backend/node_modules/mysql2/promise'),assert=require('node:assert/strict'),path=require('node:path');
const {VideoSocialService}=require('../../backend/dist/estate/video-social.service');
const {ConfigService}=require('../../backend/node_modules/@nestjs/config');
const {notBlocked}=require('../../backend/dist/estate/moderation-rules');
const root=path.resolve(__dirname,'../..');
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades'});let checks=0;try{
const [[env]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.equal(path.resolve(env.d).toLowerCase(),path.join(root,'tmp/mobile-local/mysql-data').toLowerCase());
await db.query('CREATE TEMPORARY TABLE users(id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci PRIMARY KEY,firstName VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,isActive TINYINT)');
await db.query('CREATE TEMPORARY TABLE estate_video_profiles(user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,display_name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,avatar_media_id VARCHAR(36) NULL)');
await db.query('CREATE TEMPORARY TABLE estate_video_follows(follower_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,followed_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
await db.query('CREATE TEMPORARY TABLE estate_user_blocks(blocker_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,blocked_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci)');
const owner='11111111-1111-4111-8111-111111111111',samuel='22222222-2222-4222-8222-222222222222',company='33333333-3333-4333-8333-333333333333',inactive='44444444-4444-4444-8444-444444444444';
await db.query('INSERT INTO users VALUES (?,?,1),(?,?,1),(?,?,1),(?,?,0)',[owner,'Juan',samuel,'Samuel Álvarez',company,'Empresa',inactive,'Inactivo']);
await db.query('INSERT INTO estate_video_profiles VALUES (?,?,NULL)',[company,'Empresa Ñuble']);
for(const [a,b] of [[samuel,owner],[company,owner],[owner,samuel],[inactive,owner]])await db.query('INSERT INTO estate_video_follows(follower_id,followed_id) VALUES (?,?)',[a,b]);
await assert.rejects(db.query('SELECT u.id FROM users u WHERE '+notBlocked('?','u.id'),[owner,owner]),e=>e.code==='ER_CANT_AGGREGATE_2COLLATIONS');checks++;
const query=async(sql,params)=>(await db.query(sql,params))[0];
const service=new VideoSocialService({query},new ConfigService({SOCIAL_VIDEOS_ENABLED:'true'}),{},{},{},{},{});
// Scope the regression to the real followers SQL; profile access is covered by HTTP checks.
service.profile=async()=>({id:owner});
const actor={id:owner,role:'vendor'};
const followers=await service.followers(owner,'1','followers','',actor);assert.deepEqual(followers.items.map(x=>x.id).sort(),[samuel,company].sort());assert.equal(followers.has_more,false);checks+=2;
assert.deepEqual((await service.followers(owner,'1','following','',actor)).items.map(x=>x.id),[samuel]);checks++;
assert.equal((await service.followers(owner,'1','followers','Samuel',actor)).items[0].display_name,'Samuel Álvarez');checks++;
assert.equal((await service.followers(owner,'1','followers','Ñuble',actor)).items[0].display_name,'Empresa Ñuble');checks++;
assert.equal((await service.followers(owner,'1','followers','%',actor)).items.length,0);checks++;
assert.equal((await service.followers(owner,'1','followers',"' OR 1=1 --",actor)).items.length,0);checks++;
assert.equal((await service.followers(owner,'1','followers','')).items.length,2);checks++;
for(const [a,b] of [[owner,samuel],[samuel,owner]]){
await db.query('DELETE FROM estate_user_blocks');await db.query('INSERT INTO estate_user_blocks VALUES (?,?)',[a,b]);
assert.deepEqual((await service.followers(owner,'1','followers','',actor)).items.map(x=>x.id),[company]);
assert.equal((await service.followers(owner,'1','following','',actor)).items.length,0);checks+=2;
}
assert.equal((await service.followers(owner,'2','followers','',actor)).items.length,0);checks++;
console.log(JSON.stringify({passed:checks,reproducedOriginalSqlError:true,temporaryTablesOnly:true,productionChanges:0}));
}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
