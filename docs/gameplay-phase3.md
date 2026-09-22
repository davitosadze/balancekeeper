> Current scope: [Phase 5](gameplay-phase5.md). This campaign and its generation rules remain active.

# Balance Keeper Gameplay Phase 3

The active campaign contains 50 concrete, validated levels: ten handcrafted lessons
and forty deterministically generated puzzles. Phase 2 economy, assistance, revive,
and reward persistence remain active. Move goals affect stars only. Fragile bottles
start at Level 31; referenced-bottle locks start at Level 41.

## Files created or changed

| Files | Responsibility |
|---|---|
| `src/domain/levels/profiles.ts`, `plan.ts` | Difficulty ranges, mechanic gates, waves, recovery and milestone metadata |
| `src/domain/levels/random.ts`, `authoring.ts`, `generator.ts` | Seeded generation and solution-first authoring |
| `src/domain/levels/solver.ts`, `validation.ts` | Minimum-move search, witness checks and strict campaign validation |
| `src/domain/levels/tutorials.ts` | Central tutorial messages and move-goal text |
| `src/data/levels/campaign/handcrafted.ts`, `campaign-v1.json` | Ten authored levels and the final fifty-level runtime bundle |
| `src/data/levels/index.ts`, `README.md` | Active registry and generation/version instructions |
| `src/types/game.ts`, `src/domain/levelConfig.ts` | Campaign metadata, new bottle types, reference validation and config signatures |
| `src/utils/physics.ts`, `src/domain/gameplay.ts` | Referenced lock checks and signed attempt initialization |
| `src/domain/hints.ts` | Cached solver-based hints using the existing assistance transaction flow |
| `src/domain/persistence.ts`, `src/store/gameStore.ts` | Config-compatible attempt restoration and preserved completed reward receipts |
| `src/components/Tube.tsx`, `src/components/gameplay/TutorialCoach.tsx` | Fragile/lock labels and dismissible tutorial overlay |
| `src/screens/Gameplay.tsx`, `LevelComplete.tsx`, `LevelSelect.tsx` | Metadata-driven coaching, move goals, level names and milestone feedback |
| `scripts/register-typescript.cjs`, `build-levels.cjs`, `validate-levels.cjs` | Shared TS loader, reproducible build and validation commands |
| `scripts/check-gameplay.cjs`, `tests/levels.test.cjs` | Campaign browser checks and domain regression tests |
| `tests/register.cjs`, `tests/gameplay.test.cjs`, `tests/economy.test.cjs`, `package.json` | Existing test adaptation and development commands |
| `docs/gameplay-phase3.md`, `level-validation.md`, `level-validation.json` | Implementation report and full fifty-level validation results |
| `docs/gameplay-contract.md`, `gameplay-phase2.md`, `gameplay-rules.md`, `gameplay-visual.md` | Historical/current scope pointers |

Other dirty files in the workspace predate this phase. Existing graphical assets,
screen structure and drag/drop interaction are retained. Original numbered JSON
files and the three Phase 1 test fixtures remain available but are not the active
runtime campaign.

## Level schema and runtime state

`LevelConfig` retains `id`, `difficulty`, `bottles`, `weights`, `rules`, `rewards`
and `stars`. The campaign uses named difficulties: tutorial, easy, medium, hard,
challenge. Optional metadata now includes:

```ts
{
  name, generationVersion: 1,
  source: 'handcrafted' | 'generated',
  kind: 'tutorial' | 'standard' | 'recovery' | 'milestone',
  mechanics: ['basic', /* capacity, overload, durability, combo,
                         move-goal, fragile, locked */],
  tutorial: { type, step, message? },
  milestone: { title, completionMessage },
  generation: { seed, attempt },
  intendedSolution: [{ weightId, bottleId }],
  minimumMoves, recommendedMoves, difficultyScore
}
```

A bottle remains `{ id, target, capacity, durability, type }`, with optional
`unlockAfter: 'b1'` for `type: 'locked'`. Fragile bottles use the same placement
and overload rules; campaign fragile bottles have durability 1. Normal defaults
remain 3. A lock opens only while its referenced bottle is solved and unbroken.
Solving an unrelated bottle does not open it. Undo can re-lock it.

Rules add `moveLimit: number | null` and `moveLimitMode: 'stars'`. The displayed
goal equals the three-star move threshold; exceeding it never causes failure.
Three stars still require no mistakes, Undo or Hint. Weight types remain normal.

Normalized levels expose `category` plus the numeric difficulty adapter needed by
existing presentation. `signature` hashes the generation version and concrete
bottles, tray, rules, rewards and stars. Game state adds `levelSignature`; existing
contents, weights, damage, history, combo, assistance, pending rewards and profile
structures remain in use. Lock state is derived, avoiding stale stored flags.

## Difficulty profiles

These are generated-level ranges; handcrafted lessons and explicit campaign
constraints can override them. Total tray size is solution balls plus distractors.
Generated levels reserve at least two solution balls per bottle.

