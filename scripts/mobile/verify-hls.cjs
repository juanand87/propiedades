// Generate/decode real HLS and test API authorization in the isolated local DB.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),root=path.resolve(__dirname,'../..');
const {DataSource}=require(path.join(root,'backend/node_modules/typeorm'));
const {ConfigService}=require(path.join(root,'backend/node_modules/@nestjs/config'));
const {VideoHlsService}=require(path.join(root,'backend/dist/estate/video-hls.service'));
const ffmpeg=require(path.join(root,'backend/node_modules/ffmpeg-static'));
const ffprobe=require(path.join(root,'backend/node_modules/ffprobe-static')).path;
const base='http://127.0.0.1:3328',apiBase=base+'/api';let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function call(route,{token,body,method='GET',status=200}={}){const form=body instanceof FormData;const r=await fetch(apiBase+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,status,route+': '+JSON.stringify(value).slice(0,250));checks++;return value;}
async function resource(url,status=200){const r=await fetch(url);assert.equal(r.status,status,String(url).split('?')[0]);checks++;return r;}
async function main(){const db=new DataSource({type:'mariadb',host:'127.0.0.1',port:3327,username:'root',database:'propiedades',synchronize:false,extra:{multipleStatements:true}});await db.initialize();try{
 const [env]=await db.query('SELECT @@datadir d,@@port p');assert.equal(Number(env.p),3327);assert.ok(env.d.replaceAll('\\','/').toLowerCase().includes('/propiedades/tmp/mobile-local/mysql-data'));
 const migration=await fs.readFile(path.join(root,'database/VIDEOS_HLS.sql'),'utf8');await db.query(migration);await db.query(migration);
 const out=path.join(root,'tmp/hls-qa');await fs.mkdir(out,{recursive:true});const fixture=path.join(out,'portrait.mp4');
 await exec(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','testsrc2=size=720x1280:rate=15','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','6','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','34','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-y',fixture],{timeout:30000,windowsHide:true});
 const suffix=Date.now(),password=randomBytes(24).toString('base64url');async function register(kind){return call('/auth/register',{method:'POST',status:201,body:{email:`qa-hls-${kind}-${suffix}@qa.invalid`,password,firstName:'QA HLS '+kind,lastName:'Local'}});}
 const a=await register('A'),b=await register('B'),token=a.access_token;
 const form=new FormData();form.append('file',new Blob([await fs.readFile(fixture)],{type:'video/mp4'}),'hls.mp4');form.append('title','QA HLS portrait');form.append('request_id',randomUUID());
 const video=await call('/manage/videos',{method:'POST',status:201,token,body:form});
 const config=new ConfigService({NODE_ENV:'development',PROJECT_ID:'propiedades',DB_DATABASE:'propiedades',DB_HOST:'127.0.0.1',DB_PORT:'3327',PROPERTY_VIDEOS_ENABLED:'true'});
 const hls=new VideoHlsService(db,config,{enabled:false},{},{});
 const initial=await call('/manage/videos/'+video.id+'/preview',{token});check(!initial.hls_url,'MP4 available while HLS is pending');
 await hls.processNext(video.id);const [job]=await db.query('SELECT * FROM property_video_hls WHERE video_id=?',[video.id]);check(job.status==='ready','Real encoder finishes durable HLS job');
 const metadata=JSON.parse(job.metadata_json);check(metadata.renditions.length===3,'Three real video qualities');
 await hls.processNext(video.id);const [stable]=await db.query('SELECT generation_id FROM property_video_hls WHERE video_id=?',[video.id]);check(stable.generation_id===job.generation_id,'Ready video is not re-encoded');
 await db.query(migration);const [preserved]=await db.query('SELECT status FROM property_video_hls WHERE video_id=?',[video.id]);check(preserved.status==='ready','Repeating migration preserves ready streams');
 const preview=await call('/manage/videos/'+video.id+'/preview',{token});check(!!preview.hls_url,'Owner gets signed HLS preview');
 await call('/manage/videos/'+video.id+'/preview',{token:b.access_token,status:403});
 const masterUrl=new URL(preview.hls_url,base);await resource(new URL(`/api/videos/${video.id}/hls/master.m3u8`,base),404);
 const forged=new URL(masterUrl);forged.searchParams.set('signature','bad');await resource(forged,401);
 const wrongGeneration=new URL(masterUrl);wrongGeneration.searchParams.set('v',randomUUID());await resource(wrongGeneration,404);
 const master=await(await resource(masterUrl)).text();const variants=master.trim().split('\n').filter(line=>line&&!line.startsWith('#'));check(variants.length===3,'Master advertises all qualities');
 for(const variant of variants){const variantUrl=new URL(variant,masterUrl);const text=await(await resource(variantUrl)).text();check(text.includes('#EXT-X-ENDLIST'),'Finite VOD playlist');const segments=text.trim().split('\n').filter(line=>line&&!line.startsWith('#'));check(segments.length===3,'Two-second chunks for six-second clip');
  const bytes=Buffer.from(await(await resource(new URL(segments[0],variantUrl))).arrayBuffer());const sample=path.join(out,variant.split('/')[0]+'.ts');await fs.writeFile(sample,bytes);
  const {stdout}=await exec(ffprobe,['-v','error','-show_streams','-of','json',sample],{timeout:15000,windowsHide:true});const streams=JSON.parse(stdout).streams,track=streams.find(s=>s.codec_type==='video');
  const expected=metadata.renditions.find(r=>variant.startsWith(r.quality+'/'));check(track.width===expected.width&&track.height===expected.height,'Encoded dimensions agree with manifest');check(track.width/track.height===9/16&&track.sample_aspect_ratio==='1:1','Portrait video is not stretched');check(streams.some(s=>s.codec_name==='aac'),'Audio is included in each quality');
  await exec(ffmpeg,['-nostdin','-v','error','-i',sample,'-f','null','-'],{timeout:15000,windowsHide:true});checks++;
 }
 const variant=new URL(variants[0],masterUrl);const invalid=new URL('seg99999.ts'+variant.search,variant);await resource(invalid,404);
 await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'published'}});
 const feed=await call('/videos?video_id='+video.id);check(!!feed.items[0].hls_url&&feed.items[0].url.endsWith('/content'),'Feed offers HLS and original MP4');await resource(new URL(feed.items[0].hls_url,base));
 const mp4=await fetch(base+feed.items[0].url,{headers:{Range:'bytes=0-99'}});check(mp4.status===206&&(await mp4.arrayBuffer()).byteLength===100,'MP4 progressive fallback remains available');
 await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'draft'}});await resource(new URL(feed.items[0].hls_url,base),404);await resource(masterUrl);
 await call('/manage/videos/'+video.id,{method:'PATCH',token,body:{status:'archived'}});await resource(masterUrl,404);await hls.processNext(video.id);
 const rows=await db.query('SELECT video_id FROM property_video_hls WHERE video_id=?',[video.id]);check(!rows.length,'Archive cleans HLS job');
 check(!(await fs.stat(path.join(root,'tmp/mobile-hls',video.id,job.generation_id)).catch(()=>null)),'Archive removes local generated segments');
 console.log(`PASS: ${checks} real HLS encoding/playback/access checks. Local DB only; production connections: 0.`);
}finally{await db.destroy();}}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
