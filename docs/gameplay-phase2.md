> Current scope: [Gameplay Phase 5](gameplay-phase5.md). Earlier phase descriptions below remain historical references.

# Balance Keeper Gameplay Phase 2

Phase 2 adds a persistent economy to the same three basic levels. There are no new
puzzles, advanced bottle/ball mechanics, shop, daily rewards, IAP, or real ads.
The gameplay layout and existing bottle, weight and background assets are retained.

## Files changed

| Files | Changes |
| --- | --- |
| `src/types/game.ts` | Economy/progress/transaction types, attempt identity, pending reward, allowances and combo events |
| `src/domain/economy.ts` (new) | Central prices, affordability, safe transactions and idempotent reward/progress commit |
| `src/domain/persistence.ts` (new) | Ordered writes, attempt serialization and recovery validation |
| `src/domain/gameplay.ts` | Revive and utility authorization, free allowances, shuffle, milestone events and pending rewards |
| `src/domain/progress.ts` | Legacy migration and initial profile |
| `src/domain/levelConfig.ts` | Price/allowance defaults and overrides; milestone validation |
| `src/utils/scoring.ts` | Milestone reward sum and replay base reward policy |
| `src/store/gameStore.ts` | Atomic wallet/attempt updates, reward commit, navigation guards, persistence and dev grants |
| `src/data/levels/phase1.ts`, `src/data/levels/index.ts` | Existing three configs use milestones and persistent unlocks |
| `src/screens/Gameplay.tsx` | Wallet HUD, prices, revive/insufficient-funds modal and save retry |
| `src/screens/LevelComplete.tsx` | Staged reward reveal, balance animation, commit and guarded Continue/Replay |
| `src/screens/LevelSelect.tsx`, `src/screens/MainMenu.tsx` | Saved best results/unlocks, resume behavior and development-only coin grant |
| `src/components/gameplay/GameplayActions.tsx`, `src/components/CountUpText.tsx` | Prices and delayed counter animation from an existing balance |
| `src/hooks/useStorage.ts` | Removes the obsolete competing progress writer; delegates reads/flush to the store |
| `tests/economy.test.cjs` (new), `tests/gameplay.test.cjs`, `tests/register.cjs`, `package.json` | Phase 2 regression suite and controllable storage failures |
| `scripts/check-gameplay.cjs` | Browser checks for reward persistence, paid utilities, revive and layout stability |
| `docs/gameplay-phase2.md`, `docs/gameplay-contract.md`, `docs/gameplay-rules.md`, `docs/gameplay-visual.md` | Current scope, decisions, verification and compatibility notes |

## Persistence and state

The existing Zustand persist store still owns the `balance-keeper-progress`
AsyncStorage key. Its envelope now contains `progress`, `sessionVersion: 2`, and
`attempt`. Each write contains the wallet, transaction records, progress and
runtime together. Writes are serialized to prevent an older save overtaking a
newer transaction. No new database/storage system was introduced.

The existing settings persist independently under `balance-keeper-settings` as
before. Sound, volume and haptic settings were not moved or duplicated.

```ts
progress: {
  coins: number,                      // 0 on first install
  highestUnlockedLevel: number,       // initially 1; monotonically increases
  levelProgress: {
    [levelId]: {
      levelId, completed, bestStars, bestMoves, bestPerfectFits, bestScore
    }
  },
  transactions: {
    [transactionId]: {
      id, reason, amount, balanceBefore, balanceAfter, at
    }
  },
  unlockedLevels, bestScore, levelsCompleted, totalPlaytimeSeconds // compatibility
}

attempt: {
  attemptId, isReplay,
  pendingLevelReward: null | { attemptId, levelId, rewards, stars, moves, perfectFits, score },
  freeHintsRemaining, freeUndosRemaining, shuffleUsed, revivesUsed,
  comboRewardEvents: [{ milestone, coins }],
  // Phase 1 bottles, tray, move/damage state, combo, fits, coinsEarned, Undo history,
  // status, stars, and pre-break revive snapshot are also retained.
}
```

