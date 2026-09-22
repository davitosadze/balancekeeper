// Focused Phase 4 interaction/timing checks; Playwright is supplied externally.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const configs = require('../src/data/levels/campaign/campaign-v1.json');
const base = process.env.GAMEPLAY_URL || 'http://localhost:8081';
const output = path.resolve(__dirname,'../artifacts/gameplay');fs.mkdirSync(output,{recursive:true});
async function run(browser,reducedMotion) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:reducedMotion?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('balance-keeper-progress'))localStorage.setItem('balance-keeper-progress',JSON.stringify({state:{progress:{coins:1000,highestUnlockedLevel:50,unlockedLevels:[1],levelProgress:{},transactions:{},bestScore:0,levelsCompleted:0,totalPlaytimeSeconds:0}},version:0}));
    localStorage.setItem('balance-keeper-settings',JSON.stringify({soundEnabled:false,hapticsEnabled:false,volume:80}));
    window.__soundPlays=[];
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){window.__soundPlays.push({src:this.src,volume:this.volume});return original.call(this);};
  });
  const bottle=i=>page.getByTestId(`bottle-station-${i}`);
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('balance-keeper-progress')).state);
  const dismiss=async()=>{const coach=page.getByTestId('tutorial-coach');if(await coach.count())await coach.click();};
  const open=async id=>{await page.goto(`${base}/level-select`);await page.getByTestId('level-grid').evaluate((el,row)=>{el.scrollTop=row*104;},Math.floor((id-1)/4));const b=page.getByRole('button',{name:`Level ${id}, ${configs[id-1].name}`,exact:true});await b.scrollIntoViewIfNeeded();await b.click({force:true});await bottle(0).waitFor();await page.waitForTimeout(80);await dismiss();};
  const select=async id=>{const weight=page.getByTestId(`weight-slot-${id}`);await weight.scrollIntoViewIfNeeded();await weight.click();};
  const place=async(id,index=0)=>{await select(id);await bottle(index).click();await page.waitForTimeout(300);};
  await open(10);assert.equal(await page.getByTestId('gameplay-feedback').innerText(),'MILESTONE');
  await page.waitForTimeout(1050);
  await place('w1');assert(!/x1/.test(await page.getByTestId('gameplay-feedback').innerText()));
  await place('w2');assert.equal(await page.getByTestId('gameplay-feedback').innerText(),'NICE! x2');
  const banner=await page.getByTestId('gameplay-feedback').boundingBox(),glass=await bottle(0).boundingBox();assert(banner.y+banner.height<glass.y);
  await page.screenshot({path:`${output}/phase4-combo-${reducedMotion?'reduced':'motion'}.png`});
  await place('w3',1);assert.match(await page.getByTestId('gameplay-feedback').innerText(),/GREAT!.*x3/);
  await place('w4',1);assert.match(await page.getByTestId('gameplay-feedback').innerText(),/AMAZING!.*x4/);
  await place('w5',2);assert.match(await page.getByTestId('gameplay-feedback').innerText(),/BALANCE MASTER!.*x5/);
  await select('w6');const started=Date.now();await bottle(2).click();
  await page.getByRole('button',{name:'CONTINUE',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=button]')).some(b=>b.textContent==='CONTINUE'&&b.getAttribute('aria-disabled')!=='true'));
  const elapsed=Date.now()-started;assert(elapsed<2300,`Result actionable in ${elapsed}ms`);
  assert.equal((await stored()).attempt.moves,6);assert.deepEqual((await stored()).attempt.effects,[]);
  await open(8);await place('w5');await dismiss();
  assert.equal(await page.getByTestId('gameplay-feedback').innerText(),'TOO HEAVY');
  await place('w5');await dismiss();await select('w5');
  await page.evaluate(()=>{
    window.__breakStarted=0;window.__breakShown=0;
    document.querySelector('[data-testid="bottle-station-0"]').addEventListener('click',()=>{window.__breakStarted=performance.now();},{once:true,capture:true});
    const observer=new MutationObserver(()=>{if(document.body.textContent.includes('BOTTLE BROKEN')){window.__breakShown=performance.now();observer.disconnect();}});
    observer.observe(document.body,{childList:true,subtree:true});
  });
  await bottle(0).click();
  await page.waitForTimeout(120);assert.equal(await page.getByText('BOTTLE BROKEN',{exact:true}).count(),0);
  await page.waitForTimeout(160); // Move checkpoints are deferred; UI loss is already visible in the bottle.
  assert.equal((await stored()).attempt.status,'lost');
  await page.screenshot({path:`${output}/phase4-break-${reducedMotion?'reduced':'motion'}.png`});
  await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor();const breakDelay=await page.evaluate(()=>Math.round(window.__breakShown-window.__breakStarted));assert(breakDelay>=400&&breakDelay<850,`Break reveal ${breakDelay}ms`);
  await open(41);await place('w3',1);assert.equal((await stored()).attempt.mistakes,0);
  await place('w1');await place('w2');assert(!/locked/.test(await bottle(1).getAttribute('aria-label')));
  await page.screenshot({path:`${output}/phase4-unlock-${reducedMotion?'reduced':'motion'}.png`});
  await page.waitForTimeout(1000);
  assert.deepEqual(await page.evaluate(()=>window.__soundPlays.filter(p=>p.volume>0)),[],'Muted settings must prevent audible effects');
  assert.deepEqual(errors,[]);
  console.log(`PASS Phase 4 ${reducedMotion?'reduced motion':'normal motion'}: tiers, challenge, fit, lock, muted audio, break ${breakDelay}ms, actionable win ${elapsed}ms`);
  await page.close();
}
(async()=>{const browser=await chromium.launch({headless:true});try{await run(browser,false);await run(browser,true);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
