const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { RewardedController } = require('../src/services/ads/rewardedController.ts');
const { ConsentManager } = require('../src/services/ads/consentManager.ts');
const { selectRewardedUnitId, ANDROID_REWARDED_TEST_ID, ANDROID_REWARDED_PRODUCTION_ID } = require('../src/services/ads/config.ts');
const { createGameStore, useGameStore } = require('../src/store/gameStore.ts');
const { INITIAL_PROGRESS } = require('../src/domain/progress.ts');
const { canRevive } = require('../src/domain/gameplay.ts');
const { memory } = require('./register.cjs');

function harness(t, options = {}) {
  const ads = [];
  const controller = new RewardedController({
    initialize: options.initialize ?? (async () => true),
    create: () => {
      const listeners = new Map();
      const ad = {
        shows: 0, destroyed: false,
        listen: (name, callback) => { listeners.set(name, callback); return () => listeners.delete(name); },
        emit: name => listeners.get(name)?.(),
        callback: name => listeners.get(name),
        listenerCount: () => listeners.size,
        load: () => { if (options.loadFails) throw new Error('offline'); },
        show: () => { ad.shows++; return options.show ? options.show() : Promise.resolve(); },
        destroy: () => { ad.destroyed = true; },
      };
      ads.push(ad); return ad;
    },
  }, options.timeout ?? 20_000);
  t.after(() => controller.dispose());
  return { controller, ads, ready: async () => { await controller.initialize(); ads.at(-1).emit('loaded'); return ads.at(-1); } };
}
function request(overrides = {}) {
  const events = { earned: 0, closed: [], errors: 0 };
  return { events, args: { owner: {}, isValid: () => true, onEarned: () => events.earned++,
    onDismissed: earned => events.closed.push(earned), onError: () => events.errors++, ...overrides } };
}
test('development always selects Google test ads, production selects the supplied real unit', () => {
  assert.equal(selectRewardedUnitId(true), 'ca-app-pub-3940256099942544/5224354917');
  assert.equal(selectRewardedUnitId(true, 'invalid-or-live-override'), ANDROID_REWARDED_TEST_ID);
  assert.equal(selectRewardedUnitId(false), 'ca-app-pub-1563611163993912/3795783460');
  assert.equal(selectRewardedUnitId(false), ANDROID_REWARDED_PRODUCTION_ID);
  assert.throws(() => selectRewardedUnitId(false, 'ca-app-pub-1563611163993912~1640393419'));
  const plugin = require('../app.json').expo.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(plugin[1].androidAppId, 'ca-app-pub-1563611163993912~1640393419');
  assert.equal(plugin[1].delayAppMeasurementInit, true);
});
test('opening and closing early never reward; dismissal reports no earned reward', async t => {
  const h = harness(t), ad = await h.ready(), r = request();
  await h.controller.show(r.args); ad.emit('opened');
  assert.equal(r.events.earned, 0);
  ad.emit('closed'); assert.equal(r.events.earned, 0); assert.deepEqual(r.events.closed, [false]);
  await Promise.resolve(); assert.equal(h.ads.length, 2); assert.equal(ad.listenerCount(), 0); assert(ad.destroyed);
});
test('earned event grants exactly once; repeated taps cannot open another ad', async t => {
  const h = harness(t), ad = await h.ready(), r = request();
  const first = h.controller.show(r.args);
  assert.deepEqual(await h.controller.show(r.args), { shown: false, reason: 'busy' });
  await first; ad.emit('earned'); ad.emit('earned');
  assert.equal(r.events.earned, 1); assert.equal(ad.shows, 1);
  ad.emit('closed'); assert.equal(r.events.earned, 1); assert.deepEqual(r.events.closed, [true]);
});
test('no inventory and load failures leave rewards untouched', async t => {
  const h = harness(t, { loadFails: true }), r = request();
  assert.deepEqual(await h.controller.show(r.args), { shown: false, reason: 'not-ready' });
  await h.controller.initialize(); assert.equal(h.controller.getSnapshot(), 'unavailable');
  await h.controller.show(r.args); assert.equal(r.events.earned, 0);
});
for (const [name, show] of [
  ['rejected promise', () => Promise.reject(new Error('no activity'))],
  ['synchronous exception', () => { throw new Error('native error'); }],
]) test(`show failure (${name}) grants nothing and releases listeners`, async t => {
  const h = harness(t, { show }), ad = await h.ready(), r = request();
  assert.deepEqual(await h.controller.show(r.args), { shown: false, reason: 'failed' });
  ad.emit('earned'); assert.equal(r.events.earned, 0); assert.equal(r.events.errors, 1);
  assert.equal(h.controller.getSnapshot(), 'unavailable'); assert.equal(ad.listenerCount(), 0);
});
test('SDK error events and late callbacks cannot reward after a failed show', async t => {
  const h = harness(t), ad = await h.ready(), r = request();
  const lateReward = ad.callback('earned');
  await h.controller.show(r.args); ad.emit('error'); lateReward();
  assert.equal(r.events.earned, 0); assert.equal(r.events.errors, 1);
});
test('navigation cancellation keeps the global showing lock but invalidates the reward', async t => {
  const h = harness(t), ad = await h.ready(), r = request();
  await h.controller.show(r.args); h.controller.cancel(r.args.owner);
  ad.emit('earned'); assert.equal(r.events.earned, 0);
  assert.equal((await h.controller.show(request().args)).reason, 'busy');
  ad.emit('closed'); assert.deepEqual(r.events.closed, []);
});
test('request validity is checked both before showing and when the SDK rewards', async t => {
  const h = harness(t), ad = await h.ready(); let valid = false;
  const r = request({ isValid: () => valid });
  assert.equal((await h.controller.show(r.args)).reason, 'stale'); assert.equal(ad.shows, 0);
  valid = true; await h.controller.show(r.args); valid = false; ad.emit('earned');
  assert.equal(r.events.earned, 0);
});
test('preload deduplicates concurrent callers and ignores late load events after disposal', async t => {
  const h = harness(t);
  await Promise.all([h.controller.preload(), h.controller.preload(), h.controller.initialize()]);
  assert.equal(h.ads.length, 1); const ad = h.ads[0], late = ad.callback('loaded');
  h.controller.dispose(); late(); assert.equal(h.controller.getSnapshot(), 'unavailable');
  assert.equal(ad.listenerCount(), 0);
});
test('offline loads time out and never remain loading indefinitely', async t => {
  const h = harness(t, { timeout: 5 }); await h.controller.initialize();
  await delay(15); assert.equal(h.controller.getSnapshot(), 'unavailable'); assert(h.ads[0].destroyed);
});
test('initialization timeout ignores a late native initialization result', async t => {
  let resolve; const h = harness(t, { timeout: 5, initialize: () => new Promise(r => { resolve = r; }) });
  const loading = h.controller.initialize(); await delay(15);
  assert.equal(h.controller.getSnapshot(), 'unavailable'); resolve(true); await loading;
  assert.equal(h.ads.length, 0);
});
test('replacing a consumed ad never applies its late reward to the next request', async t => {
  const h = harness(t), old = await h.ready(), first = request(), second = request();
  const late = old.callback('earned'); await h.controller.show(first.args); old.emit('closed');
  await Promise.resolve(); h.ads[1].emit('loaded'); await h.controller.show(second.args); late();
  assert.equal(first.events.earned, 0); assert.equal(second.events.earned, 0);
  h.ads[1].emit('earned'); assert.equal(second.events.earned, 1);
});
test('privacy changes discard inventory and prevent ad loading until resumed', async t => {
  const h = harness(t), ad = await h.ready();
  assert(h.controller.suspend()); await h.controller.preload(); assert.equal(h.ads.length, 1);
  assert(ad.destroyed); await h.controller.resume(); assert.equal(h.ads.length, 2);
});