| Profile | Bottles | Solution balls | Targets | Capacity margin | Distractors | Normal durability | Base coins | 3-star / 2-star / recommended slack |
|---|---|---|---|---|---|---|---|---|
| tutorial | 2 | 4 | 6–14 | 4–6 | 0 | 3 | 25–30 | +1 / +2 / +2 |
| easy | 2–3 | 4–6 | 6–16 | 4–7 | 0–1 | 3 | 40–60 | +1 / +2 / +2 |
| medium | 3–4 | 6–8 | 10–22 | 2–4 | 0–2 | 3 | 60–90 | +0 / +3 / +3 |
| hard | 4–5 | 8–11 | 13–26 | 1–2 | 1–3 | 2–3 | 90–130 | +0 / +3 / +3 |
| challenge | 4–5 | 8–11 | 14–28 | 0–2 | 1–2 | 2–3 | 150–250 | +0 / +3 / +3 |

Slack is measured from the solver's minimum. Each profile owns allowed mechanics;
the campaign plan further gates their introduction. Fragile overrides durability
to 1. Hard normal bottles keep 2–3 overload tolerance so tighter capacities and
larger combinations do not also force every bottle to fail on its first mistake.
Recovery levels remove distractors and advanced bottle types. Levels 17–18 use
margin 1; later demanding levels cap margins at 2.

## Generation and random implementation

`LEVEL_GENERATION_VERSION = 1`. FNV-1a hashes the string
`balance-keeper-v1:<levelId>:<candidateAttempt>` to a 32-bit seed; Mulberry32
produces repeatable draws. The first attempt is 0. Generation never uses
`Math.random`, time, or player state.

1. Read the fixed wave plan and difficulty profile; choose bottle/solution counts.
2. Construct positive weight groups first, each with a distinct target in range.
3. Set each target to its group's sum; choose capacity at or above that target.
4. Combine groups, retain their concrete intended solution, and add bounded
   distractors. Some optimization levels include a target-sized shortcut ball.
5. Apply fragile/lock metadata, including acyclic prerequisite chains, and shuffle
   the tray with the same seeded generator.
6. Solve the candidate with a 12,000-node budget, establish minimum-based stars,
   and compute a score from bottle count, minimum moves, distractors, capacity
   tightness and advanced bottles.
7. Reject candidates below the profile score, below the challenge placement floor,
   or failing strict validation. Try at most 64 deterministic candidates.

The win condition requires every bottle to equal its target; it does not require
an empty tray. Unused distractors and shorter alternative solutions are legal.
Challenge candidates require at least `2 × bottleCount − 1` minimum placements.

Runtime imports only `campaign-v1.json`. It never generates a puzzle on entry.
Published version changes require a new version and deliberate registry selection;
retain old bundles. A generator edit alone cannot silently reroll runtime levels.

## Solver and hints

`solveLevel()` uses bounded DFS with memoization. Its state contains bottle
deficits, remaining positive ball values/IDs, damage and reference dependencies.
It skips solved bottles, duplicate-value branches and placements above target,
checks remaining total weight, and selects an eligible bottle deterministically.
Completing one eligible bottle at a time is sound here: positive placements cannot
make a bottle need more weight, and solving prerequisites is the only unlocking
action. Equivalent remaining values share memoized results; cached paths are
remapped to the branch's concrete ball IDs.

It searches all non-equivalent branches to find the minimum number of remaining
successful placements, returning `{ solvable, minimumMoves, solution, status,
nodes }`. Node exhaustion returns `status: 'limit'` and no claimed minimum;
`solvable` is null unless a valid witness was already found. A limit is never
reported as proven unsolvability.

`getSolutionFromState()` accepts a partial gameplay state. Hint uses the first move
of a valid solution, retaining the existing free allowance, coin costs and combo
reset. A cache keyed by config and puzzle state prevents repeated searches on
animation or wallet renders. Runtime hints and generation use 12,000 nodes;
standalone solver default is 100,000. The tray guard is 18 balls.

## Validation

The validator checks required config structure, supported categories/types/colors,
positive safe integer values, nonempty bottles, counts, unique bottle/weight IDs,
capacity at least target, positive durability, valid lock references and no cycles.
It also checks rules/rewards, ordered and achievable star thresholds, recommended
moves, intended solution, minimum metadata, mechanic gates and milestone metadata.
The complete bundle must contain exactly contiguous IDs 1–50.

Both intended and solver paths are checked using actual centralized drop rules.
An unsolvable puzzle, invalid witness, or exhausted validation budget fails the
development command with a nonzero exit status. `npm run check` runs tests,
campaign validation and TypeScript checking.

## Handcrafted levels 1–10

