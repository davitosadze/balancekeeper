> [Phase 5](gameplay-phase5.md) adds the cosmetic shop and equipment; the mechanics and feedback described here remain active.

# Balance Keeper Gameplay Phase 4

Phase 4 adds optional exact/one-way bottle support and semantic feedback to the
existing engine. It improves fragile/locked presentation, combo/Perfect Fit,
stress, break and completion feedback using existing assets and animation tools.
The fifty shipped levels, generation algorithm, economy values and persistent
reward transaction rules remain unchanged.

## Files changed

| Files | Changes |
|---|---|
| `src/types/game.ts` | Exact damage override, canonical `oneWay` with legacy alias, optional fragile durability, mechanic metadata, transient effect types/journal |
| `src/utils/physics.ts` | Exact rejection/effective capacity, unsupported-type rejection, fragile fallback and manual-removal guard |
| `src/domain/levelConfig.ts`, `src/domain/levels/validation.ts` | New bottle types and metadata, exact override validation, fragile defaults |
| `src/domain/gameplay.ts`, `src/domain/persistence.ts` | Emit feedback after pure transitions; exclude feedback from persisted attempts; retain snapshot/economy behavior |
| `src/domain/effects.ts` (new) | Pure semantic event emission with unique sequence IDs |
| `src/domain/bottleFeedback.ts` (new) | Stress thresholds, combo labels/cap and feedback timing constants |
| `src/domain/feedback.ts` (new) | Sound catalog, audio/haptic priorities and semantic event mapping |
| `src/hooks/useGameplayFeedback.ts` (new) | Once-per-event sound/haptic consumption with delayed unlock and completion cues |
| `src/hooks/useReducedMotionPreference.ts` (new) | OS reduced-motion preference and change subscription |
| `src/hooks/useAudio.ts`, `src/hooks/useHaptics.ts`, `src/utils/eventMap.ts` | Saved settings, safe hardware fallbacks, playback priority and focus cleanup; old UI event aliases retained |
| `src/components/gameplay/GameplayBanner.tsx` (new) | Compact combo, rejection and milestone feedback in the existing HUD row |
| `src/components/Tube.tsx`, `GameBoard.tsx` | Type badges, dimmed lock, unlock/fit glow, stress, sequential win pulse, count animation and stable break timer |
| `src/components/gameplay/GameplayScene.tsx`, `GameplayHud.tsx`, `ReturningWeight.tsx` | Feedback slot, progress animation and cleanup |
| `src/components/ParticleBurst.tsx`, `FloatingPoints.tsx`, `Confetti.tsx` | Smaller bursts/labels, reduced motion and animation cleanup |
| `src/components/CountUpText.tsx`, `FadeSlideIn.tsx`, `PopIn.tsx` | Reduced motion, cleanup and throttled number updates |
| `src/screens/Gameplay.tsx`, `LevelComplete.tsx` | Semantic subscriptions, break dimming, faster completion/reward presentation and result star/coin cues |
| `tests/phase4.test.cjs` (new), `tests/gameplay.test.cjs` | New mechanics/events tests; unsupported-type fixture updated now that one-way is supported |
| `scripts/check-phase4.cjs` (new), `scripts/check-gameplay.cjs` | Focused feedback/timing checks; reliable scrolling of existing animated level cards |
| `docs/gameplay-phase4.md` and scope pointers in earlier gameplay documents | Current implementation report |

Other existing workspace changes predate this phase. No bottle, weight or sound
assets were created or replaced. No dependencies were added.

## Bottle mechanics

- **Fragile:** target/capacity semantics stay unchanged. Omitted durability becomes
  1; explicitly configured positive durability is honored. A small warning label
  and slightly lighter bottle rendering identify it. Risky hover uses a subtle
  warm outline with no repeated warning sound or popup.
- **Locked:** `unlockAfter` names the required bottle. Drops remain invalid until
  that bottle is solved and unbroken. Rejection returns the ball, resets combo,
  and causes no damage or mistake. The lock disappears immediately, followed by
  a brief glow/bounce, quiet cue and light haptic. Undo can re-lock it.
- **Exact:** target is the effective hard capacity even if configured physical
  capacity is larger. Excess is rejected without damage or mistakes by default;
  it still resets combo and does not count a move. An explicit
  `damageOnOverload: true` opts into the normal overload damage/mistake/break path.
  The precision badge, target-based capacity display and rejection copy identify
  this rule. The override is only valid on exact bottles.
