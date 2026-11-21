// Runs the transport with native upload/fetch fakes; no network or real files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),ts=require(root+'/mobile/node_modules/typescript');
function load(name,mocks={},timers={}){const c={exports:{},require:key=>{if(!(key in mocks))throw Error('Unexpected import '+key);return mocks[key]},Error,TypeError,FormData,AbortController,setTimeout:timers.setTimeout||setTimeout,clearTimeout,process:{env:{EXPO_PUBLIC_ENV:'production',EXPO_PUBLIC_API_URL:'https://clownfish-app-2-bgbzm.ondigitalocean.app/api'}}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/mobile/src/'+name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,c);return c.exports;}
const network=load('network-error.ts');
class ApiError extends Error{constructor(message,status){super(message);this.status=status;}}
function transport({responses=[],ready=async()=>({}),renew=async()=>null,timeout=false}={}) {
  const calls=[];let cancelled=0;
  const native={
    FileSystemUploadType:{MULTIPART:1},FileSystemSessionType:{FOREGROUND:0},
    createUploadTask(url,uri,options,callback) {
      calls.push({url,uri,options});const next=responses.shift();
      return {
        cancelAsync:async()=>{cancelled++},
        uploadAsync:async()=>{
          callback({totalBytesSent:10,totalBytesExpectedToSend:100});
          callback({totalBytesSent:100,totalBytesExpectedToSend:100});
          if(next instanceof Error)throw next;
          if(next==='hang')return new Promise(()=>{});
          return next||{status:201,body:'{"id":"video","status":"published"}'};
        },
      };
    },
  };
  const code=load('video-upload.ts',{'expo-file-system/legacy':native,'./api':{api:ready,API_URL:'https://clownfish-app-2-bgbzm.ondigitalocean.app/api',ApiError,refreshAccessToken:renew},'./network-error':network},{setTimeout:(fn,ms)=>setTimeout(fn,(ms===2000||timeout)?0:ms)});
  return {...code,calls,cancelled:()=>cancelled};
}
const base={path:'/manage/videos',uri:'file:///private/clip.mp4',token:'qa-token',parameters:{title:'Casa QA',request_id:'11111111-1111-4111-8111-111111111111',publish:'true'}};
(async()=>{let checks=0;
for(const raw of [new Error('fetch failed: java.net.UnknownHostException: Unable to resolve host secret.example'),new TypeError('Network request failed'),new Error(network.connectionMessage)]){assert.equal(network.isNetworkFailure(raw),true);checks++;}
const events=[],a=transport();assert.equal((await a.uploadVideo({...base,onProgress:p=>events.push(p)})).id,'video');assert.deepEqual(events.map(p=>p.phase),['connecting','uploading','processing']);assert.equal(a.calls[0].options.fieldName,'file');assert.equal(a.calls[0].options.headers.Authorization,'Bearer qa-token');checks+=4;
const b=transport({responses:[new Error('java.net.UnknownHostException: Unable to resolve host'),{status:201,body:'{"id":"same-video"}'}]});assert.equal((await b.uploadVideo({...base,onProgress:()=>{}})).id,'same-video');assert.equal(b.calls.length,2);assert.deepEqual(b.calls[0].options.parameters,b.calls[1].options.parameters);assert.equal(b.calls[0].uri,b.calls[1].uri);checks+=4;
let readyCalls=0;const c=transport({ready:async()=>{readyCalls++;throw new Error(network.connectionMessage)}});await assert.rejects(c.uploadVideo({...base,onProgress:()=>{}}),e=>e.message.includes('Tu video se conserva')&&!/UnknownHost|java\.|ondigitalocean/.test(e.message));assert.equal(readyCalls,2);assert.equal(c.calls.length,0);checks+=3;
const d=transport({responses:[{status:401,body:'{}'},{status:201,body:'{"id":"renewed"}'}],renew:async()=> 'renewed-token'});assert.equal((await d.uploadVideo({...base,onProgress:()=>{}})).id,'renewed');assert.equal(d.calls[1].options.headers.Authorization,'Bearer renewed-token');checks+=2;
const e=transport({responses:[{status:400,body:'{"message":"Título inválido"}'}]});await assert.rejects(e.uploadVideo({...base,onProgress:()=>{}}),v=>v instanceof ApiError&&v.status===400&&v.message==='Título inválido');assert.equal(e.calls.length,1);checks+=2;
const f=transport({responses:[{status:504,body:'<html>private stack</html>'}]});await assert.rejects(f.uploadVideo({...base,onProgress:()=>{}}),e=>e.status===504&&!e.message.includes('private stack'));checks++;
const g=transport({responses:['hang'],timeout:true});await assert.rejects(g.uploadVideo({...base,onProgress:()=>{}}),e=>e.message.includes('Tu video sigue aquí'));assert.equal(g.cancelled(),1);checks+=2;
const h=transport();await assert.rejects(h.uploadVideo({...base,path:'/auth/change-password',onProgress:()=>{}}));await assert.rejects(h.uploadVideo({...base,parameters:{request_id:'invalid'},onProgress:()=>{}}));assert.equal(h.calls.length,0);checks+=3;
const api=load('api.ts',{'react-native':{Platform:{OS:'android'}},'expo/fetch':{fetch:async()=>{throw new Error('fetch failed: java.net.UnknownHostException: Unable to resolve host backend.example')}},'./network-error':network});await assert.rejects(api.api('/ready'),e=>e.message===network.connectionMessage&&!e.message.includes('backend.example'));checks++;
console.log(JSON.stringify({passed:checks,networkRequests:0,realVideosUploaded:0}));})().catch(e=>{console.error(e);process.exitCode=1});
