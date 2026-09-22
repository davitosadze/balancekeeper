const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fromSolution} = require('../src/domain/levels/authoring.ts');
const {normalizeLevel} = require('../src/domain/levelConfig.ts');
const {initialGame, transition, refreshBottle} = require('../src/domain/gameplay.ts');
const {evaluateDrop, canManuallyRemoveBall, isBottleLocked} = require('../src/utils/physics.ts');
const {getBottleStress, getComboFeedback} = require('../src/domain/bottleFeedback.ts');
const {feedbackForEvent, chooseSound, SOUND_CUES} = require('../src/domain/feedback.ts');
const {solveLevel} = require('../src/domain/levels/solver.ts');
const {checkSolution, validateLevelConfig} = require('../src/domain/levels/validation.ts');
const {persistAttempt, restoreAttempt} = require('../src/domain/persistence.ts');
const clone = value => JSON.parse(JSON.stringify(value));
function config(type='normal', extra={}) {
  const c=fromSolution(900,'medium',[[2,3],[4,5]],{baseCoins:60,distractors:[8]});
  Object.assign(c.bottles[0],{type},extra); return c;
}
function drop(state,level,ballId,index=0) {
  const selected=transition(state,level,{type:'select',ballId}).state;
  return transition(selected,level,{type:'drop',tubeIndex:index});
}
const since=(before,after)=>after.effects.filter(e=>e.sequence>before.effectSequence);

