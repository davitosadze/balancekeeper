const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLevel } = require('../src/domain/levelConfig.ts');
const { initialGame, transition, snapshot, gameplayActions } = require('../src/domain/gameplay.ts');
const { getHintMove } = require('../src/domain/hints.ts');
const { evaluateDrop, calculateBottleWeight, isBottleSolved, isLevelComplete } = require('../src/utils/physics.ts');
const { getBottleVisualState } = require('../src/utils/durability.ts');
const { calculateStars, calculateRewards } = require('../src/utils/scoring.ts');
const { getUnlockedLevels } = require('../src/data/levels/index.ts');
const { PHASE1_LEVEL_CONFIGS } = require('../src/data/levels/phase1.ts');
const LEVELS = PHASE1_LEVEL_CONFIGS.map(normalizeLevel);

function config({ bottles = [{ target: 10 }, { target: 5 }], weights = [5, 5, 5, 2, 9], ...rest } = {}) {
  return normalizeLevel({ id: 900, difficulty: 'medium',
    bottles: bottles.map((b, i) => ({ id: `b${i}`, durability: 3, type: 'normal', ...b })),
    weights: weights.map((value, i) => ({ id: `w${i}`, value, color: 'blue', type: 'normal' })),
    rules: { allowUndo: true, allowHint: true },
    rewards: { baseCoins: 60, perfectFitCoins: 10, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 }, threeStarBonus: 25 },
    stars: { twoStarMaxMoves: 6, threeStarMaxMoves: 3 }, ...rest });
}
function attempt(level = config()) {
  let state = initialGame(level), clock = 0, coins = 1000;
  const action = input => {
    const result = transition(state, level, typeof input === 'string' ? { type: input } : input, ++clock, coins);
    if (result.accepted) coins -= result.cost;
    state = result.state;
    return result;
  };
  const drop = (weight, tubeIndex = 0) => {
    const ball = state.tray.find(ball => ball.weight === weight);
    assert(ball, `Missing ${weight} ball`);
    action({ type: 'select', ballId: ball.id });
    return action({ type: 'drop', tubeIndex });
  };
  return { action, drop, get state() { return state; } };
}
function deepFreeze(object) {
  Object.freeze(object);
  for (const value of Object.values(object)) if (value && typeof value === 'object' && !Object.isFrozen(value)) deepFreeze(value);
  return object;
}