- **One-way:** canonical config name is `oneWay`; legacy `one-way` is normalized
  to it. `canManuallyRemoveBall()` rejects manual extraction from this type.
  Snapshot Undo still works. There was no manual-removal UI in the existing game,
  so this is a tested guard for a future removal interface, not a new tray/bottle
  interaction. A small downward-arrow badge identifies the type.

Example optional bottle configs:

```ts
{ id: 'b1', type: 'fragile', target: 8, capacity: 10 } // durability defaults to 1
{ id: 'b2', type: 'locked', target: 12, capacity: 14, durability: 3, unlockAfter: 'b1' }
{ id: 'b3', type: 'exact', target: 10, capacity: 15, durability: 3, damageOnOverload: false }
{ id: 'b4', type: 'oneWay', target: 9, capacity: 12, durability: 3 }
```

Exact and one-way are optional config capabilities. They were not inserted into
Levels 1–50. Unsupported types reject safely at the drop boundary.

## Semantic events

`transition()` first calculates the authoritative game/economy result, then calls
`emitGameplayEffects()` to describe that result. The emitter does not award coins,
change moves, mutate damage or authorize assistance. It emits:

- `BALL_PICKUP`, `DROP_SUCCESS`, `DROP_INVALID`
- `PERFECT_FIT`, `COMBO_CHANGED`
- `BOTTLE_CRACKED`, `BOTTLE_BROKEN`, `BOTTLE_UNLOCKED`, `BOTTLE_STRESS_CHANGED`
- `LEVEL_COMPLETED`, `UNDO`, `HINT`, `SHUFFLE`, `REVIVE`

Game state adds `effects` and `effectSequence`. The journal holds at most 64 recent
entries. Each entry has an attempt-scoped unique ID, sequence, timestamp and
relevant bottle/weight/combo/rejection/stress fields. It is separate from Undo
snapshots and is cleared for storage/restoration. Undo does not rewind event IDs.
Blocked input after win or break emits nothing. A successful re-fill after Undo
is a new move and may produce a new Perfect Fit event.

The feedback hook consumes each sequence once, skips historical feedback on focus,
and cleans scheduled cues on blur/unmount or attempt change. The existing damage,
impact and floating-point presentation adapters remain available to avoid breaking
visual fixtures; they no longer independently trigger duplicate gameplay audio.

## Visual behavior and timing

| Feedback | Behavior |
|---|---|
| Combo | No x1 popup; NICE! x2, GREAT! x3, AMAZING! x4, BALANCE MASTER! x5. Actual combo and rewards remain uncapped by presentation. Above 5, presentation stays x5. |
| Combo/rejection popup | Small scale/fade in the existing 22px HUD feedback row, about 850ms. It never moves the board or covers bottles. |
| Perfect Fit | Gold bottle glow, small bounce, one ring plus six dots, small +10 coin/Perfect Fit label, emphasized target/count panel and animated capacity bar |
| Regular placement | Existing ball settling plus micro bounce, soft tap cue, short count and progress animation; no routine particle burst |
| Stress | Shared thresholds: safe below 75%, warning from 75% to below 90%, danger from 90% through 100%; attempted excess is overload. Exact bottles use target as denominator. |
| Danger entry | Short warm pulse on crossing the threshold; static subtle stress tint afterward. No constant shaking or pulsing. |
| Overload/crack | Returned weight, brief shake/flash, current crack asset, TOO HEAVY message and prioritized crack cue; no modal for recoverable damage |
| Break | Input stops immediately, stronger short shake, broken asset, error haptic, slight scene dimming. Game Over is revealed after 550ms. |
| Unlock | Lock dimming/icon disappear immediately; short glow/bounce and delayed quiet unlock cue, with no modal |
| Milestone entry | MILESTONE banner for roughly 1 second, driven by level metadata. Recovery levels receive no new difficulty announcement. |
| Win | Final fit/combo first; solved bottles pulse sequentially starting at 360ms with 75ms spacing; result navigation at 900ms |
| Result | Stars, reward and coin animation fit into 850ms. Continue still waits for the existing successful reward save. Normal target is about 1.75 seconds from final drop, plus navigation/storage time. |

The break timer now depends on the break event rather than changing callback
identities, so unrelated impact cleanup cannot postpone Game Over. Reward-save
failure still exposes the existing retry behavior; animation completion never
bypasses persistence authorization.

