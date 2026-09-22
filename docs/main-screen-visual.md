# Main screen visual update

The live home route (`app/index.tsx` → `src/screens/MainMenu.tsx`) now uses the supplied main artwork as separate layers. The project remains Expo/React Native with Expo Router, Zustand, StyleSheet, LinearGradient and Reanimated.

## Assets and composition

- Background: `assets/main/main-bg.png`, cover-fit at explicit viewport dimensions.
- Logo: `assets/main/logo.png`, proportional width with a short settling animation.
- Tagline: `assets/main/tagline-board.png`, below the logo and clear of the cork.
- Bottle: `assets/bottles/bottle-normal.webp`, reused through `BottleVisual`.
- Contents: supplied blue, green and red WebP textures with React labels for 2, 5 and 10 kg. The stack is decorative and never changes game state.
- HUD, avatar, coin, small icons, Play button, bottom actions and footer are independent React Native components.

`MainArtwork.tsx` contains the image layers; `MainChrome.tsx` contains the HUD and interactive controls. Vertical placement follows available safe-area height. Widths and type scale from the available width, capped on larger screens. There is no home-screen ScrollView.

## Existing state and navigation

The HUD reads the current level, coins and completed-level progress from the existing store. There is no player-name field, so it displays “Player.” No example currency or level is written to player data.

Play opens the current `/game`, preserving an unfinished attempt and resetting an ended attempt. Levels opens `/level-select`; How to Play opens `/tutorial`; Settings opens `/settings`. The latter existing actions occupy the reference's Shop/Daily positions because those features have no routes. The plus button opens a small informational coin panel; no store or purchasing system was invented.

## Refinement and checks

Compared initial and refined screenshots to the reference. Refined logo width, tagline spacing, stacked-weight contact, settings icon shape, footer contrast and Play press depth. Motion settles once rather than looping continually, and respects system reduced-motion preferences.

Local Chromium checks passed at 430×932, 414×896, 390×844, 375×812, 360×780 and 360×640. Checks covered no page scrolling, bottle/Play/menu/footer separation, contained weight bounds, all navigation, the coin panel and persisted currency. No browser runtime errors occurred. TypeScript and whitespace checks passed. Native device rendering was not tested.

Final screenshots: `artifacts/main/main-430.png` and `artifacts/main/main-360-compact.png`.

The supplied background, wooden logo, hanging tagline and colored weight textures differ from the reference art. Those originals are preserved, rather than generating substitutes.
