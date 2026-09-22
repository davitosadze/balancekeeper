const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { normalizeLevel } = require('../src/domain/levelConfig.ts');
const { initialGame, transition, snapshot, canRevive, gameplayActions } = require('../src/domain/gameplay.ts');
const { GAME_ECONOMY, canAfford, spendCoins, addCoins, commitReward, rewardTransactionId } = require('../src/domain/economy.ts');
const { INITIAL_PROGRESS, restoreProgress, migrateProgressStorage } = require('../src/domain/progress.ts');
const { orderedStorage } = require('../src/domain/persistence.ts');
const { LEVELS } = require('../src/data/levels/index.ts');
const { memory } = require('./register.cjs');
const { createGameStore, useGameStore } = require('../src/store/gameStore.ts');
const key = 'balance-keeper-progress';
const profile = coins => ({ ...structuredClone(INITIAL_PROGRESS), coins });
function config(rules = {}, extra = {}) {
  return normalizeLevel({ id: 3, difficulty: 'medium',
    bottles: [{ id: 'b1', target: 5, durability: 3, type: 'normal' }, { id: 'b2', target: 8, durability: 3, type: 'normal' }],
    weights: [2, 3, 3, 5].map((value, index) => ({ id: `w${index + 1}`, value, color: 'blue', type: 'normal' })),
    rules: { allowUndo: true, allowHint: true, ...rules },
    rewards: { baseCoins: 60, perfectFitCoins: 10, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 }, threeStarBonus: 25 },
    stars: { twoStarMaxMoves: 6, threeStarMaxMoves: 4 }, ...extra });
}
function game(level = config(), coins = 1000) {
  let state = initialGame(level, 'attempt-1'), progress = profile(coins), at = 0;
  const action = value => {
    const action = typeof value === 'string' ? { type: value } : value;
    const result = transition(state, level, action, ++at, progress.coins, () => .5);
    if (result.accepted && result.cost) {
      const spend = spendCoins(progress, result.cost, action.type, `tx-${at}`); assert(spend.applied); progress = spend.progress;
    }
    state = result.state; return result;
  };
  const drop = (weight, tubeIndex = 0) => {
    const ball = state.tray.find(ball => ball.weight === weight); assert(ball);
    action({ type: 'select', ballId: ball.id }); return action({ type: 'drop', tubeIndex });
  };
  const breakBottle = () => { drop(3); drop(3); drop(5); drop(5); drop(5); };
  return { action, drop, breakBottle, get state() { return state; }, get progress() { return progress; } };
}
async function freshStore(saved = profile(0), attempt) {
  // Settle the production singleton before creating the isolated re-launch instance.
  await useGameStore.persist.rehydrate(); await useGameStore.getState().flushPersistence();
  memory.set(key, JSON.stringify({ state: { progress: saved, sessionVersion: 2, attempt }, version: 0 }));
  const store = createGameStore(); await store.persist.rehydrate(); await store.getState().flushPersistence();
  return store;
}
function dropStore(store, weight, index = 0) {
  const ball = store.getState().tray.find(ball => ball.weight === weight); assert(ball);
  store.getState().selectBall(ball.id); return store.getState().placeBall(index);
}
const pending = (attemptId = 'win-1', overrides = {}) => ({ attemptId, levelId: 1, stars: 3, moves: 1, perfectFits: 1, score: 10,
  rewards: { baseCoins: 40, perfectFitCoins: 10, comboBonus: 0, threeStarBonus: 25, total: 75 }, ...overrides });

