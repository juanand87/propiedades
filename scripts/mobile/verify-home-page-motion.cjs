const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'mobile/node_modules/typescript'));
function load(file,dependencies){const context={exports:{},require:name=>dependencies[name]};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'mobile/src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);return context.exports;}
const motion=load('home-page-motion.ts',{});let config,values=[],styles=[],effects=[],navigations=0;
function shared(initial){let current=initial,animation;const value={get:()=>current,set:next=>{if(next&&typeof next==='object'&&'target' in next)animation=next;else current=next;},cancel:()=>{const old=animation;animation=null;old?.callback?.(false);},finish:()=>{const old=animation;animation=null;if(old){current=old.target;old.callback?.(true);}},target:()=>animation?.target};values.push(value);return value;}
const jsx=(type,props)=>({type,props});
const {HomePager}=load('HomePager.tsx',{
  react:{useEffect:fn=>effects.push(fn)},'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-native':{useWindowDimensions:()=>({width:400}),View:'View',StyleSheet:{create:s=>s}},
  'react-native-gesture-handler':{GestureDetector:'Detector',usePanGesture:c=>{config=c;return c;}},
  'react-native-worklets':{scheduleOnRN:fn=>fn()},
  'react-native-reanimated':{default:{View:'AnimatedView'},cancelAnimation:v=>v.cancel(),Easing:{out:x=>x,cubic:1},useSharedValue:shared,useAnimatedStyle:fn=>{styles.push(fn);return fn;},withTiming:(target,options,callback)=>({target,options,callback})},
  './home-page-motion':motion,
});
HomePager({page:'feed',enabled:true,scrollGesture:{},feed:'feed',catalog:'catalog',onCatalog:()=>navigations++});
effects.forEach(fn=>fn());const progress=values[0];progress.finish();
function drag(x,y=0,velocity=-100,canceled=false){config.onActivate();config.onUpdate({translationX:x,translationY:y});config.onDeactivate({translationX:x,translationY:y,velocityX:velocity,canceled});}
config.onActivate();config.onUpdate({translationX:-160,translationY:0});
assert.equal(styles[0]().transform[0].translateX,-160,'Outgoing page follows finger');
assert.equal(styles[1]().transform[0].translateX,240,'Incoming page follows at same speed');
config.onDeactivate({translationX:-160,translationY:0,velocityX:-100,canceled:false});
assert.equal(progress.target(),1);assert.equal(navigations,0,'Route must not change before animation completes');progress.finish();assert.equal(navigations,1,'Commit once after animation completes');
progress.set(0);drag(-45);assert.equal(progress.target(),0,'Short gesture returns to Inicio');progress.finish();assert.equal(navigations,1);
drag(-40,0,-900);assert.equal(progress.target(),1,'Fast deliberate flick may complete');progress.finish();assert.equal(navigations,2);
progress.set(0);drag(-240,0,-900,true);assert.equal(progress.target(),0,'Canceled gesture rolls back');progress.finish();assert.equal(navigations,2);
drag(-50,-180);assert.equal(progress.target(),0,'Vertical scroll must not navigate');progress.finish();assert.equal(navigations,2);
drag(-180);progress.cancel();assert.equal(navigations,2,'Interrupted animation cannot commit a stale route');
config.onUpdate({translationX:-1000,translationY:0});assert.equal(progress.get(),1,'Cannot drag past Propiedades');
config.onUpdate({translationX:1000,translationY:0});assert.equal(progress.get(),0,'Cannot drag past Inicio');
console.log('PASS: coupled page positions, deferred route commit, short/fast/canceled/vertical gestures, interrupted animation and bounds. Animation runtime simulated; no Android UI claim.');
