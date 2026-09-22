> Current scope: [Gameplay Phase 5](gameplay-phase5.md). Earlier phase descriptions below remain historical references.

BALANCE KEEPER — GAMEPLAY RULES / SOURCE OF TRUTH

Do not generate levels yet.

First implement and align the existing game with the following gameplay rules.
These rules define how Balance Keeper works.

==================================================
1. CORE OBJECTIVE
==================================================

Each level contains:
- bottles
- weighted balls
- target weight per bottle
- maximum capacity per bottle
- optional durability
- optional special bottle rules

The player drags weighted balls into bottles.

A bottle is SOLVED only when:

currentWeight === targetWeight

A bottle may be under target without penalty.

A bottle may be above target but still below capacity:
- this is allowed
- bottle is NOT solved
- player must correct it if the game supports moving balls back out

A bottle becomes OVERLOADED only when:

currentWeight + droppedWeight > capacity

The whole level is completed only when ALL bottles are solved.

==================================================
2. BOTTLE STATES
==================================================

Every bottle has:

target
capacity
durability
damage
isSolved
isBroken

Visual state mapping:

damage = 0
-> bottle-normal

damage = 1
-> bottle-crack-1

damage = 2
-> bottle-crack-2

broken = true
-> bottle-broken

Do not use global durability.
Damage belongs to individual bottles.

==================================================
3. WHEN A BOTTLE CRACKS
==================================================

A bottle cracks only when the player attempts an overload:

nextWeight > capacity

Normal valid drops do NOT damage a bottle.

Default normal bottle durability:

3 overload mistakes before breaking.

Example:

Bottle:
capacity = 15

Current:
12

Drop:
5

Result would be:
17

17 > 15

Therefore:
- reject the ball from the bottle
- return the ball to tray / previous position
- increment bottle damage by 1
- increment mistakes
- reset combo
- trigger crack feedback

Damage progression:

first overload:
normal -> crack-1

second overload:
crack-1 -> crack-2

third overload:
crack-2 -> broken

Once broken:
the level fails.

Fragile bottles may have lower durability.

Example:

durability = 1

One overload:
-> immediately broken

Do not damage a bottle just because it is above target.
Damage is based on CAPACITY, not target.

==================================================
4. LEVEL FAIL CONDITIONS
==================================================

Primary fail condition:

A bottle breaks.

status:
lost

lossReason:
broken

Later-supported fail conditions:

moveLimit exceeded
no valid solution remains
special challenge timer expired

But bottle breaking is the main standard failure mechanic.

Do NOT fail a level for:
- one incorrect non-overloading move
- thinking too long
- being above target but under capacity

==================================================
5. REVIVE
==================================================

After bottle-break failure, offer ONE revive per level.

Options may include:

- pay coins
- rewarded ad
- restart

Default revive coin cost:

150 coins

A revive should:
- restore gameplay to the state immediately before the breaking move
- return the offending ball
- restore the bottle to the previous damaged state
- reset combo to 0
- keep previous legitimate progress
- increment revivesUsed

Maximum:
1 revive per attempt

If the player fails again after revive:
only Restart / Exit should remain.

==================================================
6. MOVES
==================================================

A move is counted only when a ball is successfully placed into a bottle.

Rejected overload attempts:
- count as mistake
- do not need to count as successful move

Undo should reverse a previous successful move.

Do not count UI actions as moves.

==================================================
7. COMBO SYSTEM
==================================================

Combo rewards consecutive good gameplay.

Combo increases after a successful useful placement.

Default:

successful valid drop:
combo += 1

Combo labels:

2 -> Nice!
3 -> Great!
4 -> Amazing!
5+ -> Balance Master!

Cap the visual/reward multiplier if needed at x5.

Combo should reset on:

- overload attempt
- invalid drop
- undo
- hint used

Combo should NOT reset because the player takes time to think.

This is a puzzle game, not a reflex game.

==================================================
8. PERFECT FIT
==================================================

A Perfect Fit happens when a successful drop causes:

nextWeight === targetWeight

Example:

target = 15
current = 10
drop = 5

Result:
15

Trigger:
PERFECT FIT

Reward:
default +10 coins

Also:
- play satisfying sound
- animate bottle
- animate capacity bar
- optionally show coin particles

Perfect Fit can also contribute to combo.

==================================================
9. COINS
==================================================

Coins are a persistent player currency.

The player earns coins from:

- completing levels
- Perfect Fits
- combo bonuses
- star bonuses
- challenge rewards
- daily rewards later

Initial economy:

Level completion:
40-120 coins depending on difficulty

Perfect Fit:
+10 coins

3-star bonus:
+25 coins

Challenge/milestone levels:
higher reward

Do not make coin rewards explode too quickly.

==================================================
10. WHAT COINS CAN BUY
==================================================

Gameplay utility:

Hint
Default cost: 50 coins

Undo
Some levels/free allowance may provide free uses.
Additional undo:
30 coins

