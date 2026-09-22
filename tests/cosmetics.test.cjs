const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
// Asset modules are opaque native references in production; inspect their real paths here.
for(const extension of ['.webp','.jpeg']) require.extensions[extension]=(module,filename)=>{assert(fs.existsSync(filename));module.exports=filename;};
const {COSMETICS,DEFAULT_COSMETICS,DEFAULT_EQUIPPED,EQUIPPED_KEY,getShopItems,getCosmetic} = require('../src/domain/cosmetics/catalog.ts');
const {purchaseCosmetic,equipCosmetic,restoreCosmetics,resolveEquippedCosmetic,cosmeticTransactionId} = require('../src/domain/cosmetics/inventory.ts');
const {getBottleSkinAsset,getWeightSkinStyle,getGameplayBackground,BOTTLE_IMAGES} = require('../src/assets/cosmetics.ts');
const {INITIAL_PROGRESS,restoreProgress,migrateProgressStorage} = require('../src/domain/progress.ts');
const {initialGame,transition} = require('../src/domain/gameplay.ts');
const {getLevelById} = require('../src/data/levels/index.ts');
const {createGameStore,useGameStore} = require('../src/store/gameStore.ts');
const {memory,storageControl} = require('./register.cjs');
const key='balance-keeper-progress';
const clone=value=>JSON.parse(JSON.stringify(value));
const profile=(coins=3000)=>({...clone(INITIAL_PROGRESS),coins});
async function fresh(saved=profile()) {
  await useGameStore.persist.rehydrate();await useGameStore.getState().flushPersistence();
  memory.set(key,JSON.stringify({state:{progress:saved,sessionVersion:2},version:0}));
  const store=createGameStore();await store.persist.rehydrate();await store.getState().flushPersistence();return store;
}

