const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'mobile/node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'mobile/src/notification-destination.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const destination = data => JSON.parse(JSON.stringify(context.exports.notificationDestination(data)));
const videoId = '00000000-0000-4000-8000-000000000001';
const commentId = '00000000-0000-4000-8000-000000000002';
const conversationId = '00000000-0000-4000-8000-000000000003';
assert.deepEqual(destination({ videoId, commentId, type: 'comment' }), { kind: 'video', videoId, commentId });
assert.deepEqual(destination({ videoId, commentId, type: 'reply', conversationId: '' }), { kind: 'video', videoId, commentId });
assert.deepEqual(destination({ conversationId }), { kind: 'conversation', conversationId });
assert.deepEqual(destination({ test: 'true' }), { kind: 'test' });
for (const data of [null, [], {}, 'url', { url: 'https://other.invalid' }, { videoId }, { videoId, commentId: '../bad' }, { conversationId: '-'.repeat(36) }, { videoId: 3, commentId }]) {
  assert.equal(destination(data), null);
}
assert.deepEqual(destination({type:'property_match',propertyId:videoId,searchMatchId:'17'}),{kind:'property',propertyId:videoId,matchId:'17'});
assert.equal(destination({type:'property_match',propertyId:videoId,searchMatchId:'../private'}),null);
assert.equal(destination({type:'property_match',propertyId:'bad',searchMatchId:'17'}),null);
console.log('PASS: 16 notification destination checks. No network or credentials.');
