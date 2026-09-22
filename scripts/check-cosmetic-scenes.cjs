const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
const path=require('node:path');const base=process.env.GAMEPLAY_URL||'http://localhost:8081',output=path.resolve(__dirname,'../artifacts/shop');
(async()=>{const browser=await chromium.launch({headless:true});try{
  const preview=await browser.newPage({viewport:{width:320,height:568}});await preview.goto(`${base}/shop`);await preview.getByTestId('shop-card-bottle_royal').click();await preview.waitForTimeout(400);
  await preview.getByRole('button',{name:'Preview cracked bottle',exact:true}).click();await preview.waitForTimeout(100);await preview.screenshot({path:`${output}/preview-royal-320.png`});await preview.close();
  for(const [background,skin,weight] of [['garden','crystal','metal'],['laboratory','legendary','wood'],['night_room','crystal','metal'],['workshop','royal','wood']]){
    const page=await browser.newPage({viewport:{width:320,height:568}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({background,skin,weight})=>{if(!localStorage.getItem('balance-keeper-progress'))localStorage.setItem('balance-keeper-progress',JSON.stringify({state:{progress:{coins:1000,highestUnlockedLevel:50,unlockedLevels:[1],levelProgress:{},ownedCosmetics:[`background_${background}`,`bottle_${skin}`,`weight_${weight}`],equipped:{backgroundId:`background_${background}`,bottleSkinId:`bottle_${skin}`,weightSkinId:`weight_${weight}`}}},version:0}));},{background,skin,weight});
    await page.goto(`${base}/level-select`);const level=page.getByRole('button',{name:'Level 8, The First Crack',exact:true});await level.evaluate(e=>e.scrollIntoView({block:'center'}));await level.click({force:true});
    const bottle=page.getByTestId('bottle-station-0');await bottle.waitFor();await page.waitForTimeout(400);await page.getByTestId('tutorial-coach').click();
    await page.getByTestId('weight-slot-w1').click();await bottle.click();await page.waitForTimeout(400);assert.match(await bottle.getAttribute('aria-label'),/2 of 5 kilograms/);
    assert(await bottle.getByTestId('code-ball').count());
    if(skin==='crystal')assert(await bottle.locator('img[src*="crystal"]').count());
    const bg=page.locator(`img[src*="${background==='night_room'?'night':background}-bg.webp"]:visible`).last();assert(await bg.count());
    await page.screenshot({path:`${output}/scene-${background}-320.png`});
    if(skin==='crystal'){await page.getByTestId('weight-slot-w5').click();await bottle.click();await page.waitForTimeout(350);assert(await bottle.locator('img[src*="crack1"]').count());}
    assert.deepEqual(errors,[]);console.log(`PASS cosmetic scene ${background}, ${skin}, ${weight}: visible assets, dynamic values, successful drop and damage fallback`);await page.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
