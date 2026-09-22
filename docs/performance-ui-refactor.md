# Performance and UI consistency refactor

Implemented over the existing Phase 1–5 engine and cosmetic inventory. Level configs, solver solutions, capacities, damage, combo rewards, prices, star rules, transaction IDs, and save keys are unchanged. No new gameplay or monetization features were added.

## Measurements

The pre-change audit identified real work on the interaction path; the original freeze was not reproduced on a physical device. These measurements describe local Node and Chromium runs, not a native-device frame-rate guarantee.

| Check | Before | After |
| --- | --- | --- |
| Referenced game/menu artwork, including weight textures | 8,157,242 bytes | 1,592,162 bytes, including new thumbnails (80.5% less) |
| Three menu artwork files | 5,213,848 bytes | 240,484 bytes |
| Five background files | 1,004,360 bytes | 745,686 bytes |
| Five bottle files | 944,444 bytes | 484,654 bytes |
| Five default weight textures | 1254×1254 each; ~30 MiB decoded RGBA total | No image requests or decoded raster surfaces |
| Four classic bottle state canvases | 1024×1536 each; 24 MiB RGBA total | 640×960 each; 9.375 MiB RGBA total |
| Action availability across 50 initial levels, four passes | Median 0.089 ms; p95 1.211 ms; max 6.107 ms | Median 0.0004 ms; p95 0.003 ms; max 0.056 ms |
| Pointer movement | JS callback for every update, position animated with `left`/`top` | Shared-value transforms; one Gameplay render across 35 updates in the test |
| Selection/feedback persistence | JSON serialization scheduled by every Zustand `set` | Zero writes for six repeated selections; transient-only updates reuse the cached save projection |
| Warm Continue transition | No comparable baseline captured | 70 / 71 / 74 ms at 320 / 390 / 430px widths |
| Sample normal/overload dispatch duration | No comparable baseline captured | 0.1–0.6 ms, excluding deferred storage, React commit and rasterization |
| Drag frame interval p95 | No comparable baseline captured | ~16.7 ms in local headless Chromium |

The artwork total compares the formerly referenced art with the new runtime files and thumbnails, rather than counting preserved source files as shipped UI. Decoded figures are pixel-size estimates, not resident-memory measurements. The preview/reference originals remain in the repository.

Raw browser metrics and screenshots: [`artifacts/performance-ui`](../artifacts/performance-ui). The asset inventories are [`asset-audit-originals.json`](asset-audit-originals.json) and [`asset-optimization.json`](asset-optimization.json).

## 1. Slow image loading: root causes

The menu loaded three large PNGs. Small balls loaded 1254px transparent textures; every bottle state had a 1024×1536 transparent canvas. Shop cards used gameplay-sized bottle and background art. There was no explicit decode warmup for the first crack. Six audio players—including an unused 3.5 MB music file—were created for each screen using the audio hook. The font gate also had no error fallback.

Runtime artwork now uses smaller WebP derivatives, default balls use code, and browsing screens use thumbnails. Font-load failure releases the splash and permits fallback typography.

## 2. Drop freeze: root causes

`gameplayActions()` called the hint solver to decide whether to enable Hint. That function ran from Gameplay rendering, so every new board position could trigger a bounded DFS. Persistence also constructed a fresh initial game to discover save fields and synchronously serialized the complete envelope on selection, placement, and effect cleanup. Broad subscriptions, whole-board bottle props, and JS gesture updates compounded the work.

Hint search now runs only on an explicit hint request or existing development validation. Button availability checks inexpensive state/affordability conditions. A non-obvious unsolvable position can therefore leave Hint enabled until requested; the existing failed-hint response still spends no coins and consumes no allowance. Drop evaluation and reward rules are unchanged.

## 3. Image resizing and compression

Created 13 runtime files and seven thumbnails with [`scripts/optimize-assets.py`](../scripts/optimize-assets.py). It uses Pillow, preserves aspect ratio, retains required glass transparency, removes fully opaque alpha, and writes WebP. The supplied originals are untouched.

- Backgrounds: maximum 832px wide and 1480px high; Cozy Room is 832×1248.
- Bottles: 640×960. Normal, crack-1, crack-2, broken and Crystal retain identical proportional crop coordinates.
- Menu: background 832×1248, logo 768×384, tagline board 640×360.
- All original images were inventoried, including unused alternate bottles/backgrounds/weights and app icons. Unused reference art is not imported into runtime components. App icon, splash and favicon files remain unchanged.

## 4. Thumbnail strategy

Background thumbnails are at most 240×426. Bottle thumbnails are 160×240; Amber/Frosted reuse the normal thumbnail with their existing finish. The grid only shows the normal bottle state. A selected bottle modal can load its full optimized damage-state asset on demand. Background modals use the thumbnail too, so browsing and previewing never require the full environment image. Wood, Metal and Classic weight previews are code-rendered.

## 5. Active asset preload

`getActiveGameplayAssets()` returns just the selected background and active bottle's four resolved states. Crystal still resolves damaged states to the existing classic damage artwork. No weights, locked shop cosmetics, other backgrounds or level previews are preloaded.