Shuffle
Default cost:
25 coins

Revive
Default cost:
150 coins

Cosmetics later:

Bottle skins:
1000+ coins

Weight skins:
750+ coins

Backgrounds:
2500+ coins

Possible cosmetic categories:

Bottle skins:
- Classic Glass
- Crystal
- Amber
- Frosted
- Neon
- Laboratory

Weight skins:
- Classic
- Metal
- Marble
- Wood
- Neon
- Galaxy
- Gold

Backgrounds:
- Cozy Room
- Workshop
- Garden
- Laboratory
- Night Room
- Beach House

Cosmetics MUST NOT change gameplay power.

Do not make this pay-to-win.

==================================================
11. HINT
==================================================

Hint should suggest ONE valid useful move.

It should not solve the entire level.

When used:
- deduct cost or free hint count
- reset combo
- increment hintUsed
- visually highlight:
  source ball
  destination bottle

Hint logic should prefer a move that belongs to at least one valid solution path.

Do not knowingly suggest a dead-end move.

==================================================
12. UNDO
==================================================

Undo restores the previous successful-move snapshot.

Snapshot should include:

- bottle contents
- bottle current weights
- bottle damage if appropriate
- tray weights
- moves
- combo
- coinsEarned during current level if necessary

Undo should:
- reset combo
- increment undoUsed

Do not undo permanent profile data.

==================================================
13. SHUFFLE
==================================================

Shuffle only rearranges the visible available-ball tray.

It does NOT:
- change ball values
- regenerate balls
- alter the solution
- alter bottles

It is primarily a visual/help action.

Default cost:
25 coins

==================================================
14. STAR SYSTEM
==================================================

Every completed level receives 1-3 stars.

1 star:
complete the level

2 stars:
complete within recommended move threshold

3 stars:
complete within stricter move threshold
AND
no mistakes
AND
no undo

Hints may also disqualify 3 stars.

Example:

stars: {
  twoStarMaxMoves: 10,
  threeStarMaxMoves: 8,
  requireNoMistakesForThree: true,
  requireNoUndoForThree: true,
  requireNoHintForThree: true
}

Do not calculate stars from time for normal levels.

==================================================
15. WIN SEQUENCE
==================================================

A level is won when:

every bottle:
currentWeight === targetWeight

On win:

- prevent further drag interaction
- animate solved bottles
- calculate stars
- calculate rewards
- animate earned coins
- show Level Complete screen

Example result:

LEVEL COMPLETE

★★★

Level Reward      +60
Perfect Fits      +30
Combo Bonus       +20
3-Star Bonus      +25

TOTAL             135 coins

Continue

==================================================
16. DIFFICULTY PHILOSOPHY
==================================================

Difficulty should come from decisions, not punishment.

Increase difficulty using:

- more bottles
- more balls
- closer capacity margins
- distractor balls
- lower durability
- move limits
- locked bottles
- fragile bottles
- special ball types

Do NOT make every level strictly harder than the previous one.

Use difficulty waves:

easy
easy
medium
hard
easy/recovery
medium
hard
challenge

==================================================
17. SPECIAL BOTTLES - LATER
==================================================

Normal:
standard rules

Fragile:
lower durability

Locked:
cannot accept balls until its unlock condition is met

Exact:
may reject any drop that goes above target even if still below capacity

One-way:
balls cannot be removed after placement

Do not implement all advanced types unless requested.
Architecture should support them.

==================================================
18. SPECIAL BALLS - LATER
==================================================

normal
heavy
sticky
mystery
split
double

Do not implement these yet unless requested.

Keep the model extensible.

==================================================
19. LEVEL CONFIGURATION
==================================================

All gameplay rules per level should come from LevelConfig / JSON.

Do NOT hardcode level-specific behavior inside React/UI components.

Example:

{
  "id": 21,
  "difficulty": "medium",
  "bottles": [
    {
      "id": "b1",
      "target": 15,
      "capacity": 20,
      "durability": 3,
      "type": "normal"
    }
  ],
  "weights": [
    {
      "id": "w1",
      "value": 5,
      "color": "green",
      "type": "normal"
    }
  ],
  "rules": {
    "moveLimit": null,
    "allowUndo": true,
    "allowHint": true,
    "allowShuffle": true,
    "maxRevives": 1
  },
  "rewards": {
    "baseCoins": 50,
    "perfectFitCoins": 10,
    "threeStarBonus": 25
  }
}

==================================================
20. IMPLEMENTATION RULES
==================================================

Keep game logic separate from presentation.

Prefer pure/testable functions for:

evaluateDrop
isBottleSolved
isLevelComplete
calculateStars
calculateRewards
getBottleVisualState
canRevive
getHintMove

Centralize state transitions.

Do not let UI components independently decide:
- whether a bottle breaks
- how many coins to award
- whether a level is won
- whether combo resets

Those should come from gameplay/domain logic.

Before generating 50 levels, implement and test this gameplay contract first.
