> Current scope: [Gameplay Phase 5](gameplay-phase5.md). Earlier phase descriptions below remain historical references.

# Balance Keeper Gameplay Phase 1

This document describes the implemented Phase 1 scope. The broader original
[gameplay rules](gameplay-rules.md) remain the future contract; Phase 1 defers their
paid utilities, revive UI/actions, profile settlement and advanced mechanics.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `src/types/game.ts` | Canonical LevelConfig, runtime bottles, snapshots, events and reward types |
| `src/domain/levelConfig.ts` | Config validation, defaults and adapter for the existing tube/tray renderer |
| `src/data/levels/phase1.ts` | Exactly three hand-authored basic test configs |
| `src/data/levels/index.ts` | Makes only those three fixtures available |
| `src/domain/gameplay.ts` | Pure drop, fail, win, combo, history, Undo and hint transitions |
| `src/domain/hints.ts` | One useful move from a witnessed solution |
| `src/utils/physics.ts` | evaluateDrop, calculateBottleWeight, isBottleSolved, isLevelComplete |
| `src/utils/scoring.ts` | Pure calculateStars and calculateRewards |
| `src/utils/durability.ts` | Existing pure visual mapping; reused unchanged |
| `src/store/gameStore.ts` | Commits attempt transitions without changing profile rewards or progress |
| `src/screens/Gameplay.tsx` | Connects existing controls to attempt state; removes revive UI |
| `src/screens/LevelComplete.tsx` | Displays attempt reward breakdown |
| `src/screens/MainMenu.tsx` | Corrects coin information copy for attempt-local rewards |
| `src/screens/LevelSelect.tsx` | Shows three fixtures without applying old production ratings |
| `src/components/gameplay/GameplayActions.tsx` | Free Undo/Hint labels; existing Shuffle stays disabled |
| `tests/gameplay.test.cjs` | Domain and store regression coverage |
| `scripts/check-gameplay.cjs` | Browser gameplay and background stability checks |
| `docs/gameplay-contract.md`, `docs/gameplay-rules.md`, `docs/gameplay-visual.md` | Current scope, migration notes and validation documentation |

## LevelConfig

```ts
{
  id, name?, difficulty,
  bottles: [{ id, target, capacity, durability, type }],
  weights: [{ id, value, color, type }],
  rules: { allowUndo, allowHint },
  rewards: {
    baseCoins, perfectFitCoins, comboCoinsPerStep,
    maxComboMultiplier, threeStarBonus
  },
  stars: { twoStarMaxMoves, threeStarMaxMoves }
}
```

The seven core config fields and all listed bottle/weight fields are required in
the authoring type. Runtime validation supplies normal durability 3 when omitted
by legacy input. Only `normal` bottle and weight types are accepted in Phase 1;
the type names for future mechanics are reserved. Legacy JSON files remain on disk
but are not imported into playable levels. No new production progression exists.

The three fixtures are:

1. Target/capacity 5/5; one 5 ball.
2. Target/capacity 5/7; balls 2 and 3.
3. Targets/capacities 5/7 and 8/10; balls 2, 3, 3 and 5.

## Gameplay state

```ts
{
  level, status: 'playing' | 'won' | 'lost', lossReason: null | 'broken',
  tubes: [{
    id, index, type, target, capacity, durability,
    balls, containedWeightIds, currentWeight, damage, isSolved, isBroken
  }],
  tray, selectedBall, moves, mistakes, combo, maxCombo,
  perfectFits, coinsEarned, undoUsed, hintUsed,
  history: [{ ball, tubeIndex, before: MoveSnapshot }],
  currentEvent: null | { ballId, tubeIndex, at, nextWeight, outcome },
  earnedStars, rewards,
  revivesUsed, reviveSnapshot,
  hintMove, invalidPlacement, floatingPoints, lastImpact, lastBreak
}
```

The existing renderer retains `tubes`, `balls` and tray `weight` naming. The domain
rebuilds cached `currentWeight`, contained IDs and solved/broken flags together
whenever bottle contents or damage change. React does not decide outcomes.

`currentEvent.outcome` is `placed`, `perfectFit`, `overload` or `invalid`. Its timestamp
is for feedback identity only; time never affects moves, combo, damage or stars.

## Drops and damage

