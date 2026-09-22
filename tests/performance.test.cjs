const {test}=require('node:test');
const assert=require('node:assert/strict');
const {orderedStorage,deferredJSONStorage}=require('../src/domain/persistence');
const {getLevelById,LEVELS}=require('../src/data/levels');
const {initialGame,transition,gameplayActions}=require('../src/domain/gameplay');
const hints=require('../src/domain/hints');
const {memory}=require('./register.cjs');
const {createGameStore,useGameStore}=require('../src/store/gameStore');
const key='balance-keeper-progress';

test('drop and action availability never invoke the solver, across all 50 levels',()=>{
 const original=hints.getHintMove;hints.getHintMove=()=>{throw Error('Solver on interaction path');};
 try {for(const level of LEVELS){let state=initialGame(level);gameplayActions(state,level,1000);state=transition(state,level,{type:'select',ballId:state.tray[0].id}).state;state=transition(state,level,{type:'drop',tubeIndex:0}).state;gameplayActions(state,level,1000);}}
 finally{hints.getHintMove=original;}
});
test('serialization is deferred and batches only the latest state before a checkpoint',async()=>{
 let serialized=0;const writes=[];
 const storage=deferredJSONStorage(orderedStorage({getItem:async()=>null,removeItem:async()=>{},setItem:async(name,value)=>writes.push(JSON.parse(value))}),10000);
 const state={coins:40,toJSON(){serialized++;return{coins:this.coins};}};
 storage.setItem(key,{state});storage.setItem(key,{state});storage.setItem(key,{state:{...state,coins:50}});
 assert.equal(serialized,0);assert.equal(writes.length,0);await storage.flush();assert.equal(serialized,1);assert.equal(writes.length,1);assert.equal(writes[0].state.coins,50);
});
test('flushed transaction order cannot be overtaken by a later debounced move',async()=>{
 const writes=[];const storage=deferredJSONStorage(orderedStorage({getItem:async()=>null,removeItem:async()=>{},setItem:async(name,value)=>writes.push(JSON.parse(value).state)}),10000);
 storage.setItem(key,{state:{coins:100,moves:1}});const first=storage.flush();storage.setItem(key,{state:{coins:50,moves:2}});await first;await storage.flush();
 assert.deepEqual(writes,[{coins:100,moves:1},{coins:50,moves:2}]);
});
test('failed deferred write retries the same receipt without recomputing a purchase',async()=>{
 let fail=true;const writes=[];const storage=deferredJSONStorage(orderedStorage({getItem:async()=>null,removeItem:async()=>{},setItem:async(name,value)=>{if(fail)throw Error('disk');writes.push(value);}}),10000);
 const value={state:{coins:20,receipt:'purchase:1'}};storage.setItem(key,value);await assert.rejects(storage.flush());fail=false;storage.retry(key,value);await storage.flush();assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0]),value);
});
test('selection and effect cleanup do not write storage; a move checkpoints the full recoverable attempt',async()=>{
 await useGameStore.persist.rehydrate();await useGameStore.getState().flushPersistence();
 memory.delete(key);const store=createGameStore();await store.persist.rehydrate();await store.getState().flushPersistence();
 const before=memory.get(key);const ids=store.getState().tray.map(ball=>ball.id);
 for(let i=0;i<20;i++)store.getState().selectBall(ids[0]);
 store.getState().clearImpact();store.getState().clearBreak();store.getState().clearInvalidPlacement();await store.getState().flushPersistence();assert.equal(memory.get(key),before);
 store.getState().selectBall(ids[0]);store.getState().placeBall(0);assert.equal(memory.get(key),before);
 await store.getState().flushPersistence();const saved=JSON.parse(memory.get(key)).state.attempt;assert.equal(saved.moves,1);assert.equal(saved.history.length,1);assert.equal(saved.selectedBall,null);assert.deepEqual(saved.effects,[]);
});
for(const extension of ['.webp','.jpeg'])require.extensions[extension]=(m,file)=>{m.exports=file;};
const {getActiveGameplayAssets,getBackgroundThumbnail,getGameplayBackground,getBottleThumbnail,getBottleSkinAsset,getWeightSkinStyle}=require('../src/assets/cosmetics');
test('active preload set contains exactly the selected background and four bottle states, never weight textures or other skins',()=>{
 const sources=getActiveGameplayAssets('background_garden','bottle_crystal');assert.equal(sources.length,5);assert(sources.some(p=>p.includes('garden-bg')));assert(sources.some(p=>p.includes('bottles/crystal')));assert(sources.some(p=>p.includes('bottles/crystal')&&p.includes('broken')));assert(sources.every(p=>!p.includes('weights')&&!p.includes('workshop')));
});
test('shop thumbnails are distinct from full gameplay assets and code weights cover all available skins',()=>{
 for(const id of ['background_cozy_room','background_garden','background_workshop','background_night_room','background_laboratory']){assert.match(getBackgroundThumbnail(id),/thumbnails/);assert.notEqual(getBackgroundThumbnail(id),getGameplayBackground(id).source);}
 assert.notEqual(getBottleThumbnail('bottle_crystal'),getBottleSkinAsset('bottle_crystal','pristine').source);
 for(const id of ['weight_classic','weight_wood','weight_metal'])for(const value of [1,2,3,5,10,20]){const style=getWeightSkinStyle(id,'green',value);assert.equal(style.colors.length,3);assert.equal(style.source,undefined);}
});
