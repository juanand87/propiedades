const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'mobile/node_modules/typescript'));
let cursor=0,dirty=true,slots=[],effects=[],pending=[],timers=new Set(),players=[],prefetched=[];
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const react={
  useRef:value=>{const i=cursor++;return slots[i]??=( {current:value} );},
  useState:value=>{const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return [slots[i],next=>{const value=typeof next==='function'?next(slots[i]):next;if(!Object.is(value,slots[i])){slots[i]=value;dirty=true;}}];},
  useEffect:(fn,deps)=>{const i=cursor++;if(!same(effects[i]?.deps,deps))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});},
};
function load(file,require){const context={exports:{},require,setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'mobile/src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);return context.exports;}
const policy=load('video-playback-policy.ts',()=>{});
const source={preferredVideoUrl:v=>v.hls_url||v.url,playbackSource:url=>({uri:url})};
class Player{
  status='idle';currentTime=0;bufferedPosition=-1;duration=30;listeners=new Set();sources=[];released=false;
  addListener(name,fn){this.listeners.add(fn);return {remove:()=>this.listeners.delete(fn)};}
  replaceAsync(source){this.sources.push(source.uri);this.status='loading';return Promise.resolve();}
  release(){this.released=true;}
  pause(){}
  emit(status,buffer=this.bufferedPosition,message){this.status=status;this.bufferedPosition=buffer;for(const fn of this.listeners)fn({status,error:message?{message}:undefined});}
}
const hook=load('useVideoPreload.ts',name=>({react,'react-native':{Image:{prefetch:url=>{prefetched.push(url);return Promise.resolve();}},Platform:{OS:'android'}},'expo-video':{createVideoPlayer:()=>{const p=new Player();players.push(p);return p;},setVideoCacheSizeAsync:()=>Promise.resolve()},'./api':{mediaUrl:u=>u},'./video-source':source,'./video-playback-policy':policy,'./playback-metrics':{beginVideoLoad:()=>{},videoSourceReady:()=>{}}}[name]));
const videos=[1,2,3,4,5,6,7,8].map(id=>({id:String(id),url:'mp4-'+id,hls_url:'hls-'+id,thumbnail_url:'cover-'+id}));let active=0,suspended=false,result;
function render(){let count=0;while(dirty){assert.ok(++count<20,'Hook render loop');dirty=false;cursor=0;pending=[];result=hook.useVideoPreload(videos,active,true,suspended);for(const effect of pending)effect();}}
function tick(){for(const fn of [...timers])fn();render();}
render();assert.equal(players.length,1);assert.equal(result.get('1').player,players[0]);assert.equal(prefetched.length,3,'Do not flood the first playback with distant image downloads');
players[0].emit('readyToPlay',1);render();tick();assert.equal(players.length,1,'Do not preload ahead with one second of buffer');
players[0].bufferedPosition=3;tick();assert.equal(players.length,2,'Prepare the immediate next video with three seconds buffered');players[0].bufferedPosition=8;tick();assert.equal(players.length,3,'At most two neighbors load concurrently');
players[1].emit('readyToPlay',0.5);render();tick();assert.equal(players.length,3,'Ready to play is not the same as eight seconds preloaded; keep two downloads');
players[1].bufferedPosition=8;tick();assert.equal(players.length,4,'Fill the next slot after a neighbor has eight seconds buffered');
players[0].emit('loading',0.5);tick();assert.equal(players[0].released,false,'Keep active player when signal drops');assert.equal(players[1].released,false,'Keep already-ready neighbor for quick return');assert.ok(players[2].released&&players[3].released,'Cancel pending competing downloads while active buffers');assert.equal(result.size,2);
players[0].emit('readyToPlay',10);tick();
for(let i=0;i<6;i++){for(const player of players.filter(p=>!p.released&&p.status==='loading'))player.emit('readyToPlay',8);render();tick();}
assert.equal(result.size,6,'Keep current and five prepared future videos');
assert.ok([...result.values()].every(entry=>entry.player.bufferOptions.preferredForwardBufferDuration>=8));
const next=result.get('2').player;active=1;dirty=true;render();tick();assert.equal(result.get('2').player,next,'Swiping reuses the already-loaded next player');assert.equal(result.get('1').player,players[0],'Keep previous for immediate return');assert.ok(result.size<=7,'Bound native handles to current, previous and five next');
next.emit('error',0,'Network timeout');render();assert.deepEqual(next.sources,['hls-2'],'Keep HLS on transient network error');
next.emit('error',0,'HTTP 404');render();assert.deepEqual(next.sources,['hls-2','mp4-2'],'MP4 fallback only when HLS is unavailable');
assert.equal(prefetched.length,new Set(prefetched).size,'Repeated readiness updates do not redownload covers');
for(const effect of effects)effect?.cleanup?.();assert.ok(players.every(p=>p.released),'Release native players on unmount');assert.equal(timers.size,0);
console.log('PASS: preload lifecycle, buffer recovery, background cancellation, HLS error policy and unmount cleanup. Simulated native handles; no network.');