`evaluateDrop` uses the sum of bottle contents plus the dropped value. A value at
or below capacity is accepted, including values above target. Exact target causes
a Perfect Fit and solved state. Above target is unsolved and causes no damage.

An accepted placement consumes its ball, adds one move and one combo, updates
maxCombo, and saves the complete previous move snapshot. Perfect Fit increments
perfectFits and awards the configured 10 attempt coins. After each placement,
all bottles must equal their targets to win. Won/lost states reject further input.

Overload rejects the ball, retains tray inventory, adds one mistake and one damage
to that bottle, and resets combo. It changes neither moves nor history. Invalid
or outside drops reset combo without damage or mistakes.

| Damage | Existing asset |
| --- | --- |
| 0 | `bottle-normal` (`pristine`) |
| 1 | `bottle-crack-1` (`hairline`) |
| 2 | `bottle-crack-2` (`cracked`) |
| reaches durability, normally 3 | `bottle-broken` (`broken`) |

Breaking any bottle sets status lost, lossReason broken and blocks all gameplay
input. A pre-break snapshot and revivesUsed=0 are retained as a foundation; there
is no executable revive action or revive UI.

## Undo, stars and rewards

A snapshot contains all bottle contents/weights/damage, tray order, moves,
mistakes, combo/maxCombo, coinsEarned, perfectFits and the existing presentation
score. Undo restores it, then resets combo and increments undoUsed. Assistance
usage is never rewound. Undo after win/loss is blocked. Hint also resets combo;
a successful hint increments hintUsed. Undo and Hint are free in Phase 1.

Unfinished attempts receive zero stars. Completion earns one; completion within
twoStarMaxMoves earns two. Three require threeStarMaxMoves and zero mistakes,
zero Undo and zero hints, regardless of legacy optional clean-play flags.

`calculateRewards` returns exactly:
`{ baseCoins, perfectFitCoins, comboBonus, threeStarBonus, total }`.
Perfect Fit coins are count × 10. The completion combo bonus is based on maxCombo:
5 coins per step above one, capped at x5 (20 coins), using config values. Three
stars add the configured 25 coins. Base, combo and star bonuses are added on win.
coinsEarned contains Perfect Fit earnings during play and the full total on win.
Undo restores the earlier value, so replaying a fit cannot duplicate earnings.

All rewards remain in the attempt. No coins, ratings, score records, completion
counts or unlocks are awarded to the saved profile. Restart/load clears attempt
rewards. Existing profile data is preserved for future progression work.

## Conflicts resolved and remaining compatibility

- The earlier 57-level active registry is replaced by the three fixtures; its JSON
  files remain inactive and unchanged.
- Earlier profile settlement, paid utilities, revive action/UI, and move-limit
  failure were removed from Phase 1.
- Earlier snapshots kept mistakes outside Undo; Phase 1 explicitly restores them.
- Earlier `bestCombo` and fit-bottle arrays became `maxCombo` and `perfectFits`.
- Existing UI adapters and legacy profile migration remain. Main-menu lifetime
  statistics still describe the saved profile, not these temporary attempts.
- Correcting an above-target placement uses Undo; direct removal is not added.
- Existing background and tray sizing, assets, and drag/drop interaction are retained.

## Verification

Verified: all 22 tests pass, TypeScript and whitespace checks pass, and browser
checks pass at all three sizes below. All 57 legacy JSON file checksums are unchanged.

`npm test` covers config, valid/exact/above-target/overload drops, all crack stages,
break/input blocking, moves/combo, elapsed-time independence, three wins, complete
Undo restoration, hint/reset behavior, 0/1/2/3 stars, reward breakdown/caps,
immutability and unchanged saved profile integration.

`npx tsc --noEmit` checks application types. Run `scripts/check-gameplay.cjs` against
the local Expo web server with Playwright supplied through `PLAYWRIGHT_MODULE`.
It checks 320×568, 390×844 and 430×932 viewports, drag/tap placement, outside drops,
above-target acceptance, all damage assets, background/tray stability, restart,
Undo/Hint, all three completions, stars and unchanged persisted profile data.
Screenshots are written to `artifacts/gameplay/phase1-*.png`.

Native iOS/Android touch, haptics and rendering have not been device-tested.
