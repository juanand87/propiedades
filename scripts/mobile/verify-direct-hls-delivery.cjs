// Read-only production check. Never prints or persists signed URLs.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const origin='https://clownfish-app-2-bgbzm.ondigitalocean.app';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function get(url){const start=performance.now(),r=await fetch(url,{signal:AbortSignal.timeout(20000)}),headers=performance.now(),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);return {bytes,headers_ms:Math.round(headers-start),total_ms:Math.round(performance.now()-start),redirected:r.redirected};}
const median=items=>{const values=[...items].sort((a,b)=>a-b);return values[Math.floor(values.length/2)];};
(async()=>{
 const feed=JSON.parse((await get(origin+'/api/videos?limit=3')).bytes.toString());const rows=[];
 for(const video of feed.items){if(!video.hls_url)continue;
  const masterUrl=new URL(video.hls_url,origin),master=(await get(masterUrl)).bytes.toString();
  const variants=master.split(/\r?\n/).filter(line=>line&&!line.startsWith('#'));
  for(const variant of [...new Set([variants[0],variants.at(-1)])]){
   const variantUrl=new URL(variant,masterUrl),playlist=(await get(variantUrl)).bytes.toString();
   const line=playlist.split(/\r?\n/).find(line=>line&&!line.startsWith('#'));const direct=new URL(line);
   assert.equal(direct.protocol,'https:');assert.match(direct.hostname,/^[a-z0-9-]+\.[a-z0-9-]+\.digitaloceanspaces\.com$/);assert.match(direct.pathname,/\/q(360|540|720)\/seg\d{5}\.ts$/);
   assert.equal(direct.searchParams.get('X-Amz-Expires'),'900');
   const file=direct.pathname.split('/').at(-1),legacy=new URL(file+variantUrl.search,variantUrl);
   const fresh=(await get(variantUrl)).bytes.toString().split(/\r?\n/).find(line=>line&&!line.startsWith('#'));
   // Stable within a minute. Boundary changes are valid, so compare signing dates.
   if(new URL(fresh).searchParams.get('X-Amz-Date')===direct.searchParams.get('X-Amz-Date'))assert.equal(fresh,direct.href);
   const download=await get(direct),compatible=await get(legacy);
   assert.equal(download.redirected,false);assert.equal(compatible.redirected,true);
   assert.equal(digest(download.bytes),digest(compatible.bytes),'Original HLS quality must remain byte-for-byte identical');
   const unsigned=new URL(direct);unsigned.search='';const denied=await fetch(unsigned,{method:'HEAD',signal:AbortSignal.timeout(20000)});assert.ok([401,403,404].includes(denied.status),'Spaces objects remain private');
   rows.push({quality:direct.pathname.match(/\/(q\d+)\//)[1],bytes:download.bytes.length,sha256:digest(download.bytes),direct:{headers_ms:download.headers_ms,total_ms:download.total_ms},legacy:{headers_ms:compatible.headers_ms,total_ms:compatible.total_ms}});
  }
 }
 assert.ok(rows.length>=2);const result={measured_at:new Date().toISOString(),samples:rows.length,quality:'identical bytes',privacy:'unsigned requests denied',direct_segment_redirects:0,summary:Object.fromEntries(['direct','legacy'].map(stage=>[stage,{headers_median_ms:median(rows.map(r=>r[stage].headers_ms)),total_median_ms:median(rows.map(r=>r[stage].total_ms))}])),rows};
 await fs.writeFile(path.resolve(__dirname,'../../tmp/direct-hls-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