Presentation feedback is cleared on restore. A saved playing, lost or won attempt
can resume, including its paid/free utility usage, Undo history and revive limit.
A finished attempt retains its pending result and receipt across remounts/relaunches.
Invalid or incompatible attempt geometry falls back to a fresh attempt while
preserving the saved profile. Legacy raw/enveloped saves retain their balances,
unlocks and ratings; old `stars` migrate to `bestStars`. Unknown legacy bestMoves
remain null until a successful result supplies a real move count.

## Coin transaction API

All functions in `src/domain/economy.ts` are pure:

```ts
canAfford(coins, amount): boolean
spendCoins(progress, amount, reason, transactionId, at?): TransactionResult
addCoins(progress, amount, reason, transactionId, at?): TransactionResult
commitReward(progress, pendingLevelReward, at?): TransactionResult
```

Amounts must be nonnegative safe integers. Spending cannot make coins negative;
addition cannot overflow. Transaction IDs reject duplicate application. Reasons
are `level_reward`, `hint`, `undo`, `shuffle`, `revive`, and development-only `debug`.
The store applies a utility's authorized runtime change and coin transaction in one
state update. A shared 400 ms guard and pending save state reject rapid repeat taps.

In an Expo development build, the main-menu coin panel includes **DEV: Add 500
coins**. `useGameStore.getState().debugAddCoins(amount)` uses the same ledger and
accepts only 1–10,000 coins. Both the action and UI are gated by `__DEV__`; the
production store does not expose the method.

## Reward and result flow

1. Perfect Fits and combo milestones accumulate only in `coinsEarned` and reward
   events. A failed/restarted attempt never credits them to the wallet.
2. Winning computes `{ baseCoins, perfectFitCoins, comboBonus, threeStarBonus, total }`
   and saves `pendingLevelReward` against the unique attempt ID.
3. Opening Level Complete calls `commitLevelReward(attemptId)`. One atomic profile
   update stores the wallet, `reward:<attemptId>` transaction receipt, best result
   and unlock. Repeating the call cannot apply it again.
4. The result reveals title → stars → reward rows → total → balance counter. It
   shows the receipt's actual before/after balance. Continue becomes available
   after the short 1.5-second sequence and successful storage flush.
5. Continue/Replay consume the current attempt ID once. A stale second tap cannot
   load another level or credit coins. On the last of the three levels, Continue
   returns to level selection.

Pending wins survive a restart before commit. Committed wins restore their receipt
without crediting it again. Save failure blocks Continue and offers Retry Save;
retry writes the existing receipt rather than adding the reward a second time.

Perfect Fit defaults to +10 per bottle. Default combo milestones are x2 +2, x3 +4,
x4 +6 and x5 +10; **each milestone pays once per attempt**, including across combo
resets. Staying at x5+ cannot keep paying. Default milestone rewards total at most
22 coins. Three stars add 25. The three existing levels keep base rewards 40/40/60;
normal difficulty defaults are 40/60/80/100/150, with config overrides supported.

**Replay policy:** baseCoins = 0 after a prior completion. Perfect Fits, bounded
combo milestones and three-star bonuses remain available. A replay never reduces
bestStars or bestPerfectFits. bestMoves is the minimum successful count. First
completion increments the completion count and sets highestUnlockedLevel to at
least completedLevel + 1. Opening a level never unlocks it. Only the three existing
levels appear even if the stored highest unlock is 4 or a larger legacy value.

## Revive and restart

Game Over shows Bottle Broken, coin Continue and Restart. Coin Continue defaults
to 150, is disabled below that balance and displays Need 150 coins. After one
revive, the offer disappears for that attempt. On Android development/release
builds a "Watch Ad — Continue" button grants the same revive for free once the
SDK reports the reward as earned (`src/services/ads`); closing early grants
nothing. The button is hidden on iOS, web and Expo Go. Debug builds always use
Google's test ad unit; UMP consent runs before ads initialize and Settings shows
"Ad privacy options" when Google requires it.

## Interstitial ads

Android development/release builds only (hidden and inert on iOS, web and Expo Go).
Debug builds use Google's test unit `ca-app-pub-3940256099942544/1033173712`; release
builds use the production unit. Both IDs live in `src/services/ads/config.ts`.

