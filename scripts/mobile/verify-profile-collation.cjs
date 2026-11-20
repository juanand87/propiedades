// Reproduce MySQL's mixed-collation boundary without changing any persistent table.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');const root=path.resolve(__dirname,'../..'),mysql=require(root+'/backend/node_modules/mysql2/promise');const {notBlocked}=require(root+'/backend/dist/estate/moderation-rules');
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:3327,user:'root',database:'propiedades'});try{
const [[env]]=await db.query('SELECT @@datadir d,@@port p');assert.equal(env.p,3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
await db.query('CREATE TEMPORARY TABLE qa_search_candidate(id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci PRIMARY KEY)');
await db.query('CREATE TEMPORARY TABLE estate_user_blocks(blocker_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,blocked_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci)');
const viewer='11111111-1111-4111-8111-111111111111',target='22222222-2222-4222-8222-222222222222';await db.query('INSERT INTO qa_search_candidate VALUES (?)',[target]);
const query=right=>'SELECT candidate.id FROM qa_search_candidate candidate WHERE '+notBlocked('?',right);
await assert.rejects(db.query(query('candidate.id'),[viewer,viewer]),e=>e.code==='ER_CANT_AGGREGATE_2COLLATIONS');
const fixed='CONVERT(candidate.id USING utf8mb4) COLLATE utf8mb4_unicode_ci';
assert.equal((await db.query(query(fixed),[viewer,viewer]))[0].length,1);
await db.query('INSERT INTO estate_user_blocks VALUES (?,?)',[viewer,target]);assert.equal((await db.query(query(fixed),[viewer,viewer]))[0].length,0);
await db.query('DELETE FROM estate_user_blocks');await db.query('INSERT INTO estate_user_blocks VALUES (?,?)',[target,viewer]);assert.equal((await db.query(query(fixed),[viewer,viewer]))[0].length,0);
console.log('PASS: reproduced ER_CANT_AGGREGATE_2COLLATIONS; explicit conversion fixes search and preserves bilateral blocks. Temporary tables only; production connections: 0.');
}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
