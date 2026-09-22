// Phase 3 campaign browser checks. Supply Playwright externally, as in previous phases.
require('./register-typescript.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const configs = require('../src/data/levels/campaign/campaign-v1.json');
const { normalizeLevel } = require('../src/domain/levelConfig.ts');
const { solveLevel } = require('../src/domain/levels/solver.ts');
const baseURL = process.env.GAMEPLAY_URL || 'http://localhost:8081';
const output = path.resolve(__dirname,'../artifacts/gameplay');
fs.mkdirSync(output,{recursive:true});
const wait = page => page.waitForTimeout(430);
function controls(page) {
  const bottle = i => page.getByTestId(`bottle-station-${i}`);
  const stored = () => page.evaluate(()=>JSON.parse(localStorage.getItem('balance-keeper-progress')).state);
  const dismiss = async () => { const coach=page.getByTestId('tutorial-coach'); if(await coach.count())await coach.click(); };
  const weight = id => page.getByTestId(`weight-slot-${id}`);
  const select = async id => { await weight(id).scrollIntoViewIfNeeded(); await wait(page); await weight(id).click(); };
  const place = async (id,index=0) => { await select(id); await bottle(index).click(); await wait(page); };
  const scene = async () => ({ background:await page.locator('img[src*="gameplay-bg"]').first().boundingBox(), bottle:await bottle(0).boundingBox(),tray:await page.getByTestId('weight-tray').boundingBox() });
  const open = async id => {
    await page.goto(`${baseURL}/level-select`);
    const cfg=configs[id-1]; const button=page.getByRole('button',{name:`Level ${id}, ${cfg.name}`,exact:true});
    await button.evaluate(element => element.scrollIntoView({block:"center"})); await button.click({force:true}); await bottle(0).waitFor(); await wait(page);
  };
  const solve = async id => {
    const config=configs[id-1], result=solveLevel(normalizeLevel(config));
    for (const move of result.solution) await place(move.weightId,config.bottles.findIndex(b=>b.id===move.bottleId));
    await page.getByText('LEVEL COMPLETE',{exact:true}).waitFor(); await page.waitForTimeout(1700);
    return result;
  };
  return {bottle,stored,dismiss,weight,select,place,scene,open,solve};
}
async function firstInstall(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844}}),c=controls(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${baseURL}/level-select`);
  await page.getByRole('button',{name:'Level 2, locked',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/^Level \d+,/}).count(),50);
  await c.open(1); await page.getByTestId('tutorial-coach').waitFor(); await c.dismiss();
  const target=await c.bottle(0).boundingBox(),from=await c.weight('w1').boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:20});await page.mouse.up();
  await page.getByText('LEVEL COMPLETE',{exact:true}).waitFor();
  await page.getByLabel('Coins: 0 to 60',{exact:true}).waitFor();await page.waitForTimeout(1700);
  await page.reload();await page.getByText('LEVEL COMPLETE',{exact:true}).waitFor();await page.waitForTimeout(1700);
  assert.equal((await c.stored()).progress.coins,60);
  await page.getByRole('button',{name:'CONTINUE',exact:true}).dblclick();await c.bottle(0).waitFor();await wait(page);await c.dismiss();
  await c.solve(2); assert.equal((await c.stored()).progress.coins,122);assert.equal((await c.stored()).progress.highestUnlockedLevel,3);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS new 50-level map, teaching overlay, real drag, unlock, persistent reward, reload and duplicate Continue');
  await page.close();
}
async function campaign(browser,width,height) {
  const page=await browser.newPage({viewport:{width,height}}),c=controls(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('balance-keeper-progress'))localStorage.setItem('balance-keeper-progress',JSON.stringify({state:{progress:{coins:1000,highestUnlockedLevel:50,unlockedLevels:[1],levelProgress:{},transactions:{},bestScore:0,levelsCompleted:0,totalPlaytimeSeconds:0}},version:0}));
  });
  await c.open(6);assert.match(await page.getByTestId('tutorial-coach').innerText(),/Target is what you need/);await c.dismiss();
  let initial=await c.scene();await c.place('w2');await c.place('w4');
  assert.equal((await c.stored()).attempt.tubes[0].currentWeight,14);assert.equal((await c.stored()).attempt.tubes[0].damage,0);
  assert.match(await page.getByTestId('tutorial-coach').innerText(),/Use Undo/);assert.deepEqual(await c.scene(),initial);
  await c.dismiss();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(page);assert.deepEqual(await c.scene(),initial);
  await c.open(8);await c.dismiss();initial=await c.scene();await c.place('w5');assert.equal((await c.stored()).attempt.tubes[0].damage,1);
  await c.dismiss();await c.place('w5');await c.place('w5');
  await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor();assert.deepEqual(await c.scene(),initial);
  await page.getByRole('button',{name:'CONTINUE · 150 COINS',exact:true}).dblclick();await wait(page);
  assert.equal((await c.stored()).progress.coins,850);assert.equal((await c.stored()).attempt.tubes[0].damage,2);
  await c.open(21);assert.match(await page.getByTestId('tutorial-coach').innerText(),/does not end/);await c.dismiss();
  await page.getByText('Moves 0 · Goal 5',{exact:true}).waitFor();await c.solve(21);
  await c.open(31);assert.match(await page.getByTestId('tutorial-coach').innerText(),/Fragile/);await c.dismiss();
  const fragConfig=configs[30],fragIndex=fragConfig.bottles.findIndex(b=>b.type==='fragile');
  assert.match(await c.bottle(fragIndex).getAttribute('aria-label'),/fragile/);
  for(const move of fragConfig.intendedSolution.filter(m=>m.bottleId===fragConfig.bottles[fragIndex].id))await c.place(move.weightId,fragIndex);
  for(const b of (await c.stored()).attempt.tray) {await c.place(b.id,fragIndex);if((await c.stored()).attempt.status==='lost')break;}
  await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor();assert.equal((await c.stored()).attempt.tubes[fragIndex].damage,1);
  await c.open(41);await c.dismiss();initial=await c.scene();
  await page.getByRole('button',{name:'Bottle 2, locked until bottle 1 is solved',exact:true}).waitFor();
  await c.place('w3',1);assert.equal((await c.stored()).attempt.moves,0);assert.equal((await c.stored()).attempt.mistakes,0);
  await c.place('w1');await c.place('w2');assert(!/locked/.test(await c.bottle(1).getAttribute('aria-label')));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(page);
  assert.match(await c.bottle(1).getAttribute('aria-label'),/locked until bottle 1/);assert.deepEqual(await c.scene(),initial);
  await c.open(50);await c.dismiss();await wait(page);initial=await c.scene();
  assert.equal(await page.getByTestId(/bottle-station-/).count(),5);
  const actions=await page.getByTestId('gameplay-actions').boundingBox();
  assert(initial.bottle.width>=44);assert(initial.bottle.y+initial.bottle.height<=initial.tray.y);
  assert(initial.tray.y+initial.tray.height<=actions.y);assert(actions.y+actions.height<=height);
  await page.screenshot({path:`${output}/phase3-level50-${width}.png`});
  const solution=solveLevel(normalizeLevel(configs[49])).solution;
  for(let i=0;i<solution.length;i++){
    const move=solution[i];await c.place(move.weightId,configs[49].bottles.findIndex(b=>b.id===move.bottleId));
    if(i<solution.length-1)assert.deepEqual(await c.scene(),initial,'Placement/paging must not move the background');
  }
  await page.getByText('BALANCE MASTER',{exact:true}).waitFor();await page.getByLabel('3 of 3 stars earned',{exact:true}).waitFor();await page.waitForTimeout(1700);
  assert.equal((await c.stored()).attempt.moves,9);assert.equal((await c.stored()).progress.highestUnlockedLevel,51);
  await page.screenshot({path:`${output}/phase3-milestone50-${width}.png`});
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();
  await page.getByText('Select Level',{exact:true}).last().waitFor();assert.equal(errors.length,0,errors.join('\n'));
  console.log(`PASS ${width}x${height}: capacity, cracks/revive, move goals, fragile, locks/Undo, five-bottle boss, pagination and stable background`);
  await page.close();
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{await firstInstall(browser);for(const [w,h] of [[320,568],[390,844],[430,932]])await campaign(browser,w,h);}
  finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