test('fragile defaults to one overload and honors explicitly configured durability',()=>{
  for(const durability of [undefined,1,2,4]) {
    const c=config('fragile'); if(durability===undefined)delete c.bottles[0].durability;else c.bottles[0].durability=durability;
    assert.equal(validateLevelConfig(c).valid,true);
    const level=normalizeLevel(c); let state=initialGame(level);
    assert.equal(state.tubes[0].durability,durability??1);
    state=drop(state,level,'w2').state;
    for(let i=1;i<=(durability??1);i++) {
      state=drop(state,level,'w5').state;
      assert.equal(state.tubes[0].damage,i);
      assert.equal(state.status,i===(durability??1)?'lost':'playing');
    }
  }
  assert.equal(refreshBottle({index:0,id:'b1',target:5,type:'fragile',balls:[],damage:1}).isBroken,true);
});
test('lock rejects without damage, then emits one immediate unlock when its named dependency solves',()=>{
  const c=config(); c.bottles[1].type='locked';c.bottles[1].unlockAfter='b1';
  const level=normalizeLevel(c);let state=initialGame(level);
  const rejected=drop(state,level,'w3',1); assert.equal(rejected.accepted,false);
  assert.equal(rejected.state.mistakes,0);assert.equal(rejected.state.moves,0);assert.equal(rejected.state.tubes[1].damage,0);
  assert.equal(rejected.state.effects.at(-1).type,'DROP_INVALID');assert.equal(rejected.state.effects.at(-1).reason,'locked');
  state=drop(rejected.state,level,'w1').state;const before=state;state=drop(state,level,'w2').state;
  assert.equal(isBottleLocked(state.tubes[1],state.tubes),false);
  assert.equal(since(before,state).filter(e=>e.type==='BOTTLE_UNLOCKED').length,1);
  state=transition(state,level,{type:'undo'}).state;
  assert.equal(isBottleLocked(state.tubes[1],state.tubes),true);
  assert.equal(state.effects.filter(e=>e.type==='BOTTLE_UNLOCKED').length,1);
});
test('exact bottles reject anything past target, safely by default, and support explicit overload damage',()=>{
  for(const damage of [false,true]) {
    const level=normalizeLevel(config('exact',{damageOnOverload:damage}));let state=initialGame(level);
    state=drop(state,level,'w1').state;const before=clone(state);const result=drop(state,level,'w5');
    assert.equal(state.tubes[0].target,5);assert.equal(result.accepted,false);
    assert.equal(result.state.moves,before.moves);assert.equal(result.state.history.length,before.history.length);
    assert.equal(result.state.tubes[0].damage,damage?1:0);assert.equal(result.state.mistakes,damage?1:0);
    assert.equal(result.state.combo,0);assert.equal(result.state.tray.length,before.tray.length);
    assert.equal(since(state,result.state).find(e=>e.type==='DROP_INVALID').reason,damage?'overload':'exact');
    assert.equal(evaluateDrop(state.tubes[0],3).perfectFit,true);
  }
});
test('oneWay rejects manual removal while Undo restores contents, weights and tray',()=>{
  for(const type of ['oneWay','one-way']) {
    const level=normalizeLevel(config(type));const initial=initialGame(level);const placed=drop(initial,level,'w1').state;
    assert.equal(level.tubes[0].type,'oneWay');assert.equal(canManuallyRemoveBall(placed.tubes[0],'w1'),false);
    assert.equal(canManuallyRemoveBall({...placed.tubes[0],type:'normal'},'w1'),true);
    const undone=transition(placed,level,{type:'undo'}).state;
    assert.deepEqual(undone.tubes,initial.tubes);assert.deepEqual(undone.tray,initial.tray);assert.equal(undone.undoUsed,1);
  }
});
test('unsupported bottles reject with no overload or damage',()=>{
  const bottle={index:0,target:5,balls:[],type:'unsupported'};
  assert.equal(evaluateDrop(bottle,99).reason,'invalid');
});
test('combo semantic thresholds include resets, no x1 popup, and visual cap x5 without changing earned combo',()=>{
  const c=fromSolution(900,'medium',[[1,1,1,1,1,1],[9]],{baseCoins:60});const level=normalizeLevel(c);let state=initialGame(level);
  for(let i=1;i<=6;i++) {
    const before=state;state=drop(state,level,`w${i}`).state;
    const combo=since(before,state).find(e=>e.type==='COMBO_CHANGED');assert.equal(combo.combo,i);assert.equal(combo.tier,i===1?0:Math.min(5,i));
  }
  assert.equal(state.combo,6);assert.equal(getComboFeedback(1),null);
  assert.deepEqual([2,3,4,5,6].map(n=>getComboFeedback(n).label),['NICE!','GREAT!','AMAZING!','BALANCE MASTER!','BALANCE MASTER!']);
  const reset=transition(state,level,{type:'invalidDrop'}).state;
  assert.equal(since(state,reset).find(e=>e.type==='COMBO_CHANGED').tier,0);
});
test('Perfect Fit and level-complete emit once per causal move, never on blocked input or reload',()=>{
  const c=fromSolution(900,'easy',[[2,3]],{baseCoins:40});const level=normalizeLevel(c);let state=initialGame(level,'same-time');
  state=drop(state,level,'w1').state;const before=state;state=drop(state,level,'w2').state;
  assert.equal(since(before,state).filter(e=>e.type==='PERFECT_FIT').length,1);
  assert.equal(since(before,state).filter(e=>e.type==='LEVEL_COMPLETED').length,1);
  assert.equal(state.status,'won');assert.equal(new Set(state.effects.map(e=>e.id)).size,state.effects.length);
  assert.equal(transition(state,level,{type:'drop',tubeIndex:0}).state,state);
  assert.equal(transition(state,level,{type:'invalidDrop'}).state,state);
  const saved=persistAttempt(state,level);assert.deepEqual(saved.effects,[]);assert.deepEqual(restoreAttempt(saved,level).effects,[]);
});
test('break emits once; a nonbreaking overload emits crack, never a success',()=>{
  const level=normalizeLevel(config('fragile',{durability:2}));let state=initialGame(level);
  state=drop(state,level,'w2').state;const first=drop(state,level,'w5').state;
  assert.deepEqual(since(state,first).map(e=>e.type),['BALL_PICKUP','DROP_INVALID','BOTTLE_CRACKED','COMBO_CHANGED']);
  const broken=drop(first,level,'w5').state;
  assert.equal(since(first,broken).filter(e=>e.type==='BOTTLE_BROKEN').length,1);
  assert.equal(transition(broken,level,{type:'drop',tubeIndex:0}).state,broken);
});
test('stress thresholds and attempted overload are centralized; danger entry emits only on crossing',()=>{
  const bottle={index:0,id:'b1',type:'normal',target:100,balls:[]};
  assert.deepEqual([0,74,75,89,90,100,101].map(n=>getBottleStress(bottle,n)),['safe','safe','warning','warning','danger','danger','overload']);
  const c=fromSolution(900,'medium',[[9,1],[5]],{baseCoins:60});const level=normalizeLevel(c);let state=initialGame(level);
  const danger=drop(state,level,'w1').state;
  assert.equal(since(state,danger).filter(e=>e.type==='BOTTLE_STRESS_CHANGED'&&e.stress==='danger').length,1);
  const filled=drop(danger,level,'w2').state;
  assert.equal(since(danger,filled).filter(e=>e.type==='BOTTLE_STRESS_CHANGED').length,0);
});
test('solver validates exact and oneWay paths and solves their partial states without removals',()=>{
  for(const type of ['exact','oneWay']) {
    const c=config(type);c.mechanics=[...(c.mechanics ?? []),type];assert.equal(validateLevelConfig(c).valid,true);
    const level=normalizeLevel(c);const result=solveLevel(level);
    assert.equal(result.solvable,true);assert(checkSolution(level,result.solution));
    const partial=drop(initialGame(level),level,'w1').state;
    const remainder=solveLevel(level,{bottles:partial.tubes,tray:partial.tray});assert.equal(remainder.solvable,true);
  }
});
test('audio priorities suppress taps under break; combo reset has no cue and every semantic sound is registered',()=>{
  assert.equal(chooseSound('buttonTap','bottleBreak'),'bottleBreak');assert.equal(chooseSound('bottleBreak','combo'),'bottleBreak');
  assert.equal(chooseSound('combo','levelComplete'),'levelComplete');
  assert.deepEqual(feedbackForEvent({type:'COMBO_CHANGED',tier:0}),{});
  assert.deepEqual(feedbackForEvent({type:'DROP_INVALID',reason:'overload'}),{});
  assert.equal(feedbackForEvent({type:'BOTTLE_BROKEN'}).haptic,'error');
  assert.equal(feedbackForEvent({type:'BOTTLE_CRACKED',damage:1}).sound,'bottleCrack1');
  assert.equal(feedbackForEvent({type:'BOTTLE_CRACKED',damage:2}).sound,'bottleCrack2');
  assert.equal(feedbackForEvent({type:'DROP_SUCCESS'}).layeredSound,'ballBounce');
  assert.deepEqual(feedbackForEvent({type:'BOTTLE_STRESS_CHANGED',stress:'warning'}),{});
  assert.equal(feedbackForEvent({type:'BOTTLE_STRESS_CHANGED',stress:'danger'}).sound,'warning');
  assert.equal(feedbackForEvent({type:'LEVEL_FAILED'}).sound,'levelFailed');
  for(const key of ['ballPickup','ballDrop','ballBounce','correct','invalidDrop','bottleCrack1','bottleCrack2','bottleBreak','warning',
    'levelComplete','levelFailed','buttonTap','back','shopOpen','itemSelect','purchase','purchaseFailed','coin','unlock',
    'combo','hint','shuffle','undo','revive','star']) assert(SOUND_CUES[key]);
});
test('feedback journal is bounded and Undo never rewinds event identity or replays prior effects',()=>{
  const level=normalizeLevel(config());let state=initialGame(level);
  for(let i=0;i<90;i++) state=transition(state,level,{type:'invalidDrop'}).state;
  assert.equal(state.effects.length,64);assert.equal(state.effectSequence,90);
  state=drop(state,level,'w1').state;const sequence=state.effectSequence;state=transition(state,level,{type:'undo'}).state;
  assert(state.effectSequence>sequence);assert.equal(state.effects.at(-1).type,'UNDO');
});