test('the three original engine fixtures remain valid; selection respects unlocks', () => {
  assert.equal(LEVELS.length, 3);
  assert.deepEqual(getUnlockedLevels([1, 51, 53]), [1]);
  assert.deepEqual(getUnlockedLevels([1], 3), [1, 2, 3]);
  assert.deepEqual(LEVELS.map(level => [level.tubes.length, level.tray.length]), [[1, 1], [1, 2], [2, 4]]);
  for (const level of PHASE1_LEVEL_CONFIGS) {
    for (const field of ['id', 'difficulty', 'bottles', 'weights', 'rules', 'rewards', 'stars']) assert(field in level);
    assert(level.bottles.every(b => b.type === 'normal' && b.durability === 3));
    assert(level.weights.every(w => w.type === 'normal'));
  }
});
test('config defaults normal durability to three and rejects unsupported mechanics or invalid data', () => {
  assert.equal(config({ bottles: [{ target: 5, durability: undefined }] }).tubes[0].durability, 3);
  for (const bottles of [[{ target: 0 }], [{ target: 5, durability: 0 }], [{ target: 5, type: 'unsupported' }]]) {
    assert.throws(() => config({ bottles }));
  }
  assert.throws(() => config({ stars: { threeStarMaxMoves: 4, twoStarMaxMoves: 3 } }));
  assert.throws(() => normalizeLevel({ ...PHASE1_LEVEL_CONFIGS[0], weights: [{ id: 'w', value: 5, color: 'red', type: 'heavy' }] }));
});
test('valid drop updates bottle contents, cached weight, move, combo and history', () => {
  const game = attempt();
  assert.equal(game.drop(5).accepted, true);
  const b = game.state.tubes[0];
  assert.equal(b.currentWeight, 5); assert.equal(calculateBottleWeight(b), 5);
  assert.deepEqual(b.containedWeightIds, ['w0']); assert.equal(b.damage, 0); assert.equal(b.isSolved, false);
  assert.equal(game.state.moves, 1); assert.equal(game.state.combo, 1); assert.equal(game.state.maxCombo, 1);
  assert.equal(game.state.history.length, 1); assert.equal(game.state.currentEvent.outcome, 'placed');
});
test('exact fill solves one bottle, increments Perfect Fits and awards ten attempt coins', () => {
  const game = attempt(); game.drop(5); game.drop(5);
  assert.equal(isBottleSolved(game.state.tubes[0]), true); assert.equal(game.state.tubes[0].isSolved, true);
  assert.equal(game.state.perfectFits, 1); assert.equal(game.state.coinsEarned, 12);
  assert.equal(game.state.currentEvent.outcome, 'perfectFit'); assert.equal(game.state.currentEvent.nextWeight, 10);
  assert.equal(game.state.status, 'playing'); assert.equal(game.state.combo, 2);
});
test('a bottle at target rejects any further weight as an immediate overload', () => {
  const game = attempt(); game.drop(5); game.drop(5);
  assert.equal(game.state.tubes[0].currentWeight, 10); assert.equal(game.state.tubes[0].isSolved, true);
  assert.deepEqual(evaluateDrop(game.state.tubes[0], 2), { accepted: false, reason: 'overload', nextWeight: 12, perfectFit: false });
  assert.equal(game.drop(2).accepted, false);
  assert.equal(game.state.tubes[0].currentWeight, 10); assert.equal(game.state.tubes[0].damage, 1);
  assert.equal(game.state.mistakes, 1); assert.equal(game.state.combo, 0);
});
test('overload rejects without consuming a ball, move, or history entry', () => {
  const game = attempt(); game.drop(9);
  const before = structuredClone(game.state);
  assert.equal(game.drop(5).accepted, false);
  assert.deepEqual(game.state.tray, before.tray); assert.deepEqual(game.state.history, before.history);
  assert.equal(game.state.moves, before.moves); assert.equal(game.state.tubes[0].currentWeight, 9);
  assert.equal(game.state.mistakes, 1); assert.equal(game.state.combo, 0); assert.equal(game.state.maxCombo, 1);
  assert.equal(game.state.currentEvent.outcome, 'overload');
});
for (const [damage, visual] of [[1, 'hairline'], [2, 'cracked'], [3, 'broken']]) {
  test(`overload ${damage}: ${visual} asset state and per-bottle damage`, () => {
    const game = attempt(); game.drop(9);
    for (let i = 0; i < damage; i++) game.drop(5);
    assert.equal(game.state.tubes[0].damage, damage);
    assert.equal(getBottleVisualState(game.state.tubes[0]), visual);
    assert.equal(game.state.tubes[1].damage, 0); assert.equal(game.state.mistakes, damage);
    assert.equal(game.state.status, damage === 3 ? 'lost' : 'playing');
  });
}
test('bottle break freezes all gameplay and retains the pre-break recovery foundation', () => {
  const level = config(), game = attempt(level); game.drop(9); game.drop(5); game.drop(5);
  const before = snapshot(game.state); game.drop(5);
  assert.equal(game.state.tubes[0].isBroken, true); assert.equal(game.state.lossReason, 'broken');
  assert.deepEqual(game.state.reviveSnapshot, before); assert.equal(game.state.revivesUsed, 0);
  const lost = game.state;
  for (const action of ['undo', 'hint', 'invalidDrop', 'shuffle', { type: 'select', ballId: 'w3' }, { type: 'drop', tubeIndex: 1 }]) {
    assert.equal(game.action(action).accepted, false); assert.equal(game.state, lost);
  }
  assert(Object.values(gameplayActions(lost, level)).every(action => !action.enabled));
});
test('invalid and outside drops reset combo without adding mistakes or moves', () => {
  const game = attempt(); game.drop(5);
  assert.equal(game.drop(2, 99).accepted, false);
  assert.equal(game.state.combo, 0); assert.equal(game.state.moves, 1); assert.equal(game.state.mistakes, 0);
  assert.equal(game.state.currentEvent.outcome, 'invalid');
  game.drop(2); game.action('invalidDrop'); assert.equal(game.state.combo, 0);
  game.drop(5, 1); game.action({ type: 'drop', tubeIndex: 0 }); assert.equal(game.state.combo, 0);
});
test('combo increases after long thinking time and retains its maximum after reset', () => {
  const level = config(), game = attempt(level); game.drop(5);
  let next = transition(game.state, level, { type: 'select', ballId: 'w3' }, 86400000).state;
  next = transition(next, level, { type: 'drop', tubeIndex: 0 }, 86400001).state;
  assert.equal(next.combo, 2); assert.equal(next.maxCombo, 2);
  next = transition(next, level, { type: 'invalidDrop' }).state;
  assert.equal(next.combo, 0); assert.equal(next.maxCombo, 2);
});
test('every bottle must be exact before winning, then input is frozen', () => {
  const game = attempt(); game.drop(5); game.drop(5);
  assert.equal(isLevelComplete(game.state.tubes), false);
  game.drop(5, 1); assert.equal(isLevelComplete(game.state.tubes), true);
  assert.equal(game.state.status, 'won'); assert.equal(game.state.earnedStars, 3);
  assert.equal(game.state.coinsEarned, game.state.rewards.total);
  const won = game.state;
  for (const action of ['undo', 'hint', 'invalidDrop', { type: 'select', ballId: 'w3' }, { type: 'drop', tubeIndex: 0 }]) {
    assert.equal(game.action(action).accepted, false); assert.equal(game.state, won);
  }
  assert.equal(isLevelComplete([]), false);
});
test('all three fixtures can be completed through the real reducer', () => {
  for (const level of LEVELS) {
    const game = attempt(level);
    while (game.state.status === 'playing') {
      const hint = getHintMove(game.state, level); assert(hint, `Level ${level.id} has a solution`);
      game.action({ type: 'select', ballId: hint.ballId });
      assert.equal(game.action({ type: 'drop', tubeIndex: hint.tubeIndex }).accepted, true);
    }
    assert.equal(game.state.status, 'won'); assert.equal(game.state.earnedStars, 3);
  }
});
test('undo restores the full successful snapshot, including intervening mistakes and reward state', () => {
  const game = attempt(config({ weights: [5, 5, 20, 2, 9] }));
  game.drop(5); game.drop(20);
  const before = snapshot(game.state);
  game.drop(5); assert.equal(game.state.perfectFits, 1); assert.equal(game.state.coinsEarned, 10);
  game.drop(20); assert.equal(game.state.mistakes, 2);
  assert.equal(game.action('undo').accepted, true);
  assert.deepEqual(snapshot(game.state), { ...before, combo: 0 });
  assert.equal(game.state.tubes[0].damage, 1); assert.equal(game.state.mistakes, 1);
  assert.equal(game.state.undoUsed, 1); assert.equal(game.state.currentEvent, null);
  assert.equal(game.state.history.length, 1);
  game.drop(5); assert.equal(game.state.perfectFits, 1); assert.equal(game.state.coinsEarned, 10);
  game.action('undo'); assert.equal(game.state.undoUsed, 2);
});
test('undo and hint reset combo, and assistance usage survives undo', () => {
  const level = LEVELS[2], game = attempt(level); game.drop(2);
  assert.equal(game.action('hint').accepted, true); assert.equal(game.state.combo, 0); assert.equal(game.state.hintUsed, 1);
  assert(game.state.hintMove);
  game.drop(3); game.action('undo'); assert.equal(game.state.combo, 0); assert.equal(game.state.hintUsed, 1);
  assert.equal(game.state.undoUsed, 1); assert.equal(game.state.hintMove, null);
  for (let i = 0; i < 5; i++) { game.drop(3); assert.equal(game.action('undo').accepted, true); }
  assert.equal(game.state.undoUsed, 6); assert.equal(gameplayActions(game.state, level).undo.cost, 30);
});
test('hint finds nothing when remaining weights cannot reach the remaining deficit, and resets combo', () => {
  const level = config({ bottles: [{ target: 5 }], weights: [3, 4] }), game = attempt(level);
  game.drop(3);
  assert.equal(game.action('hint').accepted, false); assert.equal(game.state.combo, 0); assert.equal(game.state.hintUsed, 0);
  assert.equal(game.state.hintMove, null); assert.equal(game.state.status, 'playing');
});
test('disabled utilities and empty history cannot mutate the attempt', () => {
  const level = config({ rules: { allowUndo: false, allowHint: false, allowShuffle: false } }), game = attempt(level);
  assert.equal(game.action('undo').accepted, false); game.drop(5);
  const before = game.state;
  for (const action of ['undo', 'hint', 'shuffle']) assert.equal(game.action(action).accepted, false);
  assert.equal(game.state, before);
});
test('calculateStars uses completion, inclusive move thresholds and all clean-play requirements', () => {
  const rules = { twoStarMaxMoves: 6, threeStarMaxMoves: 4 };
  const clean = { status: 'won', moves: 4, mistakes: 0, undoUsed: 0, hintUsed: 0 };
  assert.equal(calculateStars({ ...clean, status: 'playing' }, rules), 0);
  assert.equal(calculateStars({ ...clean, status: 'lost' }, rules), 0);
  assert.equal(calculateStars(clean, rules), 3);
  assert.equal(calculateStars({ ...clean, moves: 5 }, rules), 2);
  assert.equal(calculateStars({ ...clean, moves: 6 }, rules), 2);
  assert.equal(calculateStars({ ...clean, moves: 7 }, rules), 1);
  for (const field of ['mistakes', 'undoUsed', 'hintUsed']) assert.equal(calculateStars({ ...clean, [field]: 1 }, rules), 2);
});
test('reward calculation returns config-based, bounded milestone bonuses', () => {
  const level = config(), state = { status: 'won', isReplay: false, perfectFits: 2, comboRewardEvents: [{ milestone: 2, coins: 2 }, { milestone: 3, coins: 4 }] };
  assert.deepEqual(calculateRewards(state, level, 3), { baseCoins: 60, perfectFitCoins: 20, comboBonus: 6, threeStarBonus: 25, total: 111 });
  assert.equal(calculateRewards({ ...state, isReplay: true }, level, 3).baseCoins, 0);
  assert.equal(calculateRewards({ ...state, comboRewardEvents: [...state.comboRewardEvents, ...state.comboRewardEvents] }, level, 3).comboBonus, 6);
  assert.deepEqual(calculateRewards({ ...state, status: 'playing' }, level, 3), { baseCoins: 0, perfectFitCoins: 20, comboBonus: 6, threeStarBonus: 0, total: 26 });
});
test('domain functions do not mutate their input or share mutable snapshot contents', () => {
  const level = deepFreeze(config()), original = initialGame(level);
  const before = snapshot(original);
  before.tray[0].weight = 999; assert.equal(original.tray[0].weight, 5);
  let state = deepFreeze(original);
  state = deepFreeze(transition(state, level, { type: 'select', ballId: 'w0' }).state);
  state = deepFreeze(transition(state, level, { type: 'drop', tubeIndex: 0 }).state);
  assert.equal(state.tubes[0].currentWeight, 5);
  const next = transition(state, level, { type: 'undo' }).state;
  assert.equal(next.tubes[0].currentWeight, 0); assert.equal(state.tubes[0].currentWeight, 5);
  assert.equal(getBottleVisualState(original.tubes[0]), 'pristine');
});