- One opportunity per 5 NEW level completions. Level Complete records a completion once
  its reward is saved and only when the attempt is not a replay (`isReplay`). Failed
  attempts, restarts and replays never count. The counter is persisted under
  `balance-keeper-interstitial` (separately from game progress), so restarting the app
  does not reset it, and a restored Level Complete screen is not counted twice.
- The ad only ever runs when the player presses **Continue** on Level Complete, after
  they have seen stars and coins. Replay and Back to levels never show one.
- The ad is preloaded at launch, on foreground, on each recorded completion, and again
  after every close. If it is not loaded when due, it is skipped: the player never
  waits on a load, and the spent opportunity is not carried over.
- Show failures, an ad that never opens within 5s, and unsupported platforms all fall
  through to normal navigation. Repeated Continue taps run the ad step once.
- Guards: none within 2 minutes of a rewarded ad (or while one is on screen) and none
  within 60 seconds of the previous interstitial.

Revive restores the snapshot immediately before the breaking attempt: bottle
contents/currentWeight, tray position and damage (normally 2), pending skill
rewards, moves and previous progress. It spends persistent coins, increments
revivesUsed, resets combo, clears failure feedback and resumes playing. The failed
overload remains a mistake; assistance counters are not refunded. The revived
snapshot/usage and wallet spend persist together, so relaunching cannot buy an
extra revive or restore an undamaged bottle.

Restart creates a new attempt ID from the original config and clears all runtime
state, reward events, history and assistance/revive usage. Free allowances reset.
The persistent wallet, best results and highest unlocked level remain intact.

## Hint, Undo and Shuffle

| Action | Default allowance | Paid price | Behavior |
| --- | --- | --- | --- |
| Hint | 1 per attempt | 50 | Finds a safe solution move before consuming allowance/payment; highlights only, resets combo, increments hintUsed |
| Undo | 3 per attempt | 30 | Requires history; restores the previous snapshot including fit/combo rewards, resets combo, increments undoUsed |
| Shuffle | None | 25 | Fisher–Yates tray permutation with a different-order fallback; preserves values/IDs, bottles, moves and combo |

Defaults live in GAME_ECONOMY and can be overridden with level.rules. Allow flags,
free counts and affordability determine button states. Hints use the existing
bounded deterministic solution search; no valid solution means no charge and a
disabled hint action. A placement/new hint clears the previous hint. Undo never
restores spent profile coins or free-use allowances. Empty history, inadequate
funds, disallowed utilities or an unshufflable tray do not charge.

## Verification

- `npm test`: **46 passing tests**, covering Phase 1 invariants plus exactly-once
  reward commit, duplicate Continue, save/relaunch before and after commit,
  migration, revive eligibility/cost/recovery/limit, runtime-only restart,
  free/paid/safe hints, free/paid Undo and reward reversal, shuffle identity/order,
  bounded milestones, nonnegative/idempotent transactions, unlocks/best records,
  replay rewards, rapid taps, serialized writes, save failure/retry and dev gating.
- `npx tsc --noEmit`: passes.
- `git diff --check`: passes.
- `scripts/check-gameplay.cjs`: passes fresh-install/unlock/reward-remount/replay
  checks and 320×568, 390×844, 430×932 utility/revive/relaunch checks. Background,
  bottles and tray stay fixed through drops, cracks, rejection and Undo. It also
  verifies insufficient revive funds and no visible ad offer.
- Result and revive screenshots: `artifacts/gameplay/phase2-*.png`.

## Architecture concerns

- Persistence is local to one app installation; it does not provide cloud or
  simultaneous multi-tab/device transaction coordination. Cross-device wallet
  authority would require a backend before purchases are added.
- The transaction journal intentionally retains IDs for idempotency and future
  analytics. A future archival/compaction policy should preserve deduplication.
- Historical production puzzles and the three fixtures share numeric IDs. Existing
  ratings are preserved as requested; those completed IDs therefore count as
  replays. A separate campaign namespace/version is advisable before replacing
  the fixtures with production progression.
- Native iOS/Android touch, haptics and device rendering still need device testing.