Reduced motion removes strong shake/scale and particles, keeps textual feedback,
shortens number/reveal effects, and permits the result after a 150ms transition
plus 120ms result gate. The break's brief explanatory pause remains. Reanimated
shared values handle transform/opacity/progress work; count updates are throttled
to approximately 30fps for short number transitions. New animation/timer work is
cancelled on unmount and audio/haptic work on focus loss.

## Sound integration and missing assets

The centralized sound catalog supports all requested names:
`ball_pickup`, `ball_drop`, `invalid_drop`, `glass_tap`, `glass_crack`,
`glass_break`, `perfect_fit`, `combo`, `unlock`, `undo`, `hint`, `shuffle`,
`coin`, `star`, `level_complete`, `button_tap`.

Five existing effect files are preloaded into reusable players per focused audio
hook. Old names remain aliases for existing screens. No player is constructed on
every render. A short arbitration window chooses the highest-priority simultaneous
cue; a short holdoff limits stacking and active effects are paused when replaced.
Break outranks tap/combo; completion follows the final fit rather than competing
in the same frame. Unlock is delayed 230ms and completion 500ms after its event.
Missing/unloaded players safely do nothing; rejected playback promises are caught.
Mute/volume settings are read on focus and playback stops on blur or mute.

| Available asset | Events currently using it |
|---|---|
| `pour.wav` | Pickup, drop, glass tap, button tap at different quiet gains |
| `complete.wav` | Perfect Fit, combo, unlock, hint, coin and star |
| `error.wav` | Soft invalid drop, crack and break with increasing gain/priority |
| `undo.wav` | Undo/revive and shuffle |
| `levelup.wav` | Level completion |

**Missing dedicated recordings:** glass crack, glass break, unlock, pickup/drop
Foley, coin, star and individual combo/hint/shuffle/button cues. Current aliases
provide integration, but do not claim to be distinct glass-break recordings.
Replacing these aliases later requires no gameplay/reward changes. Existing music
behavior was not enabled or expanded by this phase.

## Haptics

Haptics now read the saved `hapticsEnabled` setting on focus and remain disabled
until settings load. Only iOS/Android are eligible; web is a no-op and hardware
errors are caught. Calls are centralized and competing cues are coalesced:

| Event | Device feedback |
|---|---|
| Pickup/button/assistance | Selection feedback |
| Successful drop/unlock | Light impact |
| Perfect Fit | Success notification |
| Crack | Warning notification |
| Break | Error notification |
| Level complete | Success notification pattern |

Native-device strength and the quality of reused audio cues still need device
playtesting. Browser tests establish gating and lifecycle behavior, not the
physical feel of a phone's vibration motor.

## Solver and campaign validation

No solver algorithm change was required. Its existing forward search uses positive
weights, prunes above-target paths and never removes balls, so valid exact and
one-way solution paths already satisfy these rules. New tests validate those types
and partial states through the solver and centralized drop evaluator.

All **50/50** shipped levels validate. **No level became unsolvable, no minimum
move count changed, and no new bottle-rule conflict was found.** The largest search
remains 1,413 nodes. The generator, concrete bundle, IDs, thresholds and rewards
were not regenerated or altered. Exact seeded reproduction passes.

The full unchanged table is [level-validation.md](level-validation.md).

## Tests and verification

`npm run check` passes **100 tests**, campaign validation and TypeScript checking.
The twelve new Phase 4 tests cover configured/default fragile durability, lock
rejection/unlock/Undo, safe and damaging exact rejection, one-way removal guard
and Undo restoration, unsupported types, combo tiers/reset/cap, unique Perfect
Fit/break/completion events, persistence clearing, stress boundaries, solver
compatibility, sound priorities and bounded event identity.

`npm run levels:check` verifies that all fifty concrete configs reproduce exactly.
`git diff --check` checks patch whitespace.

Focused browser checks (`scripts/check-phase4.cjs`) pass with normal and reduced
motion: milestone banner, all combo tiers, popup position, Perfect Fit, lock
feedback, muted playback, delayed break and actionable win. Measured break reveal
was about 590ms in both modes. Result readiness measured about 1.9 seconds normally
and 0.4 seconds with reduced motion. Screenshots are in
`artifacts/gameplay/phase4-*.png`.

The existing campaign browser suite checks real drag/drop, cracks/revive,
capacity/Undo, fragile bottles, locks, move goals, reward persistence, fifty-level
navigation and background stability. It passed at 320×568, 390×844 and 430×932.