function consentHarness(overrides = {}) {
  const calls = { update: 0, forms: 0, initialize: 0 };
  let info = { canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' };
  const manager = new ConsentManager({
    requestInfoUpdate: async () => { calls.update++; return info; },
    loadAndShowConsentFormIfRequired: async () => { calls.forms++; return info; },
    getConsentInfo: async () => info,
    showPrivacyOptionsForm: async () => { info = { ...info, canRequestAds: false }; return info; },
    initializeAds: async () => { calls.initialize++; },
    ...overrides,
  }, 5);
  return { manager, calls };
}
test('UMP precedes initialization and repeated initialization calls initialize the SDK once', async () => {
  const { manager, calls } = consentHarness();
  assert.deepEqual(await Promise.all([manager.initialize(), manager.initialize()]), [true, true]);
  await manager.initialize(); assert.deepEqual(calls, { update: 1, forms: 1, initialize: 1 });
  assert(manager.getSnapshot().required);
});
test('UMP denial never initializes or loads ads', async () => {
  const { manager, calls } = consentHarness({ getConsentInfo: async () => ({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' }) });
  assert.equal(await manager.initialize(), false); assert.equal(calls.initialize, 0);
});
test('consent network failure uses only permission returned by UMP, with a bounded wait', async () => {
  const cached = consentHarness({ requestInfoUpdate: () => new Promise(() => {}) });
  assert.equal(await cached.manager.initialize(), true); assert.equal(cached.calls.forms, 0);
  const unknown = consentHarness({ requestInfoUpdate: async () => { throw Error('offline'); }, getConsentInfo: async () => { throw Error('offline'); } });
  assert.equal(await unknown.manager.initialize(), false); assert.equal(unknown.calls.initialize, 0);
});
test('privacy options changes are consulted before the next request', async () => {
  const { manager, calls } = consentHarness(); await manager.initialize();
  assert.equal(await manager.showPrivacyOptions(), true);
  assert.equal(await manager.initialize(), false); assert.equal(calls.initialize, 1);
});
test('failed privacy form reports an error and enables retry', async () => {
  const { manager } = consentHarness({ showPrivacyOptionsForm: async () => { throw Error('offline'); } });
  await manager.initialize(); assert.equal(await manager.showPrivacyOptions(), false);
  assert.equal(manager.getSnapshot().busy, false); assert(manager.getSnapshot().error);
});

async function brokenStore() {
  await useGameStore.persist.rehydrate(); await useGameStore.getState().flushPersistence();
  memory.set('balance-keeper-progress', JSON.stringify({ state: { progress: { ...structuredClone(INITIAL_PROGRESS), coins: 200, highestUnlockedLevel: 8 } }, version: 0 }));
  const store = createGameStore(); await store.persist.rehydrate(); store.getState().loadLevel(8);
  for (let i = 0; i < 3; i++) {
    store.getState().selectBall(store.getState().tray.find(ball => ball.weight === 9).id);
    store.getState().placeBall(0);
  }
  assert(canRevive(store.getState())); return store;
}
test('real store: SDK reward restores once without coins, persists allowance, and restart remains available', async t => {
  const store = await brokenStore(), attemptId = store.getState().attemptId, wallet = store.getState().progress;
  const h = harness(t), ad = await h.ready();
  await h.controller.show(request({ isValid: () => store.getState().attemptId === attemptId,
    onEarned: () => store.getState().reviveWithEarnedReward(attemptId) }).args);
  ad.emit('opened'); assert.equal(store.getState().status, 'lost'); assert.equal(store.getState().progress, wallet);
  ad.emit('earned'); ad.emit('earned'); ad.emit('closed');
  assert.equal(store.getState().status, 'playing'); assert.equal(store.getState().revivesUsed, 1);
  assert.equal(store.getState().progress, wallet); assert.equal(store.getState().reviveWithEarnedReward(attemptId).accepted, false);
  await delay(430); await store.getState().flushPersistence();
  const resumed = createGameStore(); await resumed.persist.rehydrate();
  assert.equal(resumed.getState().revivesUsed, 1); assert.equal(resumed.getState().progress.coins, 200);
  assert.equal(resumed.getState().resetGame(), true); assert.equal(resumed.getState().revivesUsed, 0);
  assert.notEqual(resumed.getState().attemptId, attemptId); await resumed.getState().flushPersistence();
});
test('real store rejects a reward belonging to an old attempt without changing state or wallet', async () => {
  const store = await brokenStore(), before = store.getState();
  assert.equal(store.getState().reviveWithEarnedReward('old-attempt').accepted, false);
  assert.equal(store.getState(), before); await store.getState().flushPersistence();
});
test('real store: early dismissal leaves coin Continue at 150 coins', async t => {
  const store = await brokenStore(), before = store.getState(), h = harness(t), ad = await h.ready();
  await h.controller.show(request({ onEarned: () => store.getState().reviveWithEarnedReward(before.attemptId) }).args);
  ad.emit('opened'); ad.emit('closed'); assert.equal(store.getState(), before);
  assert.equal(store.getState().revive().accepted, true); assert.equal(store.getState().progress.coins, 50);
  await delay(430); await store.getState().flushPersistence();
});