test('catalog has unique IDs, centralized prices, permanent free defaults and no purchasable missing assets',()=>{
  assert.equal(new Set(COSMETICS.map(i=>i.id)).size,COSMETICS.length);
  for(const id of DEFAULT_COSMETICS){const item=getCosmetic(id);assert.equal(item.price,0);assert.equal(item.unlockType,'default');assert(item.available);}
  for(const category of ['bottle','weight','background']) assert(getShopItems(category).every(i=>i.available&&i.asset));
  assert.equal(getShopItems('bottle').length,4);assert.equal(getShopItems('weight').length,3);assert.equal(getShopItems('background').length,5);
  assert(COSMETICS.filter(i=>!i.available).every(i=>i.asset===null));
});
test('purchase with enough coins atomically deducts, owns, equips and records the centralized reason',()=>{
  const before=profile(750),copy=clone(before);const result=purchaseCosmetic(before,'bottle_royal',100);
  assert(result.applied);assert.equal(result.progress.coins,0);assert(result.progress.ownedCosmetics.includes('bottle_royal'));
  assert.equal(result.progress.equipped.bottleSkinId,'bottle_royal');
  assert.deepEqual(result.progress.transactions['cosmetic:bottle_royal'],{id:'cosmetic:bottle_royal',reason:'cosmetic_purchase',amount:-750,balanceBefore:750,balanceAfter:0,at:100});
  assert.deepEqual(before,copy);
});
test('insufficient coins, unknown IDs, defaults and unavailable designs cannot charge or grant inventory',()=>{
  for(const [coins,id] of [[749,'bottle_royal'],[3000,'unknown'],[3000,'bottle_classic'],[3000,'bottle_neon'],[3000,'background_beach_house']]){
    const p=profile(coins),result=purchaseCosmetic(p,id);assert.equal(result.applied,false);assert.equal(result.progress,p);
  }
  assert.match(purchaseCosmetic(profile(330),'bottle_royal').message,/420 more coins/);
});
test('duplicate purchase is idempotent regardless of later equip changes or available balance',()=>{
  const first=purchaseCosmetic(profile(),'weight_wood').progress;
  const equipped=equipCosmetic(first,'weight_classic').progress;
  const again=purchaseCosmetic(equipped,'weight_wood');assert.equal(again.applied,false);assert.equal(again.progress,equipped);
  assert.equal(again.progress.coins,2500);assert.equal(Object.keys(again.progress.transactions).length,1);
  assert.equal(again.progress.equipped.weightSkinId,'weight_classic');
});
test('equip is free, replaces only one category and never removes previous ownership',()=>{
  let p=purchaseCosmetic(profile(),'weight_wood').progress;p=purchaseCosmetic(p,'bottle_royal').progress;
  const result=equipCosmetic(p,'bottle_classic');assert(result.applied);assert.equal(result.progress.coins,p.coins);
  assert.deepEqual(result.progress.transactions,p.transactions);assert.deepEqual(result.progress.ownedCosmetics,p.ownedCosmetics);
  assert.equal(result.progress.equipped.bottleSkinId,'bottle_classic');assert.equal(result.progress.equipped.weightSkinId,'weight_wood');
  assert.equal(equipCosmetic(result.progress,'bottle_classic').applied,false);assert.equal(equipCosmetic(p,'bottle_crystal').applied,false);
});
test('migration preserves progress and wallet while restoring defaults and safe category-correct equipment',()=>{
  const old={coins:1234,unlockedLevels:[1,10],levelProgress:{1:{completed:true,stars:3}}};
  const restored=restoreProgress(JSON.parse(migrateProgressStorage(JSON.stringify(old))).state.progress);
  assert.equal(restored.coins,1234);assert.equal(restored.highestUnlockedLevel,10);assert.equal(restored.levelProgress[1].bestStars,3);
  assert.deepEqual(restored.equipped,DEFAULT_EQUIPPED);assert.deepEqual(restored.ownedCosmetics,DEFAULT_COSMETICS);
  const corrupt=restoreCosmetics({ownedCosmetics:['weight_wood','weight_wood',null,123,'retired_skin'],equipped:{bottleSkinId:'weight_wood',weightSkinId:'weight_wood',backgroundId:'unknown'}});
  assert.equal(corrupt.equipped.bottleSkinId,'bottle_classic');assert.equal(corrupt.equipped.weightSkinId,'weight_wood');
  assert.equal(corrupt.equipped.backgroundId,'background_cozy_room');assert(corrupt.ownedCosmetics.includes('retired_skin'));
  for(const id of DEFAULT_COSMETICS)assert(corrupt.ownedCosmetics.includes(id));
});
test('purchase receipt repairs missing ownership on restore without charging twice',()=>{
  const bought=purchaseCosmetic(profile(),'bottle_royal').progress;
  const repaired=restoreProgress({...bought,ownedCosmetics:[]});assert(repaired.ownedCosmetics.includes('bottle_royal'));assert.equal(repaired.coins,2250);
  assert.equal(purchaseCosmetic(repaired,'bottle_royal').applied,false);
  const wrong=restoreCosmetics({}, {'cosmetic:bottle_neon':{id:'cosmetic:bottle_neon',reason:'hint',amount:-50}});
  assert(!wrong.ownedCosmetics.includes('bottle_neon'));
});
test('gameplay resolves only owned, available, category-correct equipped cosmetics',()=>{
  const p=purchaseCosmetic(profile(),'weight_wood').progress;
  assert.equal(resolveEquippedCosmetic(p,'weight'),'weight_wood');
  assert.equal(resolveEquippedCosmetic({...p,equipped:{...p.equipped,weightSkinId:'weight_gold'}},'weight'),'weight_classic');
  assert.equal(resolveEquippedCosmetic({...p,equipped:{...p.equipped,weightSkinId:'bottle_classic'}},'weight'),'weight_classic');
  assert.equal(getWeightSkinStyle('weight_wood','red',17).material,'wood');
  assert.equal(getWeightSkinStyle('weight_metal','blue',2).material,'heavy');
  assert.equal(getWeightSkinStyle('unknown','green',5).material,'green');
  assert.notEqual(getGameplayBackground('background_workshop').source,getGameplayBackground('background_cozy_room').source);
  assert.deepEqual(getGameplayBackground('background_beach_house'),getGameplayBackground('background_cozy_room'));
});
test('every bottle finish has its own real cracked and broken art, never falling back',()=>{
  for(const item of getShopItems('bottle')){
    const sources=new Set();
    for(const stage of ['pristine','hairline','cracked','critical','broken']){
      const resolved=getBottleSkinAsset(item.id,stage);
      assert.equal(resolved.fallback,false);
      if(stage==='broken')assert.equal(resolved.tintOpacity,0);
      sources.add(resolved.source);
    }
    assert.equal(sources.size,4);
  }
  assert.deepEqual(getBottleSkinAsset('invalid','cracked'),getBottleSkinAsset('bottle_classic','cracked'));
});
test('cosmetic changes never enter bottle configuration, gameplay snapshots, star rules or rewards',()=>{
  const level=getLevelById(8),before=structuredClone(level),game=initialGame(level);
  let p=purchaseCosmetic(profile(5000),'bottle_crystal').progress;p=purchaseCosmetic(p,'weight_metal').progress;
  for(const category of ['bottle','weight','background'])resolveEquippedCosmetic(p,category);
  assert.deepEqual(level,before);assert.deepEqual(initialGame(level),game);
});
test('store duplicate Buy admission persists exactly one spend and equipped ownership across relaunch',async()=>{
  const store=await fresh(profile(1000));
  const results=await Promise.all([store.getState().purchaseCosmetic('weight_wood'),store.getState().purchaseCosmetic('weight_wood')]);
  assert.equal(results.filter(r=>r.accepted).length,1);assert.equal(store.getState().progress.coins,500);
  await store.getState().purchaseCosmetic('weight_wood');await store.getState().flushPersistence();
  const relaunched=createGameStore();await relaunched.persist.rehydrate();
  assert.equal(relaunched.getState().progress.coins,500);assert.equal(relaunched.getState().progress.equipped.weightSkinId,'weight_wood');
  assert(relaunched.getState().progress.ownedCosmetics.includes('weight_wood'));
  assert.equal(Object.values(relaunched.getState().progress.transactions).filter(tx=>tx.reason==='cosmetic_purchase').length,1);
  assert.equal((await relaunched.getState().equipCosmetic('weight_classic')).accepted,true);await relaunched.getState().flushPersistence();
  const again=createGameStore();await again.persist.rehydrate();assert.equal(again.getState().progress.equipped.weightSkinId,'weight_classic');assert.equal(again.getState().progress.coins,500);
});
test('parallel different purchases cannot overdraw; gameplay cannot spend during cosmetic save',async()=>{
  const store=await fresh({...profile(800),highestUnlockedLevel:8});store.getState().loadLevel(8);
  const pending=store.getState().purchaseCosmetic('bottle_royal');
  assert.equal(store.getState().requestHint().accepted,false);assert.equal(store.getState().cosmeticBusy,true);
  assert.equal((await store.getState().purchaseCosmetic('weight_wood')).accepted,false);
  await pending;assert.equal(store.getState().progress.coins,50);assert.equal((await store.getState().purchaseCosmetic('weight_wood')).accepted,false);
});
test('failed cosmetic save is retryable without a second charge or inventory loss',async()=>{
  const store=await fresh(profile(1000));storageControl.failWrites=true;
  try {
    assert.equal((await store.getState().purchaseCosmetic('weight_wood')).accepted,false);
    assert(store.getState().storageError);assert.equal(store.getState().progress.coins,500);
    assert.equal(JSON.parse(memory.get(key)).state.progress.coins,1000);
    assert.equal((await store.getState().purchaseCosmetic('bottle_royal')).accepted,false);
  }finally{storageControl.failWrites=false;}
  await store.getState().retrySave();await store.getState().flushPersistence();
  const saved=JSON.parse(memory.get(key)).state.progress;assert.equal(saved.coins,500);assert(saved.ownedCosmetics.includes('weight_wood'));
  assert.equal(saved.equipped.weightSkinId,'weight_wood');assert.equal(Object.keys(saved.transactions).length,1);
});
test('equip persistence failure retains wallet and saves the intended free selection on retry',async()=>{
  const store=await fresh(purchaseCosmetic(profile(),'weight_wood').progress);storageControl.failWrites=true;
  try {assert.equal((await store.getState().equipCosmetic('weight_classic')).accepted,false);assert.equal(store.getState().progress.coins,2500);}
  finally{storageControl.failWrites=false;}
  await store.getState().retrySave();await store.getState().flushPersistence();
  assert.equal(JSON.parse(memory.get(key)).state.progress.equipped.weightSkinId,'weight_classic');
});
test('a pending level reward survives a cosmetic save and commits against the current wallet once',async()=>{
  const store=await fresh(profile(1000));store.getState().selectBall('w1');assert.equal(store.getState().placeBall(0),true);
  const id=store.getState().attemptId;const purchase=store.getState().purchaseCosmetic('weight_wood');
  assert.equal((await store.getState().commitLevelReward(id)).accepted,false);
  await purchase;assert.equal((await store.getState().commitLevelReward(id)).accepted,true);
  await store.getState().commitLevelReward(id);await store.getState().flushPersistence();
  assert.equal(store.getState().progress.coins,560);assert.equal(store.getState().progress.equipped.weightSkinId,'weight_wood');
  assert.equal(Object.keys(store.getState().progress.transactions).length,2);
});
