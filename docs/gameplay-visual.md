# Gameplay presentation

The existing `Gameplay` screen renders a compact warm HUD, horizontal bottles,
per-bottle current/capacity panels, a recessed translucent tray and bottom actions.
Original background, bottle and weight `.webp` assets remain unchanged.

`GameplayScene` uses normal flex layout inside top/bottom/left/right safe areas.
Bottles scale with width, count and available height. The tray reserves its original
row and pagination height, so placements and Undo never shift the scene. On short
phones, the original background cover crop follows the stable tabletop baseline.
Only a subtle top readability gradient is applied.

Capacity text and its animated bar use actual capacity. Where target differs, a
second line identifies the target. Cracks follow per-bottle overload mistake damage.
Existing Reanimated settling, return, impact and stage-change effects remain in use.
Pickup positioning is synchronous to avoid a lifted weight lingering after a tap.

Hints highlight the source ball and destination bottle, navigating to the source tray
page if needed. Bottom controls show real free uses or prices. Coins come from the
persistent wallet; coin information explains this attempt's provisional earnings.
Combo labels and the Level Complete reward breakdown come from domain calculations.

The shared audio hook preloads and reuses existing effects, arbitrates competing cues,
reads saved mute/volume settings, and stops playback on screen blur.

`/gameplay-preview` remains a separate three-bottle visual fixture that never writes
player progress. Phase 3 adds fifty campaign levels using the existing graphical assets.

Current gameplay scope is documented in [gameplay-phase5.md](gameplay-phase5.md).
Run `npm test`, `npx tsc --noEmit`, and `scripts/check-gameplay.cjs` for regression checks.
The browser checks cover 320×568 through 430×932, simulated safe areas, real drags,
Undo, damage, paid revive, persistent rewards, fragile bottles, reference locks,
move goals and milestone completion. Tutorial and bottle-type overlays do not
participate in scene layout; move goals use the existing combo row.
Screenshots are saved to `artifacts/gameplay/`. Native device verification remains pending.

Phase 4 adds semantic combo/fit/stress/unlock feedback in the existing scene,
a delayed break overlay, a faster win sequence and OS reduced-motion support.

Phase 5 resolves owned bottle/weight/background cosmetics centrally. Previews do
not equip items, damage visuals retain safe fallbacks, and the shop uses the same
renderers and warm panels without moving the gameplay scene.
