const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const base=process.env.GAMEPLAY_URL||'http://localhost:8081',output=path.resolve(__dirname,'../artifacts/shop');fs.mkdirSync(output,{recursive:true});
async function run(browser,width,height){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{if(!localStorage.getItem('balance-keeper-progress'))localStorage.setItem('balance-keeper-progress',JSON.stringify({state:{progress:{coins:4000,highestUnlockedLevel:50,unlockedLevels:[1],levelProgress:{},transactions:{},levelsCompleted:0,bestScore:0,totalPlaytimeSeconds:0}},version:0}));});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('balance-keeper-progress')).state);
  const card=id=>page.getByTestId(`shop-card-${id}`);
  const clickCard=async id=>{await card(id).scrollIntoViewIfNeeded();await card(id).click();await page.waitForTimeout(350);};
  const buy=async(name,id)=>{await clickCard(id);await page.getByRole('button',{name:`Buy ${name}`,exact:true}).dblclick();await page.getByRole('button',{name:`${name}, Equipped`,exact:true}).waitFor();await page.waitForTimeout(350);};
  await page.goto(base);await page.getByRole('button',{name:'Shop',exact:true}).click();await card('bottle_classic').waitFor();
  const first=await card('bottle_classic').boundingBox(),second=await card('bottle_royal').boundingBox();assert(Math.abs(first.y-second.y)<2);assert(second.x>=first.x+first.width);
  await page.screenshot({path:`${output}/bottles-${width}.png`});
  await clickCard('bottle_royal');await page.getByRole('button',{name:'Preview cracked bottle',exact:true}).click();
  assert(await page.getByTestId('preview-bottle_royal').last().locator('img[src*="crack1"]').count());
  await page.screenshot({path:`${output}/preview-royal-${width}.png`});
  await page.getByRole('button',{name:'CANCEL',exact:true}).click();await page.waitForTimeout(350);assert.equal((await saved()).progress.equipped.bottleSkinId,'bottle_classic');assert.equal((await saved()).progress.coins,4000);
  await buy('Royal','bottle_royal');assert.equal((await saved()).progress.coins,3250);
  await clickCard('bottle_classic');await page.getByRole('button',{name:'Equip Classic Glass',exact:true}).click();await page.getByRole('button',{name:'Classic Glass, Equipped',exact:true}).waitFor();await page.waitForTimeout(350);
  await clickCard('bottle_royal');await page.getByRole('button',{name:'Equip Royal',exact:true}).click();await page.getByRole('button',{name:'Royal, Equipped',exact:true}).waitFor();await page.waitForTimeout(350);assert.equal((await saved()).progress.coins,3250);
  await page.getByRole('tab',{name:'Weights',exact:true}).click();await buy('Wood','weight_wood');assert.equal((await saved()).progress.coins,2750);
  await page.screenshot({path:`${output}/weights-${width}.png`});
  await page.getByRole('tab',{name:'Backgrounds',exact:true}).click();await page.waitForTimeout(250);await buy('Workshop','background_workshop');assert.equal((await saved()).progress.coins,1250);
  await page.getByRole('tab',{name:'Bottles',exact:true}).click();await clickCard('bottle_crystal');
  await page.getByText('Need 250 more coins',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Buy Crystal',exact:true}).isDisabled());await page.getByRole('button',{name:'CANCEL',exact:true}).click();await page.waitForTimeout(350);
  await page.reload();await card('bottle_royal').waitFor();await page.getByRole('button',{name:'Royal, Equipped',exact:true}).waitFor();
  const inventory=(await saved()).progress;assert.deepEqual(inventory.equipped,{bottleSkinId:'bottle_royal',weightSkinId:'weight_wood',backgroundId:'background_workshop'});
  assert.equal(Object.values(inventory.transactions).filter(t=>t.reason==='cosmetic_purchase').length,3);
  await page.goto(`${base}/level-select`);const level=page.getByRole('button',{name:'Level 8, The First Crack',exact:true});await level.evaluate(e=>e.scrollIntoView({block:'center'}));await level.click({force:true});
  const bottle=page.getByTestId('bottle-station-0');await bottle.waitFor();await page.waitForTimeout(500);await page.getByTestId('tutorial-coach').click();
  const scene=async()=>({background:await page.locator('img[src*="workshop-bg.webp"]:visible').last().boundingBox(),bottle:await bottle.boundingBox(),tray:await page.getByTestId('weight-tray').boundingBox()});
  const initial=await scene();assert(initial.background);assert(await page.getByTestId('weight-slot-w5').getByTestId('code-ball').count());
  await page.getByTestId('weight-slot-w1').click();await bottle.click();await page.waitForTimeout(400);assert(await bottle.getByTestId('code-ball').count());assert.deepEqual(await scene(),initial);
  await page.screenshot({path:`${output}/equipped-playing-${width}.png`});
  for(let i=1;i<=3;i++){
    await page.getByTestId('weight-slot-w5').click();await bottle.click();await page.waitForTimeout(650);
    assert.equal((await saved()).attempt.tubes[0].damage,i);
    const asset=i===1?'crack1':i===2?'crack2':'broken';assert(await bottle.locator(`img[src*="${asset}"]`).count());
    assert.deepEqual(await scene(),initial,'Equipped background must remain stable');
    if(i===1&&await page.getByTestId('tutorial-coach').count())await page.getByTestId('tutorial-coach').click();
  }
  await page.getByText('BOTTLE BROKEN',{exact:true}).waitFor();await page.screenshot({path:`${output}/equipped-broken-${width}.png`});
  assert.equal((await saved()).progress.coins,1250);assert.equal((await saved()).attempt.moves,1);
  assert.deepEqual(errors,[]);console.log(`PASS Shop ${width}x${height}: tabs, preview/cancel, single-charge Buy, free equip, insufficient balance, reload, equipped assets, all damage states and stable background`);await page.close();
}
(async()=>{const browser=await chromium.launch({headless:true});try{for(const [w,h]of[[320,568],[390,844],[430,932]])await run(browser,w,h);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
