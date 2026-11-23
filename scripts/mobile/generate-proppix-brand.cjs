// Vector-native brand assets; no external image service or private source files.
const fs=require('node:fs/promises'),path=require('node:path'),sharp=require('../../backend/node_modules/sharp');
const mark='<path d="M14 87V29Q14 12 32 12H57Q86 12 86 41Q86 69 57 69H33V87Q33 94 24 94H22Q14 94 14 87Z" fill="#071c55"/><rect x="33" y="27" width="14" height="14" rx="3.5" fill="white"/><rect x="51" y="27" width="14" height="14" rx="3.5" fill="#05b9e7"/><rect x="33" y="45" width="14" height="14" rx="3.5" fill="white"/><rect x="51" y="45" width="14" height="14" rx="3.5" fill="white"/>';
const svg=inner=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;
async function png(name,inner,size=1024){await sharp(Buffer.from(svg(inner))).resize(size,size).png().toFile(path.resolve(__dirname,'../../mobile/assets',name));}
(async()=>{
 await fs.writeFile(path.resolve(__dirname,'../../mobile/assets/proppix-mark.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${mark}</svg>`);
 const symbol=`<g transform="translate(172 152) scale(6.8)">${mark}</g>`;
 await png('icon.png',`<rect width="1024" height="1024" rx="220" fill="#fff"/>${symbol}`);
 await png('android-icon-foreground.png',symbol);
 await png('favicon.png',`<rect width="1024" height="1024" rx="220" fill="#fff"/>${symbol}`,64);
 await png('splash-logo.png',`<g transform="translate(292 130) scale(4.4)">${mark}</g><text x="512" y="710" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="138" font-weight="800" letter-spacing="-5" fill="#071c55">Propp<tspan fill="#05b9e7">i</tspan>x</text>`);
 console.log('Generated Proppix vector, launcher icons and native splash logo.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
