// Run against the local Expo web build with an externally supplied Playwright module.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.GAMEPLAY_URL||'http://localhost:8081';
const output=path.resolve(__dirname,'../artifacts/performance-ui');fs.mkdirSync(output,{recursive:true});
async function run(browser,width,height){
 const page=await browser.newPage({viewport:{width,height}}),errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(/\.(webp|png|jpeg)(\?|$)/.test(r.url()))requests.push(r.url());});
 await page.addInitScript(()=>{
  window.__BALANCE_PERF__={renders:{},drops:[]};window.__writes=[];
  const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){window.__writes.push({key:k,at:performance.now()});return write.call(this,k,v);};
  if(!localStorage.getItem('balance-keeper-progress'))localStorage.setItem('balance-keeper-progress',JSON.stringify({state:{progress:{coins:4000,highestUnlockedLevel:50,unlockedLevels:[1],levelProgress:{},transactions:{},levelsCompleted:0}},version:0}));
  if(!localStorage.getItem('balance-keeper-settings'))localStorage.setItem('balance-keeper-settings',JSON.stringify({soundEnabled:false,hapticsEnabled:false,volume:80}));
 });
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('balance-keeper-progress')).state);
 const capture=async name=>page.screenshot({path:`${output}/${name}-${width}.png`});
 const dismiss=async()=>{const coach=page.getByTestId('tutorial-coach');if(await coach.count())await coach.click();};
 const openLevel=async id=>{await page.goto(`${base}/level-select`);await page.getByTestId(`level-tile-${id}`).click();await page.getByTestId('bottle-station-0').waitFor();await page.getByText('Setting the table…',{exact:true}).waitFor({state:'hidden'});await dismiss();};
 await page.goto(`${base}/level-select`);await page.getByTestId('level-tile-1').waitFor();await page.waitForTimeout(350);
 const row=await Promise.all([1,2,3,4].map(i=>page.getByTestId(`level-tile-${i}`).boundingBox()));assert(row.every(r=>Math.abs(r.y-row[0].y)<1));assert(row[3].x+row[3].width<=width);
 assert(!requests.some(url=>url.includes('/runtime/')&&url.includes('-bg')),'Levels must only request thumbnails');await capture('levels');
 await page.goto(`${base}/settings`);await page.getByRole('switch',{name:'Reduced Motion',exact:true}).click();await page.getByRole('switch',{name:'Sound Effects',exact:true}).click();await page.getByRole('button',{name:'Decrease volume',exact:true}).click();await page.waitForTimeout(150);
 const settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('balance-keeper-settings')));assert.equal(settings.reducedMotion,true);assert.equal(settings.soundEnabled,true);assert.equal(settings.volume,70);await capture('settings');await page.reload();await page.getByRole('switch',{name:'Reduced Motion',exact:true}).waitFor();assert.equal(await page.getByRole('switch',{name:'Reduced Motion',exact:true}).getAttribute('aria-checked'),'true');await page.getByRole('switch',{name:'Reduced Motion',exact:true}).click();await page.getByRole('switch',{name:'Sound Effects',exact:true}).click();
 await page.goto(`${base}/shop`);await page.getByTestId('shop-card-bottle_classic').waitFor();const beforeShop=requests.length;
 await page.getByRole('tab',{name:'Backgrounds',exact:true}).click();await page.getByTestId('shop-card-background_workshop').waitFor();await page.waitForTimeout(200);assert(!requests.slice(beforeShop).some(url=>url.includes('/runtime/')&&url.includes('-bg')),'Shop grid must use background thumbnails');await capture('shop-backgrounds');
 for(const tab of ['Weights','Bottles','Backgrounds','Weights'])await page.getByRole('tab',{name:tab,exact:true}).click();assert.equal(await page.locator('[data-testid^="preview-weight_"] img').count(),0);
 await page.getByTestId('shop-card-weight_wood').click();await page.getByRole('button',{name:'Buy Wood',exact:true}).click();await page.getByRole('button',{name:'Wood, Equipped',exact:true}).waitFor();await page.waitForTimeout(350);assert.equal((await saved()).progress.coins,3500);await capture('shop-weights');
 await openLevel(8);await page.waitForTimeout(350);
 const bottle=page.getByTestId('bottle-station-0'),tray=page.getByTestId('weight-tray'),bg=page.getByTestId('scene-background-image').last();
 const geometry=async()=>({bottle:await bottle.boundingBox(),tray:await tray.boundingBox(),background:await bg.boundingBox()});const initial=await geometry();
 await bg.evaluate(node=>window.__backgroundNode=node);
 await page.evaluate(()=>{window.__BALANCE_PERF__.renders={};window.__writes=[];});
 // Repeated selection never checkpoints or serializes gameplay.
 for(let i=0;i<6;i++)await page.getByTestId('weight-slot-w1').click();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>window.__writes.filter(w=>w.key==='balance-keeper-progress').length),0);
 assert.equal(await page.evaluate(()=>window.__BALANCE_PERF__.renders.background??0),0);
 const slot=await page.getByTestId('weight-slot-w1').boundingBox(),dest=await bottle.boundingBox();
 await page.mouse.move(slot.x+slot.width/2,slot.y+slot.height/2);await page.mouse.down();await page.waitForTimeout(50);
 await page.evaluate(()=>{window.__BALANCE_PERF__.renders={};window.__frames=[];let last=performance.now();window.__raf=requestAnimationFrame(function tick(now){window.__frames.push(now-last);last=now;window.__raf=requestAnimationFrame(tick);});});
 const dragRendersBefore=await page.evaluate(()=>window.__BALANCE_PERF__.renders.gameplay??0);
 await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height*.5,{steps:35});
 const dragRenders=await page.evaluate(()=>window.__BALANCE_PERF__.renders.gameplay??0)-dragRendersBefore;
 assert(dragRenders<10,`35 drag updates caused ${dragRenders} Gameplay renders`);
 await page.mouse.up();await page.waitForTimeout(400);
 await page.evaluate(()=>cancelAnimationFrame(window.__raf));assert.equal((await saved()).attempt.moves,1);assert.deepEqual(await geometry(),initial);assert.equal(await tray.locator('img').count(),0);assert.equal(await bottle.getByTestId('code-ball').count(),1);
 await capture('gameplay');const beforeDamage=requests.length;
 for(let i=1;i<=3;i++){await page.getByTestId('weight-slot-w5').click();await bottle.click();await page.waitForTimeout(330);assert.equal((await saved()).attempt.tubes[0].damage,i);assert.deepEqual(await geometry(),initial);await dismiss();}
 await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor();assert.equal(await bg.evaluate(node=>node===window.__backgroundNode),true);
 assert(!requests.slice(beforeDamage).some(url=>/bottle-(crack|broken)/.test(url)),'Damage must already be decoded/cached');await capture('failed');
 await page.getByRole('button',{name:'CONTINUE · 150 COINS',exact:true}).click();await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor({state:'hidden'});await page.waitForTimeout(430);assert.equal((await saved()).attempt.revivesUsed,1);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'RESTART LEVEL',exact:true}).click();await page.waitForTimeout(350);await dismiss();assert.equal((await saved()).attempt.moves,0);
 const gameplayMetrics=await page.evaluate(()=>({renders:window.__BALANCE_PERF__.renders,drops:window.__BALANCE_PERF__.drops,frames:window.__frames}));
 await openLevel(1);await page.getByTestId('weight-slot-w1').click();await page.getByTestId('bottle-station-0').click();
 await page.getByRole('button',{name:'CONTINUE',exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role="button"]')].some(b=>b.textContent==='CONTINUE'&&b.getAttribute('aria-disabled')!=='true'));await capture('complete');
 const start=Date.now();await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await page.getByText('Level 2',{exact:true}).waitFor();await page.getByText('Setting the table…',{exact:true}).waitFor({state:'hidden'});const nextMs=Date.now()-start;assert(nextMs<2000);await dismiss();
 // Solve, then replay the second level and verify the same config is ready immediately.
 for(const id of ['w1','w2']){await page.getByTestId(`weight-slot-${id}`).click();await page.getByTestId('bottle-station-0').click();}
 await page.getByRole('button',{name:'REPLAY',exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role="button"]')].some(b=>b.textContent==='REPLAY'&&b.getAttribute('aria-disabled')!=='true'));
 await page.getByRole('button',{name:'REPLAY',exact:true}).click();await page.getByText('Level 2',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 const sorted=gameplayMetrics.frames.sort((a,b)=>a-b);const result={width,height,dragRenders,nextMs,dropDispatchMs:gameplayMetrics.drops,dragFrameP95:sorted[Math.floor(sorted.length*.95)],renders:gameplayMetrics.renders};
 fs.writeFileSync(`${output}/metrics-${width}.json`,JSON.stringify(result,null,2));console.log('PASS',JSON.stringify(result));await page.close();
}
(async()=>{const browser=await chromium.launch({headless:true});try{for(const [w,h]of[[320,568],[390,844],[430,932]])await run(browser,w,h);}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
