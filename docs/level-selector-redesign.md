# Forest level selector

The selector follows the supplied reference with a hanging wooden sign, forest scenery, four columns of beveled tiles, green unlocked levels, a crowned gold current level, purple milestones, and visible numbers and locks for unavailable levels. All displayed coins, stars, and unlocks come from saved progress. The virtualized grid includes the entire campaign and scrolls independently of the bottom card.

The bottom card opens the Backgrounds category of the existing shop. Its copy reflects the existing coin-based cosmetic economy; this visual change does not introduce a ten-level background reward.

## Artwork

Generated with the built-in imagegen tool. The optimized project asset is `assets/levels/forest.webp` (828 pixels wide, approximately 158 KB). Interactive UI is rendered in React Native.

Final generation prompt:

> Use case: stylized-concept. Asset type: portrait mobile puzzle game background, 1024x1792 or similar tall portrait. Create ONLY the background scenery, no UI. An inviting enchanted forest with very large warm brown tree trunks, deep moss green foliage, soft amber lantern light and golden late afternoon sun shafts, a rustic timber boardwalk winding into the woods, small lush plants framing the lower left and lower right. Premium casual mobile game painterly 3D illustration, rounded organic shapes, richly textured wood, cinematic depth of field. Composition: dark green forest canopy at top; softly blurred tree trunks and warm light in the middle 70% to sit behind a grid of game buttons; a sunlit wooden path across the bottom quarter; darker vignette around perimeter. Warm chocolate brown and emerald green with amber highlights. Keep central area uncluttered and moderately dark for cream text and green buttons layered by the app. Full bleed environment only. No lettering, no title, no sign, no numbers, no buttons, no coins, no stars, no crowns, no frames, no phone mockup, no interface.

## Verification

- TypeScript check: `npx tsc --noEmit`.
- Existing suite: `npm test`, 122 tests passed.
- Browser layout and interaction checks at 320 × 568, 390 × 844, and 430 × 932: four-column geometry, real coin balance, locked states, background-shop category navigation, back navigation, and starting an unlocked level.
- Screenshots: `artifacts/level-selector/levels-320.png`, `levels-390.png`, and `levels-430.png`.

Browser screenshots use an isolated test profile with nine completed levels and 1,250 coins. Native device rendering has not been verified in this pass.