test('central defaults and level overrides determine every utility price and allowance', () => {
  assert.equal(GAME_ECONOMY.hintCost, 50); assert.equal(GAME_ECONOMY.undoCost, 30);
  assert.equal(GAME_ECONOMY.shuffleCost, 25); assert.equal(GAME_ECONOMY.reviveCost, 150);
  const level = config({ freeHints: 2, freeUndos: 4, hintCost: 12, undoCost: 8, shuffleCost: 7, reviveCost: 99 });
  const state = initialGame(level); assert.equal(state.freeHintsRemaining, 2); assert.equal(state.freeUndosRemaining, 4);
  assert.equal(gameplayActions(state, level, 20).shuffle.cost, 7);
});
test('coin transactions cannot overdraw, accept negative amounts, or overflow', () => {
  const p = profile(20);
  for (const amount of [-1, 21, NaN, Infinity, .5]) assert.equal(spendCoins(p, amount, 'hint', `bad-${amount}`).applied, false);
  assert.equal(canAfford(20, 21), false); assert.equal(canAfford(20, 20), true);
  assert.equal(spendCoins(p, 20, 'hint', 'all').progress.coins, 0);
  assert.equal(addCoins(p, -1, 'level_reward', 'bad').applied, false);
  assert.equal(addCoins(profile(Number.MAX_SAFE_INTEGER), 1, 'level_reward', 'overflow').applied, false);
  assert.equal(p.coins, 20);
});
test('transaction IDs make adds and spends idempotent even after the balance changes', () => {
  const first = spendCoins(profile(50), 50, 'hint', 'one-hint');
  assert.equal(first.progress.coins, 0);
  const repeated = spendCoins(first.progress, 50, 'hint', 'one-hint');
  assert.equal(repeated.progress, first.progress); assert.equal(repeated.transaction.balanceAfter, 0);
  const add = addCoins(first.progress, 75, 'level_reward', 'one-reward');
  assert.equal(addCoins(add.progress, 75, 'level_reward', 'one-reward').progress.coins, 75);
});
test('reward commit updates the wallet, best results and next unlock exactly once', () => {
  const result = commitReward(profile(0), pending());
  assert.equal(result.progress.coins, 75); assert.equal(result.progress.highestUnlockedLevel, 2);
  assert.deepEqual(result.progress.levelProgress[1], { levelId: 1, completed: true, bestStars: 3, bestMoves: 1, bestPerfectFits: 1, bestScore: 10 });
  assert.equal(result.progress.levelsCompleted, 1);
  const repeat = commitReward(result.progress, pending());
  assert.equal(repeat.applied, false); assert.equal(repeat.progress, result.progress);
});
test('replay results never reduce stars or move records, and first completion only updates completion count once', () => {
  const first = commitReward(profile(0), pending('first', { moves: 4 })).progress;
  const replay = commitReward(first, pending('replay', { stars: 2, moves: 5, perfectFits: 0 })).progress;
  assert.equal(replay.levelProgress[1].bestStars, 3); assert.equal(replay.levelProgress[1].bestMoves, 4);
  assert.equal(replay.levelProgress[1].bestPerfectFits, 1); assert.equal(replay.levelsCompleted, 1);
  const faster = commitReward(replay, pending('faster', { stars: 1, moves: 2 })).progress;
  assert.equal(faster.levelProgress[1].bestMoves, 2); assert.equal(faster.highestUnlockedLevel, 2);
});
test('hint consumes a free allowance before charging 50, highlights without playing, and resets combo', () => {
  const g = game(); g.drop(2); const moves = g.state.moves;
  assert.equal(g.action('hint').cost, 0); assert.equal(g.state.freeHintsRemaining, 0); assert.equal(g.progress.coins, 1000);
  assert.equal(g.state.hintUsed, 1); assert.equal(g.state.combo, 0); assert(g.state.hintMove);
  assert.equal(g.state.moves, moves); assert.equal(g.action('hint').cost, 50); assert.equal(g.progress.coins, 950);
  assert.equal(g.state.hintUsed, 2); g.drop(3); assert.equal(g.state.hintMove, null);
});
test('no valid hint spends no coins and consumes no free allowance', () => {
  const level = config({}, { bottles: [{ id: 'b1', target: 5, durability: 3, type: 'normal' }],
    weights: [{ id: 'w1', value: 3, color: 'blue', type: 'normal' }, { id: 'w2', value: 4, color: 'blue', type: 'normal' }] });
  const g = game(level); g.drop(3);
  assert.equal(g.action('hint').accepted, false); assert.equal(g.progress.coins, 1000);
  assert.equal(g.state.freeHintsRemaining, 1); assert.equal(g.state.hintUsed, 0);
});
test('hint requires sufficient funds after free uses, even with a valid solution', () => {
  const g = game(config({ freeHints: 0 }), 49), before = g.state;
  assert.equal(g.action('hint').accepted, false); assert.equal(g.state, before); assert.equal(g.progress.coins, 49);
});
test('three free undos then paid undo; no history never charges', () => {
  const g = game(); assert.equal(g.action('undo').accepted, false);
  for (let i = 0; i < 3; i++) { g.drop(2); assert.equal(g.action('undo').cost, 0); }
  assert.equal(g.state.freeUndosRemaining, 0); assert.equal(g.progress.coins, 1000);
  g.drop(2); assert.equal(g.action('undo').cost, 30); assert.equal(g.progress.coins, 970);
  assert.equal(g.state.undoUsed, 4); assert.equal(g.state.combo, 0);
  assert.equal(g.action('undo').accepted, false); assert.equal(g.progress.coins, 970);
});
test('undo restores Perfect Fit and combo rewards, without refunding persistent purchases', () => {
  const g = game(config({ freeUndos: 0 })); g.drop(2); g.drop(3);
  assert.equal(g.state.coinsEarned, 12); assert.equal(g.state.perfectFits, 1); assert.equal(g.state.comboRewardEvents.length, 1);
  g.action('undo'); assert.equal(g.progress.coins, 970); assert.equal(g.state.coinsEarned, 0); assert.equal(g.state.perfectFits, 0);
  assert.equal(g.state.comboRewardEvents.length, 0); g.drop(3);
  assert.equal(g.state.coinsEarned, 10); assert.equal(g.state.perfectFits, 1);
});
test('shuffle charges 25 only for changed tray order and preserves identities, values, moves and combo', () => {
  const g = game(); g.drop(2); const before = snapshot(g.state);
  assert.equal(g.action('shuffle').cost, 25); assert.equal(g.progress.coins, 975);
  assert.notDeepEqual(g.state.tray, before.tray);
  assert.deepEqual([...g.state.tray].sort((a,b) => a.id.localeCompare(b.id)), [...before.tray].sort((a,b) => a.id.localeCompare(b.id)));
  assert.deepEqual(g.state.tubes, before.tubes); assert.equal(g.state.moves, before.moves); assert.equal(g.state.combo, before.combo);
  assert.equal(game(LEVELS[0]).action('shuffle').accepted, false);
  assert.equal(game(config(), 24).action('shuffle').accepted, false);
});
test('combo milestones pay once even after resets and do not repeatedly pay at x5+', () => {
  const level = config({}, { bottles: [{ id: 'b', target: 99, durability: 3, type: 'normal' }],
    weights: Array.from({ length: 15 }, (_, i) => ({ id: `w${i}`, value: 1, color: 'red', type: 'normal' })) });
  const g = game(level); for (let i = 0; i < 7; i++) g.drop(1);
  assert.equal(g.state.coinsEarned, 22); assert.equal(g.state.comboRewardEvents.length, 4);
  g.action('invalidDrop'); for (let i = 0; i < 7; i++) g.drop(1);
  assert.equal(g.state.coinsEarned, 22); assert.equal(g.state.comboRewardEvents.length, 4);
});
test('revive deducts 150, restores pre-break damage and inventory, preserves assistance, and is only usable once', () => {
  const g = game(config(), 150); g.drop(3); g.drop(3); g.drop(5);
  const before = snapshot(g.state); g.drop(5); assert.equal(canRevive(g.state), true);
  assert.equal(g.action('revive').cost, 150); assert.equal(g.progress.coins, 0);
  assert.deepEqual(g.state.tubes, before.tubes); assert.deepEqual(g.state.tray, before.tray);
  assert.equal(g.state.tubes[0].damage, 2); assert.equal(g.state.tubes[0].currentWeight, 3);
  assert.equal(g.state.combo, 0); assert.equal(g.state.revivesUsed, 1); assert.equal(g.state.mistakes, 3);
  assert.equal(g.state.status, 'playing'); assert.equal(g.state.lossReason, null);
  g.drop(5); assert.equal(canRevive(g.state), false); assert.equal(g.action('revive').accepted, false);
});
test('insufficient revive funds preserve the entire lost state and wallet', () => {
  const g = game(config(), 149); g.breakBottle(); const lost = g.state;
  assert.equal(g.action('revive').accepted, false); assert.equal(g.state, lost); assert.equal(g.progress.coins, 149);
});
test('migration preserves legacy coins, best stars and all existing unlocks without inventing moves', () => {
  const legacy = { coins: 250, unlockedLevels: [1, 3], levelProgress: { 1: { completed: true, stars: 3, bestScore: 200 } } };
  const migrated = restoreProgress(JSON.parse(migrateProgressStorage(JSON.stringify(legacy))).state.progress);
  assert.equal(migrated.coins, 250); assert.equal(migrated.highestUnlockedLevel, 3);
  assert.equal(migrated.levelProgress[1].bestStars, 3); assert.equal(migrated.levelProgress[1].bestMoves, null);
  assert.deepEqual(migrated.transactions, {});
});
test('ordered persistence prevents stale wallet writes overtaking newer transactions', async () => {
  const writes = [], storage = orderedStorage({ getItem: async () => null, removeItem: async () => {},
    setItem: async (_, value) => { await delay(value === 'old' ? 20 : 0); writes.push(value); } });
  storage.setItem('p', 'old'); storage.setItem('p', 'new'); await storage.flush();
  assert.deepEqual(writes, ['old', 'new']);
});
test('ordered persistence exposes save failure and permits retry without an unhandled rejection', async () => {
  let fail = true;
  const storage = orderedStorage({ getItem: async () => null, removeItem: async () => {}, setItem: async () => { if (fail) throw Error('disk'); } });
  storage.setItem('p', 'save'); await assert.rejects(storage.flush(), /disk/);
  fail = false; storage.setItem('p', 'save'); await storage.flush();
});
test('first-install wallet starts at zero, opening a level does not unlock it, and production has no debug action', async () => {
  const store = await freshStore(); assert.equal(store.getState().progress.coins, 0);
  assert.equal(store.getState().progress.highestUnlockedLevel, 1);
  assert.equal(store.getState().loadLevel(2), false); assert.equal(store.getState().level, 1);
  assert.equal(store.getState().debugAddCoins, undefined);
});
test('won reward survives app restart before commit, commits once, and duplicate Continue cannot repeat it', async () => {
  const store = await freshStore(); dropStore(store, 5);
  assert.equal(store.getState().status, 'won'); assert.equal(store.getState().progress.coins, 0);
  assert.equal(store.getState().pendingLevelReward.rewards.total, 60);
  await store.getState().flushPersistence();
  const resumed = createGameStore(); await resumed.persist.rehydrate();
  assert.equal(resumed.getState().status, 'won'); const id = resumed.getState().attemptId;
  await Promise.all([resumed.getState().commitLevelReward(id), resumed.getState().commitLevelReward(id)]);
  await resumed.getState().commitLevelReward(id);
  assert.equal(resumed.getState().progress.coins, 60); assert.equal(resumed.getState().progress.highestUnlockedLevel, 2);
  await resumed.getState().flushPersistence();
  const relaunched = createGameStore(); await relaunched.persist.rehydrate();
  assert.equal(relaunched.getState().rewardCommitStatus, 'saved');
  await relaunched.getState().commitLevelReward(id); assert.equal(relaunched.getState().progress.coins, 60);
  assert.equal(relaunched.getState().finishResult(id, 'continue'), true);
  assert.equal(relaunched.getState().finishResult(id, 'continue'), false);
  assert.equal(relaunched.getState().level, 2); assert.equal(relaunched.getState().progress.coins, 60);
  await relaunched.getState().flushPersistence();
  const saved = JSON.parse(memory.get(key)).state;
  assert.equal(saved.progress.coins, 60); assert.equal(saved.attempt.level, 2);
  assert.equal(Object.keys(saved.progress.transactions).length, 1);
});
test('replaying awards no base reward and does not overwrite three-star records', async () => {
  const p = commitReward(profile(0), pending('first')).progress;
  const store = await freshStore(p); assert.equal(store.getState().isReplay, true);
  store.getState().requestHint(); await delay(430); dropStore(store, 5);
  const reward = store.getState().pendingLevelReward;
  assert.equal(reward.rewards.baseCoins, 0); assert.equal(reward.rewards.total, 10); assert.equal(reward.stars, 2);
  await store.getState().commitLevelReward(store.getState().attemptId);
  assert.equal(store.getState().progress.coins, 85); assert.equal(store.getState().progress.levelProgress[1].bestStars, 3);
});
test('rapid hint and shuffle taps consume at most one allowance or payment', async () => {
  const p = { ...profile(200), highestUnlockedLevel: 8 };
  const store = await freshStore(p); store.getState().loadLevel(8);
  assert.equal(store.getState().requestHint().accepted, true);
  assert.equal(store.getState().requestHint().accepted, false);
  assert.equal(store.getState().hintUsed, 1); assert.equal(store.getState().freeHintsRemaining, 0);
  await delay(430);
  assert.equal(store.getState().requestHint().accepted, true); assert.equal(store.getState().requestHint().accepted, false);
  assert.equal(store.getState().progress.coins, 150); await delay(430);
  assert.equal(store.getState().shuffleTray().accepted, true); assert.equal(store.getState().shuffleTray().accepted, false);
  assert.equal(store.getState().progress.coins, 125); await delay(430);
  await store.getState().flushPersistence();
});
test('revive purchase and allowance persist atomically; restart clears runtime but preserves wallet and progress', async () => {
  const p = { ...profile(200), highestUnlockedLevel: 8 };
  const store = await freshStore(p); store.getState().loadLevel(8);
  for (let i=0;i<3;i++) dropStore(store, 9);
  assert.equal(store.getState().revive().accepted, true); assert.equal(store.getState().revive().accepted, false);
  await delay(430); await store.getState().flushPersistence();
  const resumed = createGameStore(); await resumed.persist.rehydrate();
  assert.equal(resumed.getState().revivesUsed, 1); assert.equal(resumed.getState().progress.coins, 50);
  assert.equal(resumed.getState().tubes[0].damage, 2); dropStore(resumed, 9);
  assert.equal(resumed.getState().revive().accepted, false);
  const savedProfile = structuredClone(resumed.getState().progress), oldId = resumed.getState().attemptId;
  assert.equal(resumed.getState().resetGame(), true);
  const state = resumed.getState(); assert.notEqual(state.attemptId, oldId);
  for (const field of ['moves','mistakes','combo','maxCombo','coinsEarned','perfectFits','hintUsed','undoUsed','revivesUsed','shuffleUsed']) assert.equal(state[field], 0, field);
  assert.equal(state.history.length, 0); assert.equal(state.comboRewardEvents.length, 0); assert.equal(state.pendingLevelReward, null);
  assert.equal(state.freeUndosRemaining, 3); assert.equal(state.freeHintsRemaining, 1);
  assert(state.tubes.every(b => b.damage === 0 && b.currentWeight === 0)); assert.equal(state.tray.length, 5);
  assert.deepEqual(state.progress, savedProfile); await state.flushPersistence();
});
test('failed reward save blocks Continue; retry saves the same receipt without a second credit', async () => {
  const { storageControl } = require('./register.cjs');
  const store = await freshStore(); dropStore(store, 5); await store.getState().flushPersistence();
  const id = store.getState().attemptId;
  storageControl.failWrites = true;
  try {
    const result = await store.getState().commitLevelReward(id);
    assert.equal(result.accepted, false); assert.equal(store.getState().rewardCommitStatus, 'error');
    assert.equal(store.getState().finishResult(id, 'continue'), false);
    assert.equal(store.getState().progress.coins, 60);
    assert.equal(JSON.parse(memory.get(key)).state.progress.coins, 0);
  } finally { storageControl.failWrites = false; }
  assert.equal((await store.getState().commitLevelReward(id)).accepted, true);
  assert.equal(store.getState().progress.coins, 60);
  assert.equal(Object.keys(store.getState().progress.transactions).length, 1);
  await store.getState().flushPersistence(); assert.equal(JSON.parse(memory.get(key)).state.progress.coins, 60);
});
test('debug grants are available only in development, bounded, and use the same transaction layer', async () => {
  global.__DEV__ = true;
  try {
    const store = await freshStore();
    assert.equal(store.getState().debugAddCoins(10001).accepted, false);
    assert.equal(store.getState().debugAddCoins(-1).accepted, false);
    assert.equal(store.getState().debugAddCoins(500).accepted, true);
    assert.equal(store.getState().progress.coins, 500);
    assert.equal(Object.values(store.getState().progress.transactions)[0].reason, 'debug');
    await store.getState().flushPersistence();
  } finally { delete global.__DEV__; }
});
test('a failed utility save blocks further actions and retry persists the existing purchase once', async () => {
  const { storageControl } = require('./register.cjs');
  const store = await freshStore({ ...profile(100), highestUnlockedLevel: 8 });
  store.getState().loadLevel(8); store.getState().requestHint(); await delay(430);
  storageControl.failWrites = true;
  try {
    assert.equal(store.getState().requestHint().accepted, true); await delay(430);
    assert(store.getState().storageError); assert.equal(store.getState().progress.coins, 50);
    assert.equal(store.getState().requestHint().accepted, false);
    assert.equal(JSON.parse(memory.get(key)).state.progress.coins, 100);
  } finally { storageControl.failWrites = false; }
  await store.getState().retrySave(); await store.getState().flushPersistence();
  assert.equal(store.getState().storageError, null);
  const saved = JSON.parse(memory.get(key)).state;
  assert.equal(saved.progress.coins, 50); assert.equal(saved.attempt.hintUsed, 2);
  assert.equal(Object.values(saved.progress.transactions).filter(tx => tx.reason === 'hint').length, 1);
});
