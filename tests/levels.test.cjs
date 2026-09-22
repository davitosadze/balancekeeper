const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS, LEVEL_CONFIGS, getLevelById, getTotalLevels } = require('../src/data/levels/index.ts');
const { HANDCRAFTED_LEVELS } = require('../src/data/levels/campaign/handcrafted.ts');
const { fromSolution } = require('../src/domain/levels/authoring.ts');
const { DIFFICULTY_PROFILES, LEVEL_GENERATION_VERSION } = require('../src/domain/levels/profiles.ts');
const { seededRandom, hashSeed } = require('../src/domain/levels/random.ts');
const { generateLevel } = require('../src/domain/levels/generator.ts');
const { solveLevel, getSolutionFromState } = require('../src/domain/levels/solver.ts');
const { validateLevelConfig, checkSolution } = require('../src/domain/levels/validation.ts');
const { getTutorialMessage, getMoveGoalText } = require('../src/domain/levels/tutorials.ts');
const { initialGame, transition } = require('../src/domain/gameplay.ts');
const { normalizeLevel } = require('../src/domain/levelConfig.ts');
const { getHintMove } = require('../src/domain/hints.ts');
const { evaluateDrop, isBottleLocked, isLevelComplete } = require('../src/utils/physics.ts');
const { restoreAttempt } = require('../src/domain/persistence.ts');

const clone = data => JSON.parse(JSON.stringify(data));
function custom(groups = [[2,3],[4,5]], distractors = []) {
  return fromSolution(900, 'medium', groups, { name:'Test', baseCoins:60, distractors });
}
function drop(state, level, weightId, bottleId) {
  const selected = transition(state, level, { type:'select', ballId:weightId }).state;
  return transition(selected, level, { type:'drop', tubeIndex:state.tubes.findIndex(b=>b.id===bottleId) }, 1, 1000);
}
function assertPath(level, solution, start = initialGame(level)) {
  let state = start;
  for (const move of solution) {
    const result = drop(state, level, move.weightId, move.bottleId);
    assert.equal(result.accepted, true, `${level.id}: ${JSON.stringify(move)}`);
    state = result.state;
  }
  assert.equal(state.status, 'won', `Level ${level.id} must complete`);
  return state;
}