Gameplay shows a short “Setting the table…” panel until the selected set is ready, and disables input during that preparation. Failed loading offers Retry. Native warmup mounts the active images to prime image surfaces as well as prefetching their URIs. Essential short effects are prepared once when enabled; audio readiness never holds up gameplay.

## 6. Caching

The centralized preload cache deduplicates requests. Web explicitly awaits `HTMLImageElement.decode()` and retains decoded handles for the active set. Native uses React Native image prefetch plus mounted warmup images. SceneBackground is memoized and subscribes only to the equipped background ID. Bottle/tray layout remains stable for the attempt. Regression checks verified identical background bounds and DOM identity across successful placement and all three overloads, with no new crack/broken image requests.

## 7. Ball migration

`Ball` supports value/weight, color, size, skin/skinId, selection, dragging, disabled state and accessible dynamic kg labels. Layered gradients, a glossy highlight, a light inner edge and restrained shadows create the sphere. Available colors include green, blue, red, orange, wood and dark/heavy. Wood and Metal cosmetics also use code. An optional `texture` prop allows a future custom image skin without making images a default dependency. All old weight-image imports were removed.

The existing heavy-weight slot dimensions are retained so tray paging, hit testing and contained-ball layout do not shift. Visible weight shells are circular.

## 8. Drag/drop

Native gesture updates write directly to shared x/y values. JS receives pickup, release/cancel and changes to the hovered bottle, rather than every pointer sample. Release evaluates the destination once and commits one domain transition. Return animations use translation/scale, and visual position no longer animates layout coordinates. Tap-to-select and tap-to-place remain available.

## 9. Component rendering

GameBoard, Tube, BallTray, individual tray slots, Ball, TopHud, actions and SceneBackground have memoization at stable prop boundaries. Tube receives its own bottle object and relevant events rather than the entire bottle array. GameBoard reuses unchanged per-bottle event arrays. Derived target/durability lists and event callbacks remain stable. A coin-only update cannot invalidate the board's unchanged props.

Progress bars animate scale rather than width. Existing bounded confetti, settle, crack, combo and unlock effects remain. Large runtime blur filters were not present; none were introduced. Browsing backgrounds use small, softly scaled images behind warm translucent panels.

## 10. State subscriptions

The gameplay hook selects runtime fields separately from the coin balance; it does not subscribe to inventory or receipt objects. Shop subscribes to profile/save fields, excluding moves and effects. Level Select selects unlocks and records; its coin component has its own subscription. Cosmetic renderers select their equipped IDs. Settings and the system reduced-motion flag share one small settings store, replacing independent reads and caches.

## 11. Audio

`src/services/soundManager.ts` owns five reusable players: pour, complete, levelup, error and undo. Related semantic cues share those handles. Focus ownership, cue priority and a 180ms overlap guard suppress duplicates. Playback is deferred and fire-and-forget. No player is created during a drop. The unused music player/download was removed; no unsupported Music toggle is displayed.

## 12. Haptics

The existing centralized priority/coalescing hook is retained. It now reads the shared settings state, respects focus and device availability, and never awaits feedback. Pending feedback rechecks the saved setting before firing. There is one root listener for system reduced motion rather than a listener in every bottle, ball animation and popup.

## 13. Persistence

The existing Zustand store, AsyncStorage key `balance-keeper-progress`, version-2 attempt envelope and ordered writer remain authoritative. The save projection is cached by persistent field identity. Selection, hover and feedback cleanup are excluded. Move checkpoints use a bounded 250ms batch window; JSON serialization happens when the batch drains, outside the synchronous drop path.

Purchases, equipping, utilities and level-reward commits explicitly flush the same queue. Coins, receipts, inventory and attempt recovery remain atomic in one envelope. Failed reward retries explicitly resend the existing receipt, even when the cached profile reference is unchanged. Retry never repeats the transaction. App backgrounding, page hiding and root cleanup flush pending moves. A force-quit before a checkpoint completes can still lose the most recent unsaved move; financial actions only report saved success after flush.

Settings use their existing `balance-keeper-settings` key and raw settings format with ordered writes. Volume uses accessible ± controls, replacing per-pointer-event writes. Unsupported High Contrast and Animation Speed controls were removed because no renderer consumed them. Reduced Motion is now supported and saved. Reset affects settings only; the misleading “Clear Saved Data” control was removed.

## 14. Next-level preparation

The result screen resolves the next normalized config and prepares the currently equipped environment/bottle set. Configs already live in the static campaign registry, so this does not generate or solve levels. Cached images and shared audio handles survive navigation. Continue retains the existing reward-save gate.

## 15. Level Selector

A virtualized four-column grid replaces 50 large animated cards. The shared wooden/glass header shows LEVELS and the live wallet. Green unlocked tiles, dark locked tiles, earned stars, a highlighted current level, challenge marks and milestone crowns all use actual progression/config data. The progress line uses real completed-level counts. No unsupported cosmetic-unlock promise is shown.

## 16. Settings

