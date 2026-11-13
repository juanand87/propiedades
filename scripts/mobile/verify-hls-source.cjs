const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'mobile/node_modules/typescript'));
const platform={OS:'android'};
function load(file,extra={}){const context={exports:{},process:{env:{}},require:name=>name==='react-native'?{Platform:platform}:name==='expo/fetch'?{fetch:()=>{throw Error('No network in source test');}}:extra[name]};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'mobile/src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);return context.exports;}
const api=load('api.ts'),source=load('video-source.ts',{'./api':api});
const id='00000000-0000-4000-8000-000000000001',v='00000000-0000-4000-8000-000000000002';
const mp4=`/api/videos/${id}/content`,hls=`/api/videos/${id}/hls/master.m3u8?v=${v}`;
assert.equal(source.preferredVideoUrl({url:mp4,hls_url:hls}),hls);
assert.equal(source.playbackSource(hls).contentType,'hls');
assert.equal(source.playbackSource(hls).useCaching,true);
assert.equal(source.playbackSource(mp4).contentType,'progressive');
assert.equal(source.preferredVideoUrl({url:mp4}),mp4);
assert.ok(api.mediaUrl(hls+'&signature=abc.def-ghi').includes('/hls/master.m3u8'));
for(const unsafe of ['https://other.invalid/master.m3u8',`/api/videos/${id}/hls/../../private?v=${v}`,hls+'&redirect=https://other.invalid'])assert.throws(()=>api.mediaUrl(unsafe));
platform.OS='ios';assert.equal(source.playbackSource(hls).useCaching,false);
platform.OS='web';assert.equal(source.preferredVideoUrl({url:mp4,hls_url:hls}),mp4);
console.log('PASS: 11 HLS mobile source and URL checks. No network.');