test('campaign ships exactly 50 ordered concrete configs with handcrafted opening and deterministic remainder', () => {
  assert.equal(getTotalLevels(), 50); assert.equal(HANDCRAFTED_LEVELS.length,10);
  assert.deepEqual(LEVEL_CONFIGS.map(l=>l.id), Array.from({length:50},(_,i)=>i+1));
  assert(LEVEL_CONFIGS.slice(0,10).every(l=>l.source==='handcrafted'));
  assert(LEVEL_CONFIGS.slice(10).every(l=>l.source==='generated' && l.generationVersion===LEVEL_GENERATION_VERSION));
});
test('all 50 levels pass independent validation and both intended and minimum paths execute in the real reducer', () => {
  for (const config of LEVEL_CONFIGS) {
    const report = validateLevelConfig(config, { campaign:true, nodeLimit:12000 });
    assert.equal(report.valid,true, `Level ${config.id}: ${report.errors}`);
    assert.equal(report.solver.status,'solved'); assert(report.solver.nodes<=12000);
    const won = assertPath(report.level, report.solver.solution);
    assert.equal(won.moves,report.solver.minimumMoves); assert.equal(won.earnedStars,3);
    assertPath(report.level,config.intendedSolution);
    assert.equal(config.minimumMoves,report.solver.minimumMoves);
  }
});
test('seeded PRNG has stable arithmetic, repeats exactly and different seeds diverge', () => {
  assert.equal(hashSeed('hello'), 1335831723);
  const a=seededRandom('balance-keeper-v1:27:0'),b=seededRandom('balance-keeper-v1:27:0'),c=seededRandom('balance-keeper-v1:28:0');
  const values=Array.from({length:20},()=>a.next());
  assert.deepEqual(values,Array.from({length:20},()=>b.next()));
  assert.notDeepEqual(values,Array.from({length:20},()=>c.next()));
  assert(values.every(v=>v>=0&&v<1));
});
test('all generated configs reproduce the checked-in artifact without ambient randomness', () => {
  const ambient = Math.random; Math.random = () => { throw Error('Ambient randomness is forbidden'); };
  try { for(let id=11;id<=50;id++) assert.deepEqual(clone(generateLevel(id)),LEVEL_CONFIGS[id-1],`Level ${id}`); }
  finally { Math.random=ambient; }
  assert.throws(()=>generateLevel(10)); assert.throws(()=>generateLevel(27,99));
});
test('waves contain recovery levels and progressive mechanic gates; milestones have reward bumps', () => {
  assert.deepEqual(Object.keys(DIFFICULTY_PROFILES),['tutorial','easy','medium','hard','challenge']);
  for (const id of [16,26,36,46]) { assert.equal(getLevelById(id).kind,'recovery'); assert.equal(getLevelById(id).category,'easy'); assert(getLevelById(id).difficultyScore<getLevelById(id-1).difficultyScore); }
  for (const id of [10,20,30,40,50]) {
    const level=getLevelById(id); assert.equal(level.category,'challenge'); assert(level.milestone);
    assert(level.rewards.baseCoins>getLevelById(id-1).rewards.baseCoins);
  }
  assert(LEVELS.filter(l=>l.id<31).every(l=>l.tubes.every(b=>b.type!=='fragile')));
  assert(LEVELS.filter(l=>l.id<41).every(l=>l.tubes.every(b=>b.type!=='locked')));
  assert(LEVELS.filter(l=>l.id<21).every(l=>l.rules.moveLimit==null));
  for(const [id,type] of [[21,'move-limit'],[31,'fragile'],[41,'locked']]) assert.equal(getLevelById(id).tutorial.type,type);
  assert.equal(getLevelById(13).tutorial.type,'combo');
});
test('handcrafted lessons use required weights and a unique Level 4 partition', () => {
  const first=getLevelById(1),second=getLevelById(2);
  assert.equal(first.tubes[0].target,5); assert.deepEqual(first.tray.map(b=>b.weight),[5]);
  assert.equal(second.tubes[0].target,8); assert.deepEqual(second.tray.map(b=>b.weight),[3,5]);
  assert.equal(getLevelById(3).tubes.length,2); assert.equal(getLevelById(5).tubes.length,3);
  const fourth=getLevelById(4), values=fourth.tray.map(b=>b.weight);
  const partitions=[];
  for(let mask=0;mask<(1<<values.length);mask++) {
    const sum=values.reduce((total,value,i)=>total+((mask>>i)&1?value:0),0);
    if(sum===fourth.tubes[0].target) partitions.push(mask);
  }
  assert.equal(partitions.length,1);
});
test('every bottle enforces one exact target; exceeding it always overloads immediately', () => {
  const level=getLevelById(6); let state=initialGame(level);
  const first=state.tray.find(b=>b.weight===6);
  state=drop(state,level,first.id,'b1').state;
  assert.equal(state.tubes[0].currentWeight,6); assert.equal(state.tubes[0].damage,0);
  const second=state.tray.find(b=>b.weight===8);
  const result=drop(state,level,second.id,'b1');
  assert.equal(result.accepted,false); assert.equal(result.state.tubes[0].currentWeight,6); assert.equal(result.state.tubes[0].damage,1);
});
test('first crack and durability lessons remain solvable after a rejected mistake', () => {
  for(const [id,wrong] of [[8,9],[9,12]]) {
    const level=getLevelById(id); let state=initialGame(level);
    const ball=state.tray.find(b=>b.weight===wrong);
    state=drop(state,level,ball.id,'b1').state;
    assert.equal(state.status,'playing'); assert.equal(state.tubes[0].damage,1); assert.equal(state.mistakes,1);
    assert.match(getTutorialMessage(level,state),/recover/);
    const solution=getSolutionFromState(state,level); assert(solution.solvable); assertPath(level,solution.solution,state);
  }
});
test('referenced locks ignore unrelated solved bottles and relock after Undo', () => {
  const config=custom([[5],[4],[3]],[9]); config.bottles[2].type='locked'; config.bottles[2].unlockAfter='b1';
  const level=normalizeLevel(config); let state=initialGame(level);
  assert.equal(isBottleLocked(state.tubes[2],state.tubes),true);
  state=drop(state,level,'w2','b2').state;
  const rejected=drop(state,level,'w3','b3'); assert.equal(rejected.accepted,false); assert.equal(rejected.state.mistakes,0);
  assert.equal(rejected.state.tubes[2].damage,0); assert.equal(rejected.state.tray.length,3);
  state=drop(rejected.state,level,'w1','b1').state;
  assert.equal(isBottleLocked(state.tubes[2],state.tubes),false);
  state=transition(state,level,{type:'undo'},2,1000).state;
  assert.equal(isBottleLocked(state.tubes[2],state.tubes),true);
});
test('fragile uses the same drop rules but breaks after one overload, including via the actual tutorial config', () => {
  const level=getLevelById(31); let state=initialGame(level);
  const fragile=state.tubes.find(b=>b.type==='fragile'); assert.equal(fragile.durability,1);
  const intended=level.intendedSolution.filter(m=>m.bottleId===fragile.id);
  for(const move of intended) state=drop(state,level,move.weightId,move.bottleId).state;
  assert.equal(state.tubes[fragile.index].damage,0);
  // The fragile bottle is already exactly at target; the very next placement
  // attempt overloads it, and one overload is enough to break fragile glass.
  for (const ball of [...state.tray]) {
    state=drop(state,level,ball.id,fragile.id).state;
    if(state.status==='lost') break;
    assert.equal(state.tubes[fragile.index].damage,0);
  }
  assert.equal(state.status,'lost'); assert.equal(state.tubes[fragile.index].damage,1);
  assert.equal(getSolutionFromState(state,level).solvable,false);
});
test('move goals affect stars only; a longer valid solution never causes a move-limit failure', () => {
  const config=custom([[5],[5]],[2,3,2,3]); config.rules.moveLimit=2; config.stars={threeStarMaxMoves:2,twoStarMaxMoves:4};
  const level=normalizeLevel(config); assert.equal(solveLevel(level).minimumMoves,2);
  let state=initialGame(level);
  for(const [id,bottle] of [['w3','b1'],['w4','b1'],['w5','b2'],['w6','b2']]) state=drop(state,level,id,bottle).state;
  assert.equal(state.status,'won'); assert.equal(state.moves,4); assert.equal(state.earnedStars,2); assert.equal(state.lossReason,null);
  assert.equal(getMoveGoalText(level,state),'Moves 4 · Goal 2');
});
test('Level 50 combines five bottles, fragile and referenced locks, strict stars and the largest reward', () => {
  const level=getLevelById(50); assert.equal(level.tubes.length,5);
  assert.deepEqual([...new Set(level.tubes.map(b=>b.type))].sort(),['fragile','locked','normal']);
  assert.equal(level.stars.threeStarMaxMoves,solveLevel(level).minimumMoves);
  assert.equal(level.rewards.baseCoins,250); assert.equal(level.milestone.title,'BALANCE MASTER');
});
test('solver handles partial contents, unused distractors, broken bottles, dead ends and bounded unknown results', () => {
  const level=normalizeLevel(custom([[2,3],[4,5]],[5,9,99]));
  const best=solveLevel(level); assert.equal(best.minimumMoves,2); assert(checkSolution(level,best.solution));
  let state=initialGame(level); state=drop(state,level,'w1','b1').state;
  const partial=getSolutionFromState(state,level); assert(partial.solvable); assertPath(level,partial.solution,state);
  assert.equal(getSolutionFromState({...state,tubes:state.tubes.map((b,i)=>i?b:{...b,damage:3,isBroken:true})},level).solvable,false);
  const dead=normalizeLevel(custom([[2,3]],[])); dead.tray=[{id:'wrong',weight:4,color:'red'}];
  assert.equal(solveLevel(dead).status,'unsolvable');
  assert.equal(solveLevel(level,undefined,1).status,'limit'); assert.equal(solveLevel(level,undefined,1).minimumMoves,null);
});
test('minimum search agrees with independent breadth-first search over all bottle/ball orders', () => {
  function bfs(level) {
    const queue=[{bottles:level.tubes.map(b=>({...b,balls:[]})),tray:level.tray,moves:0}], seen=new Set();
    for(let head=0;head<queue.length;head++) {
      const current=queue[head]; if(isLevelComplete(current.bottles)) return current.moves;
      const key=current.bottles.map(b=>b.balls.reduce((a,w)=>a+w.weight,0)).join(',')+'|'+current.tray.map(b=>b.id).join(',');
      if(seen.has(key))continue; seen.add(key);
      for(let bi=0;bi<current.bottles.length;bi++) for(let wi=0;wi<current.tray.length;wi++) {
        const ball=current.tray[wi],bottle=current.bottles[bi];
        if(!evaluateDrop(bottle,ball.weight,{bottles:current.bottles}).accepted)continue;
        queue.push({bottles:current.bottles.map((b,i)=>i===bi?{...b,balls:[...b.balls,ball]}:b),tray:current.tray.filter((_,i)=>i!==wi),moves:current.moves+1});
      }
    }
    return null;
  }
  const rng=seededRandom('solver-cross-check');
  for(let i=0;i<12;i++) {
    const config=custom([[rng.int(1,4),rng.int(1,4)],[rng.int(1,4),rng.int(1,4)]],[rng.int(2,8)]);
    if(i%2===0) {config.bottles[1].type='locked';config.bottles[1].unlockAfter='b1';}
    const level=normalizeLevel(config); assert.equal(solveLevel(level).minimumMoves,bfs(level));
  }
});
test('partial-state Hint uses a valid solver move without charging or moving inside the solver', () => {
  for(const id of [10,21,31,41,50]) {
    const level=getLevelById(id),state=initialGame(level),before=clone(state);
    const hint=getHintMove(state,level); assert(hint); assert.deepEqual(state,before);
    const move={weightId:hint.ballId,bottleId:state.tubes[hint.tubeIndex].id};
    const next=drop(state,level,move.weightId,move.bottleId).state;
    const result=getSolutionFromState(next,level); assert(result.solvable,`Level ${id}`);
  }
});
const corruptions = {
  'no bottles': c=>{c.bottles=[];}, 'duplicate bottle ids': c=>{c.bottles[1].id=c.bottles[0].id;},
  'duplicate weight ids': c=>{c.weights[1].id=c.weights[0].id;}, 'target below minimum': c=>{c.bottles[0].target=0;},
  'zero durability': c=>{c.bottles[0].durability=0;}, 'missing durability': c=>{delete c.bottles[0].durability;},
  'invalid weight': c=>{c.weights[0].value=-1;}, 'invalid color': c=>{c.weights[0].color='orange';},
  'no solution': c=>{c.weights=c.weights.slice(0,1);}, 'invalid unlock reference': c=>{c.bottles[1].type='locked';c.bottles[1].unlockAfter='missing';},
  'cyclic locks': c=>{c.bottles[0].type='locked';c.bottles[0].unlockAfter='b2';c.bottles[1].type='locked';c.bottles[1].unlockAfter='b1';},
  'impossible stars': c=>{c.stars.threeStarMaxMoves=1;}, 'malformed rules': c=>{c.rules=[];},
  'missing rewards': c=>{delete c.rewards;}, 'special balls': c=>{c.weights[0].type='mystery';},
  'hard move failure': c=>{c.rules.moveLimitMode='hard';},
  'null weight type': c=>{c.weights[0].type=null;},
  'malformed intended path': c=>{c.intendedSolution={};},
  'null intended move': c=>{c.intendedSolution=[null];},
  'malformed tutorial': c=>{c.tutorial={type:'drag',step:1,message:{}};},
  'malformed milestone': c=>{c.milestone={title:'Milestone'};},
  'invalid generation seed': c=>{c.generation={seed:27,attempt:0};},
  'invalid generation version': c=>{c.generationVersion=-1;},
  'invalid minimum metadata': c=>{c.minimumMoves='4';},
  'array combo milestones': c=>{c.rewards.comboMilestones=[];},
};
for(const [name,mutate] of Object.entries(corruptions)) test(`validator rejects ${name}`,()=>{
  const c=custom();mutate(c);assert.equal(validateLevelConfig(c).valid,false);
});
test('validator rejects exhausted search without claiming the level is unsolvable',()=>{
  const result=validateLevelConfig(custom(),{nodeLimit:1});assert.equal(result.valid,false);assert.match(result.errors.join(','),/Search limit/);
});
test('persisted attempts are pinned to config signatures, while old completed reward receipts remain resumable',()=>{
  const level=getLevelById(1),state=initialGame(level),different={...state,levelSignature:'old-config'};
  assert.equal(restoreAttempt(different,level),null);assert(restoreAttempt(state,level));
  const won=assertPath(level,level.intendedSolution);
  assert(restoreAttempt({...won,levelSignature:'old-config'},level));
});