Warm grouped panels, code icons, 54px rows and green switches match Gameplay and Shop. Supported controls are Sound Effects, Haptics, Volume and Reduced Motion. Saved controls are disabled until hydration; failed reads/writes offer Retry. Scrollable content and safe-area edges support small phones. Native accessibility states and web checked state are explicit.

## 17. Level Complete

Retained the real reward breakdown, stars, wallet receipt and short staged reveal. Shared green/brown controls, gold emphasis and a warm panel replace inconsistent buttons. Compact spacing and side-by-side Replay/Continue fit small phones; the level-map action remains available. Content stays scrollable for larger text and long milestone copy. Background blur is not animated.

## 18. Level Failed

The existing failure overlay now uses a warm dark panel with a restrained rust border, the real broken-bottle image and supportive copy. It shows the configured revive cost, disables unaffordable revival, hides it when exhausted, and retains Restart/Levels. The illustration's aspect ratio shows the entire damaged bottle. Break/revive mechanics and reveal timing are unchanged.

## 19. Shop

Uses the same header, coin component, buttons and warm panel treatment. The two-column FlatList renders visible/nearby cards, the three code-built tabs expose selection, and equipped/owned/price text conveys state without relying on color. Preview remains local; Buy/Equip use the existing centralized transaction methods and duplicate guards. Save-error recovery is retained. No missing future cosmetic became purchasable.

## 20. Remaining risks and validation limits

- The production web export succeeds; its minified JavaScript bundle is about 2.5 MB before transport compression. Framework download/parse cost can still matter on a cold web launch.
- Browser timing is from this machine, with warm assets and the local Expo development build. It does not measure a cold native launch, GPU memory, thermal throttling, slow storage or low-end device decoding.
- Native image caches can evict surfaces under memory pressure; physical-device checks of the first crack and repeated navigation remain useful.
- Explicit Hint still runs the bounded solver on JS. Ordinary placement never calls it.
- Move serialization is deferred, not moved to a worker. Extremely large future receipt histories could make a checkpoint costly; no save-schema or economy changes were introduced speculatively.
- Crystal has no supplied matching crack/broken art, so its damage silhouette uses the established fallback. Amber/Frosted remain code finishes on classic art.
- Original images remain available for future higher-resolution variants. The chosen runtime resolution targets the current capped scene size; very high-density tablets may benefit from targeted density variants after device testing.

## Verification and changed files

`npm run check`: 122 tests passed, TypeScript passed, and 50/50 campaign levels validated. Seven new performance tests cover solver exclusion, deferred serialization, batched writes, transaction ordering/retry, transient-state filtering, active preload scope and code-weight/thumbnail resolution. Existing cosmetic tests were migrated from texture expectations to code styles. `npm run levels:check` exactly reproduced all 50 shipped configs. A production `expo export --platform web` succeeded, and its asset list contains no original weight textures or unused music file.

Browser checks at 320×568, 390×844 and 430×932 cover repeated selection, gesture movement, successful drop, first/second crack, break, revive, restart, result/Continue/replay, Settings save/reload, four-column levels, Shop tab changes/purchase and thumbnail-only browsing. The separate Shop suite verifies duplicate purchases, free equip, insufficient coins and inventory reload at all three sizes. Four supplied background/bottle/weight combinations verify optimized art and Crystal damage fallback. The Phase 4 browser regression suite also passed with normal and system-reduced motion, including combo tiers, locked bottles, muted audio, break reveal and actionable win timing.

Main files changed in this refactor:

- Assets: `src/assets/cosmetics.ts`, `preload.ts`, `sounds.ts`; `assets/runtime/*`, `assets/thumbnails/*`; `scripts/optimize-assets.py`.
- Engine integration/save: `src/domain/gameplay.ts`, `persistence.ts`; `src/store/gameStore.ts`, `settingsStore.ts`; `src/types/game.ts`.
- Hooks/services: `useGameState.ts`, `useStableCallback.ts`, `useAudio.ts`, `useHaptics.ts`, `useReducedMotionPreference.ts`; `src/services/soundManager.ts`.
- Rendering: `Ball.tsx`, `BallTray.tsx`, `Tube.tsx`, `GameBoard.tsx`, `SceneBackground.tsx`; gameplay `assets.ts`, `GameplayAssetWarmup.tsx`, `GameplayHud.tsx`, `GameplayActions.tsx`, `ReturningWeight.tsx`; main `MainArtwork.tsx`, `MainChrome.tsx`; shop `CosmeticPreview.tsx`.
- Shared UI: `theme.ts`, `GameIcon.tsx`, `ScreenHeader.tsx`, `Button.tsx`, `Card.tsx`.
- Screens: `Gameplay.tsx`, `LevelSelect.tsx`, `Settings.tsx`, `LevelComplete.tsx`, `Shop.tsx`; root `app/_layout.tsx`.
- Validation: `tests/performance.test.cjs`, `tests/cosmetics.test.cjs`, `scripts/check-performance-ui.cjs`, updated shop/cosmetic/phase-4 browser scripts, `src/utils/performance.ts`, this report and asset inventories.
- Dependency declarations: `package.json` and `package-lock.json` explicitly declare the already-installed `expo-asset` version used by the preload registry.
