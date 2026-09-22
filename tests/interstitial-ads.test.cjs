const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const config = require('../src/services/ads/config.ts');
const { InterstitialController } = require('../src/services/ads/interstitialController.ts');
const { InterstitialPolicy } = require('../src/services/ads/interstitialPolicy.ts');
const { InterstitialGate, RewardedActivity } = require('../src/services/ads/interstitialGate.ts');
const { RewardedController } = require('../src/services/ads/rewardedController.ts');
const { createGameStore } = require('../src/store/gameStore.ts');
const { LEVEL_CONFIGS } = require('../src/data/levels/index.ts');
const { validateLevelConfig } = require('../src/domain/levels/validation.ts');
const { INITIAL_PROGRESS } = require('../src/domain/progress.ts');
const { canRevive } = require('../src/domain/gameplay.ts');
const { memory } = require('./register.cjs');

const KEY = 'test-interstitial';
let attemptSequence = 0; // Attempt IDs are unique across the app's lifetime, restarts included.
function memoryStorage(initial) {
  const data = new Map(initial ? [[KEY, initial]] : []);
  return { data, getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
}
/** A fake native interstitial. Each created ad is recorded so tests can emit SDK events. */
function adHarness(options = {}) {
  const ads = [];
  const controller = new InterstitialController({
    initialize: options.initialize ?? (async () => true),
    create: () => {
      const listeners = new Map();
      const ad = {
        shows: 0, destroyed: false,
        listen: (name, callback) => { listeners.set(name, callback); return () => listeners.delete(name); },
        emit: name => listeners.get(name)?.(),
        load: () => { if (options.loadFails) throw new Error('offline'); },
        show: () => { ad.shows++; return options.show ? options.show(ad) : Promise.resolve(); },
        destroy: () => { ad.destroyed = true; },
      };
      ads.push(ad); return ad;
    },
  }, options.loadTimeout ?? 20_000, options.openTimeout ?? 5_000);
  return { controller, ads, ready: async () => { await controller.preload(); ads.at(-1).emit('loaded'); return ads.at(-1); } };
}
/** Gate with a controllable clock, rewarded state and a fake interstitial that "closes" when told to. */
function gateHarness(t, { storage = memoryStorage(), supported = true, closeAd = true, ...adOptions } = {}) {
  const clock = { now: 10 * 60 * 60_000 };
  const rewarded = { status: 'idle', listeners: new Set() };
  const setRewarded = status => { rewarded.status = status; rewarded.listeners.forEach(listener => listener()); };
  const activity = new RewardedActivity({
    getSnapshot: () => rewarded.status,
    subscribe: listener => { rewarded.listeners.add(listener); return () => rewarded.listeners.delete(listener); },
  }, () => clock.now);
  const ad = adHarness({ ...adOptions, show: adOptions.show ?? (fake => closeAd ? new Promise(resolve => { fake.resolveShow = resolve; setTimeout(() => { fake.emit('opened'); fake.emit('closed'); resolve(); }, 1); }) : Promise.resolve()) });
  t.after(() => ad.controller.dispose());
  const policy = new InterstitialPolicy(storage, KEY);
  const gate = new InterstitialGate({ policy, controller: ad.controller, rewarded: activity, supported, now: () => clock.now });
  const complete = (isReplay = false) => gate.recordLevelResult({ status: 'won', rewardSaved: true, attemptId: `attempt-${++attemptSequence}`, isReplay });
  const completeMany = async count => { for (let i = 0; i < count; i++) await complete(); };
  return { gate, policy, ad, clock, storage, setRewarded, complete, completeMany };
}

test('development always uses Google test interstitial ID; production uses the supplied production ID', () => {
  assert.equal(config.ANDROID_INTERSTITIAL_TEST_ID, 'ca-app-pub-3940256099942544/1033173712');
  assert.equal(config.selectInterstitialUnitId(true), 'ca-app-pub-3940256099942544/1033173712');
  assert.equal(config.selectInterstitialUnitId(true, 'ca-app-pub-1563611163993912/6139884934'), config.ANDROID_INTERSTITIAL_TEST_ID);
  assert.equal(config.selectInterstitialUnitId(false), 'ca-app-pub-1563611163993912/6139884934');
  assert.equal(config.ANDROID_INTERSTITIAL_PRODUCTION_ID, 'ca-app-pub-1563611163993912/6139884934');
  assert.throws(() => config.selectInterstitialUnitId(false, 'ca-app-pub-1563611163993912~1640393419'));
  // Rewarded IDs are unchanged and the two units can never be confused.
  assert.equal(config.selectRewardedUnitId(false), 'ca-app-pub-1563611163993912/3795783460');
  assert.notEqual(config.ANDROID_INTERSTITIAL_PRODUCTION_ID, config.ANDROID_REWARDED_PRODUCTION_ID);
  assert.notEqual(config.ANDROID_INTERSTITIAL_TEST_ID, config.ANDROID_REWARDED_TEST_ID);
});

test('1st-4th new completions are not eligible; the 5th is', async t => {
  const h = gateHarness(t); await h.ad.ready();
  for (let i = 1; i <= 4; i++) {
    assert.equal(await h.complete(), true);
    assert.equal(await h.gate.presentIfDue(), 'not-due', `completion ${i}`);
  }
  assert.equal(h.ad.ads[0].shows, 0);
  await h.complete();
  assert.equal(await h.gate.presentIfDue(), 'shown');
  assert.equal(h.ad.ads[0].shows, 1);
});
test('the counter restarts after an opportunity: completions 6-10 show after the 10th only', async t => {
  const h = gateHarness(t); await h.ad.ready();
  await h.completeMany(5); assert.equal(await h.gate.presentIfDue(), 'shown');
  h.clock.now += 5 * 60_000; await h.ad.ready();
  await h.completeMany(4); assert.equal(await h.gate.presentIfDue(), 'not-due');
  await h.complete(); assert.equal(await h.gate.presentIfDue(), 'shown');
});
test('replaying an already-completed level does not increment the counter', async t => {
  const h = gateHarness(t); await h.ad.ready();
  await h.completeMany(4);
  for (let i = 0; i < 6; i++) assert.equal(await h.complete(true), false);
  assert.equal(await h.gate.presentIfDue(), 'not-due');
  assert.equal(h.policy.getSnapshot().completions, 4);
  await h.complete(); assert.equal(await h.gate.presentIfDue(), 'shown');
});
test('failed attempts, unsaved rewards and repeated observations of one win never count', async t => {
  const h = gateHarness(t); await h.ad.ready();
  await h.completeMany(4);
  for (let i = 0; i < 5; i++) {
    assert.equal(await h.gate.recordLevelResult({ status: 'lost', rewardSaved: false, attemptId: `lost-${i}`, isReplay: false }), false);
    assert.equal(await h.gate.recordLevelResult({ status: 'playing', rewardSaved: false, attemptId: `play-${i}`, isReplay: false }), false);
  }
  assert.equal(await h.gate.recordLevelResult({ status: 'won', rewardSaved: false, attemptId: 'unsaved', isReplay: false }), false);
  assert.equal(await h.gate.presentIfDue(), 'not-due');
  assert.equal(await h.gate.recordLevelResult({ status: 'won', rewardSaved: true, attemptId: 'fifth', isReplay: false }), true);
  assert.equal(await h.gate.recordLevelResult({ status: 'won', rewardSaved: true, attemptId: 'fifth', isReplay: false }), false);
  assert.equal(h.policy.getSnapshot().completions, 5);
});
test('the counter survives an app restart and a restored won attempt is not counted twice', async t => {
  const storage = memoryStorage();
  const first = gateHarness(t, { storage }); await first.completeMany(3);
  const second = gateHarness(t, { storage }); await second.ad.ready();
  assert.equal(await second.complete(), true); assert.equal(await second.gate.presentIfDue(), 'not-due');
  const lastId = second.policy.getSnapshot().lastCountedAttemptId;
  const third = gateHarness(t, { storage }); await third.ad.ready();
  assert.equal(await third.gate.recordLevelResult({ status: 'won', rewardSaved: true, attemptId: lastId, isReplay: false }), false);
  assert.equal(await third.complete(), true);
  assert.equal(await third.gate.presentIfDue(), 'shown');
});
test('a corrupt or unavailable saved counter starts fresh and never blocks progress', async t => {
  const corrupt = gateHarness(t, { storage: memoryStorage('{not json') });
  assert.equal(await corrupt.complete(), true); assert.equal(corrupt.policy.getSnapshot().completions, 1);
  const broken = { getItem: async () => { throw new Error('disk'); }, setItem: async () => { throw new Error('disk'); } };
  const h = gateHarness(t, { storage: broken }); await h.ad.ready(); await h.completeMany(5);
  assert.equal(await h.gate.presentIfDue(), 'shown');
});

test('ad unavailable: the player continues normally and the opportunity is spent', async t => {
  const h = gateHarness(t, { initialize: async () => false });
  await h.completeMany(5);
  let proceeded = 0;
  assert.equal(await h.gate.continueWith(() => proceeded++), true);
  assert.equal(proceeded, 1); assert.equal(h.ad.ads.length, 0);
  assert.equal(h.policy.getSnapshot().completions, 0);
});
test('an ad that has not finished loading is skipped, never waited for', async t => {
  const h = gateHarness(t); await h.completeMany(5); await h.ad.controller.preload();
  assert.equal(h.ad.controller.getSnapshot(), 'loading');
  let proceeded = 0; const started = Date.now();
  await h.gate.continueWith(() => proceeded++);
  assert.equal(proceeded, 1); assert(Date.now() - started < 50); assert.equal(h.ad.ads[0].shows, 0);
});
for (const [name, show] of [
  ['rejected promise', () => Promise.reject(new Error('no activity'))],
  ['synchronous exception', () => { throw new Error('native error'); }],
  ['error event', ad => { setTimeout(() => ad.emit('error'), 1); return new Promise(() => {}); }],
  ['never opens', () => new Promise(() => {})],
]) test(`ad show error (${name}): the player continues normally`, async t => {
  const h = gateHarness(t, { show, openTimeout: 20 }); await h.ad.ready(); await h.completeMany(5);
  let proceeded = 0;
  await h.gate.continueWith(() => proceeded++);
  assert.equal(proceeded, 1); assert.equal(h.ad.controller.getSnapshot(), 'unavailable');
  assert(h.ad.ads[0].destroyed); assert.equal(h.policy.getSnapshot().lastShownAt, 0);
});
test('ad closed: the player proceeds only after it closes, and the next ad preloads', async t => {
  const h = gateHarness(t, { show: () => new Promise(() => {}) }); const ad = await h.ad.ready(); await h.completeMany(5);
  const order = []; const done = h.gate.continueWith(() => order.push('proceed'));
  await delay(5); assert.deepEqual(order, []); assert.equal(h.ad.controller.getSnapshot(), 'showing');
  ad.emit('opened'); await delay(5); assert.deepEqual(order, []);
  ad.emit('closed'); await done;
  assert.deepEqual(order, ['proceed']);
  assert.equal(h.policy.getSnapshot().lastShownAt, h.clock.now);
  await delay(5); assert.equal(h.ad.ads.length, 2); assert.equal(h.ad.controller.getSnapshot(), 'loading');
  assert(ad.destroyed);
});
test('an interstitial is never shown right after a rewarded ad, and the spent opportunity does not queue', async t => {
  const h = gateHarness(t); await h.ad.ready(); await h.completeMany(5);
  h.setRewarded('showing'); h.setRewarded('idle'); h.clock.now += 5_000;
  assert.equal(await h.gate.presentIfDue(), 'blocked'); assert.equal(h.ad.ads[0].shows, 0);
  await h.completeMany(5); h.clock.now += 3 * 60_000;
  assert.equal(await h.gate.presentIfDue(), 'shown');
});
test('an interstitial is never shown while a rewarded ad is on screen', async t => {
  const h = gateHarness(t); await h.ad.ready(); await h.completeMany(5);
  h.setRewarded('showing');
  assert.equal(await h.gate.presentIfDue(), 'blocked'); assert.equal(h.ad.ads[0].shows, 0);
});
test('two interstitials are never back-to-back', async t => {
  const h = gateHarness(t); await h.ad.ready(); await h.completeMany(5);
  assert.equal(await h.gate.presentIfDue(), 'shown'); await h.ad.ready();
  h.clock.now += 10_000; await h.completeMany(5);
  assert.equal(await h.gate.presentIfDue(), 'blocked');
});
test('a wound-back device clock cannot permanently block interstitials', async t => {
  const h = gateHarness(t); await h.ad.ready(); await h.completeMany(5); await h.gate.presentIfDue();
  h.clock.now -= 24 * 60 * 60_000; await h.ad.ready(); await h.completeMany(5);
  assert.equal(await h.gate.presentIfDue(), 'shown');
});
test('repeated Continue taps show at most one ad and proceed exactly once', async t => {
  let release; const h = gateHarness(t, { show: () => new Promise(resolve => { release = resolve; }) });
  const ad = await h.ad.ready(); await h.completeMany(5);
  let proceeded = 0;
  const taps = [1, 2, 3, 4].map(() => h.gate.continueWith(() => proceeded++));
  await delay(5); ad.emit('opened'); ad.emit('closed'); release();
  assert.deepEqual(await Promise.all(taps), [true, false, false, false]);
  assert.equal(proceeded, 1); assert.equal(ad.shows, 1);
  // Even a direct second request finds nothing due and no ad on screen.
  assert.equal(await h.gate.presentIfDue(), 'not-due');
});
test('duplicate SDK events cannot settle or show an ad twice', async t => {
  const h = gateHarness(t, { show: () => new Promise(() => {}) }); const ad = await h.ad.ready(); await h.completeMany(5);
  const first = h.ad.controller.show();
  assert.equal(await h.ad.controller.show(), 'busy');
  ad.emit('closed'); ad.emit('closed'); ad.emit('error');
  assert.equal(await first, 'closed'); assert.equal(ad.shows, 1);
});
test('unsupported platforms (web, iOS, Expo Go) never count, load or show anything', async t => {
  const h = gateHarness(t, { supported: false });
  assert.equal(await h.complete(), false); assert.equal(h.policy.getSnapshot().completions, 0);
  let proceeded = 0; await h.gate.continueWith(() => proceeded++);
  assert.equal(proceeded, 1); assert.equal(await h.gate.presentIfDue(), 'unsupported'); assert.equal(h.ad.ads.length, 0);
});
test('a proceed() failure still releases the transition lock', async t => {
  const h = gateHarness(t);
  await assert.rejects(h.gate.continueWith(() => { throw new Error('nav'); }));
  let proceeded = 0; assert.equal(await h.gate.continueWith(() => proceeded++), true); assert.equal(proceeded, 1);
});

test('RewardedActivity follows the real rewarded controller through show and close', async () => {
  const ads = [];
  const controller = new RewardedController({
    initialize: async () => true,
    create: () => {
      const listeners = new Map();
      const ad = { listen: (name, callback) => { listeners.set(name, callback); return () => listeners.delete(name); },
        emit: name => listeners.get(name)?.(), load() {}, show: async () => {}, destroy() {} };
      ads.push(ad); return ad;
    },
  });
  let now = 1_000; const activity = new RewardedActivity(controller, () => now);
  assert.equal(activity.sinceLast(), Infinity);
  await controller.preload(); ads[0].emit('loaded');
  await controller.show({ owner: {}, isValid: () => true, onEarned() {} });
  assert.equal(activity.isActive(), true);
  now = 5_000; ads[0].emit('closed');
  assert.equal(activity.isActive(), false); assert.equal(activity.sinceLast(), 0);
  now += 1_000; assert.equal(activity.sinceLast(), 1_000);
  controller.dispose();
});

test('preloading is deferred to the SDK, refreshed after close, and suspended for privacy changes', async () => {
  const h = adHarness(); const ad = await h.ready();
  assert.equal(h.controller.getSnapshot(), 'ready');
  await h.controller.preload(); assert.equal(h.ads.length, 1);
  assert(h.controller.suspend()); assert(ad.destroyed); assert.equal(await h.controller.show(), 'not-ready');
  await h.controller.preload(); assert.equal(h.ads.length, 1);
  await h.controller.resume(); assert.equal(h.ads.length, 2); h.controller.dispose();
});
test('disposing while an ad is showing settles the waiting caller', async () => {
  const h = adHarness({ show: () => new Promise(() => {}) }); await h.ready();
  const pending = h.controller.show(); h.controller.dispose();
  assert.equal(await pending, 'failed');
});

// Real store: `isReplay` is what the counter trusts, so prove the store sets it correctly.
async function freshStore(progress = {}) {
  memory.set('balance-keeper-progress', JSON.stringify({ state: { progress: { ...structuredClone(INITIAL_PROGRESS), ...progress } }, version: 0 }));
  const store = createGameStore(); await store.persist.rehydrate(); return store;
}
function solve(store, levelId) {
  const report = validateLevelConfig(LEVEL_CONFIGS.find(level => level.id === levelId), { campaign: true, nodeLimit: 12000 });
  for (const move of report.solver.solution) {
    const state = store.getState();
    store.getState().selectBall(move.weightId);
    assert(store.getState().placeBall(state.tubes.findIndex(bottle => bottle.id === move.bottleId)), `${levelId}: ${JSON.stringify(move)}`);
  }
  assert.equal(store.getState().status, 'won');
}
test('real store: a first win counts, its replay does not, and a failed attempt never reaches the counter', async t => {
  const store = await freshStore({ highestUnlockedLevel: 8, unlockedLevels: [1, 2, 3, 4, 5, 6, 7, 8] });
  const h = gateHarness(t); await h.ad.ready();
  const record = () => { const s = store.getState(); return h.gate.recordLevelResult({ status: s.status, rewardSaved: s.rewardCommitStatus === 'saved', attemptId: s.attemptId, isReplay: s.isReplay }); };

  // Failed attempt: bottle breaks on level 8.
  store.getState().loadLevel(8);
  for (let i = 0; i < 3; i++) { store.getState().selectBall(store.getState().tray.find(ball => ball.weight === 9).id); store.getState().placeBall(0); }
  assert.equal(store.getState().status, 'lost'); assert(canRevive(store.getState()));
  assert.equal(await record(), false);

  // First completion of level 1.
  assert(store.getState().loadLevel(1)); assert.equal(store.getState().isReplay, false);
  solve(store, 1); assert.equal(await record(), false, 'reward not saved yet');
  assert.equal((await store.getState().commitLevelReward(store.getState().attemptId)).accepted, true);
  assert.equal(await record(), true);

  // Replaying the completed level: isReplay is set, so it cannot count.
  assert(store.getState().finishResult(store.getState().attemptId, 'replay')); assert.equal(store.getState().isReplay, true);
  solve(store, 1); await store.getState().commitLevelReward(store.getState().attemptId);
  assert.equal(await record(), false);
  assert.equal(h.policy.getSnapshot().completions, 1);
  await store.getState().flushPersistence();
});