| Level | Lesson | Intended groups | Capacities | Base coins |
|---|---|---|---|---|
| 1 | Drag/drop | 5 | 15 | 25 |
| 2 | Combination | 3+5 | 16 | 25 |
| 3 | Two bottles | 2+3; 4+5 | 14, 14 | 30 |
| 4 | Choice, one exact partition | 2+5; 3+8 | 18, 18 | 40 |
| 5 | Three bottles | 2+4; 3+5; 4+6 | 24, 24, 24 | 50 |
| 6 | Target versus capacity | 4+6; 3+8 | 15, 18 | 30 |
| 7 | Tighter safe margins | 2+6; 4+7 | 11, 13 | 55 |
| 8 | First crack, extra 9 ball | 2+3; 4+6 | 7, 12 | 30 |
| 9 | Durability, extra 12 ball | 3+5; 2+7 | 10, 11 | 60 |
| 10 | First challenge, extra 5 ball | 2+7; 4+8; 6+10 | 11, 14, 18 | 150 |

Levels 1–5 cannot overload even if all tray balls are put in one bottle. Level 6
can safely reach 14 against target 10/capacity 15 and explains Undo. Level 8's
obvious 9-ball overload causes one recoverable crack; Level 9 also permits recovery
after one mistake. Tutorial behavior is centralized metadata, with no numbered
level conditions scattered through Gameplay.

## Generated levels 11–50

| Range | Wave and introduction |
|---|---|
| 11–20 | easy, medium, medium (combo lesson), medium, hard, recovery, medium, hard, hard, challenge |
| 21–30 | move-goal tutorial, easy, medium, medium, hard, recovery, medium, hard, hard, challenge |
| 31–40 | fragile tutorial, easy, medium, medium, hard, recovery, medium, hard, hard, challenge |
| 41–50 | lock tutorial, easy, medium, medium, challenge, recovery, mixed medium, mixed hard, mixed hard, major challenge |

Recovery levels are 11, 16, 26, 36 and 46. Milestone base coins are 150, 175,
195, 220 and 250 at levels 10, 20, 30, 40 and 50. Completion metadata adds a
special title/message and gold treatment to the existing reward animation.

Level 50 has five bottles, thirteen tray balls, normal/fragile/locked types and
the chain b1 → b3 → b5. Its targets are 15, 14, 17, 16, 18, with margins 2, 1,
1, 1, 2. Minimum and three-star threshold are 9 moves; two-star threshold is 12.
Its intended path takes 11 moves, allowing the player to discover a shorter path.
Three stars also require zero mistakes, Undo and Hint. Base reward is 250 coins.

## Validation results and commands

All **50/50** shipped levels validate. All forty generated levels were accepted
on candidate 0: **no regeneration was required**. The largest complete search is
1,413 nodes (Level 49), below the generation/hint budget. Every intended path and
every minimum path completes through the actual gameplay transition in tests;
all minimum paths earn three stars without assistance.

The complete per-level table, including thresholds, mechanics and node counts,
is [level-validation.md](level-validation.md); machine-readable results are in
[level-validation.json](level-validation.json).

```sh
npm run levels:build     # deliberately regenerate the concrete bundle
npm run levels:check     # compare exact seeded output without writing
npm run levels:validate  # fail on any invalid shipped config
node scripts/validate-levels.cjs --report
npm run check           # tests + validation + TypeScript
```

The 88-test suite covers the earlier gameplay/economy contracts plus deterministic
generation, all fifty completion paths, waves/gates, tutorials, fragile damage,
reference locks and Undo, soft move goals, partial hints, limits, malformed configs
and persistence compatibility. An independent small-puzzle BFS cross-checks the
solver's minimum moves instead of only testing it against its own output.

Verification passed: `npm run check`, exact artifact reproduction with
`npm run levels:check`, and `git diff --check`. Browser checks passed at
320×568, 390×844 and 430×932, covering the new map, real first-level drag,
reward persistence/reload, duplicate Continue, capacity/Undo, cracks and paid
revive, move goals, fragile breakage, lock/Undo behavior, five-bottle layout,
tray pagination and Level 50 milestone completion. Board, tray and background
bounds stayed stable during placements, rejection and Undo. Screenshots are in
`artifacts/gameplay/phase3-level50-*.png` and `phase3-milestone50-*.png`.

## Compatibility and limitations

Profile coins, progress and completed rewards are retained. An unfinished saved
attempt with incompatible puzzle geometry is restarted at its selected available
level. A completed, uncommitted reward receipt can still resume and commit once
after the campaign changes. Previous best stars/moves remain attached to numeric
level IDs; there is no separate historical campaign leaderboard migration.

The solver models forward placements of positive normal weights, including
fragile damage and reference locks. It does not search Undo, revive or removal;
an above-target bottle is unsolvable by forward placement and needs player Undo.
It does not model future special balls or hard move failure. Minimum results are
exact only when search finishes within its budget. Uniqueness is not enforced;
challenge constraints are a design heuristic, not a measure of human difficulty.
Browser verification does not substitute for native device playtesting.

Shops, daily rewards, real advertising SDKs and special balls remain deferred.
