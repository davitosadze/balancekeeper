# Balance Keeper Gameplay Phase 5

The subsequent [performance and UI refactor](performance-ui-refactor.md) replaces weight textures with code, optimizes artwork, and updates the shared screens. This document records the Phase 5 inventory and transaction foundation.

The cosmetic shop has Bottles, Weights and Backgrounds tabs, permanent starter
items, preview/confirmation dialogs, coin purchases, free equipping and saved
inventory. Gameplay resolves equipped cosmetics without changing puzzle rules.
The current catalog has **12 available items** and eight disabled future entries.
No real-money purchase, IAP, ads, daily reward or random purchase system was added.

## Files changed

| Files | Responsibility |
|---|---|
| `src/domain/cosmetics/catalog.ts` (new) | Cosmetic definitions, prices, categories, availability and default IDs |
| `src/domain/cosmetics/inventory.ts` (new) | Pure purchase/equip operations, receipt IDs, ownership migration and safe equipment selection |
| `src/assets/cosmetics.ts` (new) | Central image registry, glass finishes, skin damage fallback, weight shell and background resolution |
| `src/types/game.ts`, `src/domain/progress.ts` | Persistent cosmetic fields, `cosmetic_purchase` transaction reason and legacy-save defaults |
| `src/store/gameStore.ts` | Serialized purchase/equip admission, atomic profile updates, persistence failure handling and race protection |
| `src/hooks/useCosmetics.ts` (new) | Presentation-only selectors for equipped IDs |
| `src/screens/Shop.tsx`, `src/components/shop/CosmeticPreview.tsx`, `app/shop.tsx` (new) | Responsive shop, previews, confirmation, ownership/equipment labels and retry UI |
| `src/screens/MainMenu.tsx`, `src/components/main/MainChrome.tsx` | Shop entry beside the existing menu actions |
| `src/components/Ball.tsx`, `src/components/Tube.tsx`, `src/components/SceneBackground.tsx`, `src/components/gameplay/assets.ts` | Equipped artwork and centralized imports across tray, drag, return, contents and scenery |
| `src/screens/Gameplay.tsx`, `src/screens/LevelComplete.tsx` | Coordinate gameplay/reward saving with an in-flight cosmetic save |
| `tests/cosmetics.test.cjs` (new) | Purchase, inventory, persistence, resolver and race regression tests |
| `scripts/check-shop.cjs`, `scripts/check-cosmetic-scenes.cjs` (new) | Mobile shop flows, equipped gameplay, background stability and supplied-art checks |
| `docs/gameplay-phase5.md`, earlier phase scope pointers | Implementation and compatibility report |

Additional artwork appeared in the shared workspace during implementation:
`assets/bottles/bottle-crystal.webp` and the Garden, Workshop, Laboratory and
Night background files. Their catalog/registry changes were preserved and the
supplied art integrated. Existing assets were not regenerated or overwritten.

## Cosmetic model and available catalog

Definitions are separate from UI:

```ts
interface CosmeticDefinition {
  id: string;
  category: 'bottle' | 'weight' | 'background';
  name: string;
  price: number;
  asset: string | null;       // key in the central appearance registry
  previewAsset?: string;
  rarity?: 'common' | 'rare' | 'epic';
  isDefault?: boolean;
  unlockType: 'default' | 'coins' | 'level' | 'achievement' | 'daily' | 'event';
  unlockValue?: number;
  available: boolean;
}
```

Only `default` and `coins` are implemented. Other unlock types reserve schema
space; no achievements, level unlock rewards or daily/event logic was added.
Unavailable entries have no image reference and are excluded from the production
shop. They cannot be purchased or equipped.

| Category | Available item | Coins | Artwork |
|---|---|---|---|
| Bottle | Classic Glass | Free | Existing complete damage-state set |
| Bottle | Amber | 750 | Existing glass with an amber finish |
| Bottle | Frosted | 1,000 | Existing glass with a pale frosted finish |
| Bottle | Crystal | 1,500 | Supplied faceted Crystal artwork; standard damage fallback |
| Weight | Classic | Free | Existing value/color-dependent texture selection |
| Weight | Wood | 500 | Existing wood shell for every value |
| Weight | Metal | 750 | Existing metal/handled shell for every value |
| Background | Cozy Room | Free | Existing gameplay room |
| Background | Workshop | 1,500 | Supplied workshop scene |
| Background | Garden | 1,800 | Supplied garden scene |
| Background | Laboratory | 2,200 | Supplied laboratory scene |
| Background | Night Room | 2,500 | Supplied night scene |

No levels, level prices, assistance prices, completion rewards or generator values
were modified to fund the shop.

## Persistence and migration

The existing `balance-keeper-progress` profile gains:

```ts
ownedCosmetics: string[];
equipped: {
  bottleSkinId: string;
  weightSkinId: string;
  backgroundId: string;
};
```

Default ownership always includes `bottle_classic`, `weight_classic` and
`background_cozy_room`. Equipment initially points to those items. The existing
session storage envelope/version remains compatible; no second inventory or
wallet key is introduced.

`restoreCosmetics()` merges defaults, removes duplicate/invalid ownership entries,
and repairs missing ownership from valid cosmetic purchase receipts. Unknown or
retired ownership IDs are retained so a catalog change cannot erase a purchase.
Unknown, unavailable, wrong-category or unowned equipped IDs resolve to the
category default. Migration preserves coins, completion records, unlocks, the
current attempt and existing transactions. There is no inventory-removal API.

## Purchase flow and duplication protection

Tapping an unowned card opens its preview and purchase confirmation. The UI sends
only the item ID to the store; the domain reads its price and availability from
catalog data. Buy is disabled when the live balance is insufficient, with an exact
“Need N more coins” message.

`purchaseCosmetic()` verifies availability, coin unlock type and ownership, then
uses the existing `spendCoins()` transaction layer with:

```ts
reason = 'cosmetic_purchase';
transactionId = `cosmetic:${itemId}`;
```

The pure result contains the new wallet, receipt, owned item and automatically
equipped selection together. The store applies that profile in one synchronous
update before awaiting ordered persistence. The lifetime receipt plus ownership
check prevents a second charge after double taps, renders, reloads or retries.
A synchronous `cosmeticBusy` guard prevents concurrent Buy/Equip actions from
admitting stale balances. Gameplay spending and reward commit coordinate with this
save; a waiting result retries its reward commit after the cosmetic save finishes.

Success feedback appears after the save succeeds. On failure, the in-memory
transaction/selection remains intact and further spending is blocked by the
existing storage error state. **Retry Save writes that same profile; it does not
purchase again.** The UI does not claim the change is saved until persistence
succeeds. As with any local save, closing the app before a failed write is retried
can lose unsaved changes, but the profile update cannot persist only the debit
without its ownership grant.

The shop header shows the real updated balance immediately and briefly scales it
when it changes. It does not display a fake or delayed wallet count.

## Equip and preview flow

Owned cards show Owned; the active item shows Equipped. Equipping is free, updates
one category field and creates no coin transaction. Previously equipped items
remain owned. The current item cannot be repeatedly equipped.

Preview state lives only in the Shop dialog. It passes an explicit skin ID to the
same bottle/weight renderers used in gameplay. Bottle previews include Whole,
Cracked and Broken states. Cancel, Close and Back discard preview state without
writing equipment. A purchase auto-equips; an owned item's Equip action saves the
selection. The dialog is scrollable on short phones, and the grid stays two columns.

## Gameplay integration and asset resolution

`useEquippedCosmetic()` validates owned equipment for a category. Cosmetic state is
not imported by the solver, level configuration or gameplay transition logic.
Existing `Ball` instances use the selected shell in the tray, lifted drag object,
return animation, bottle contents and menu hero. Values remain dynamic readable
text. Outer weight sizing, drag geometry and weight values remain determined by
the existing presentation/gameplay rules, not the cosmetic.

All cosmetic image imports are centralized in `src/assets/cosmetics.ts`:

- `getBottleSkinAsset(skinId, damageState)` resolves an optional state set and finish.
- `getWeightSkinAsset(skinId, weight, color)` resolves a reusable shell.
- `getGameplayBackground(backgroundId)` resolves artwork, a tabletop reference and
  a shared readability overlay.

Unknown or unavailable selections fall back to Classic/Cozy Room. Missing future
assets are not passed to `require()`. The existing gameplay asset facade re-exports
the central registry for compatibility with other components.

Background selection retains shared HUD contrast gradients and the stable
bottom-aligned tabletop crop. Background-specific tabletop positions are data in
the registry, not level or game rules. New scenes do not move in response to drops,
cracks, tray count or cosmetic prices.

## Bottle damage compatibility

The registry supports `{ normal, crack1?, crack2?, broken? }`. A missing damaged
state resolves to the existing matching damage asset. The normal skin is never
rendered over a broken bottle. All skins preserve the existing crack/break logic,
fragile and exact/one-way badges, lock state and feedback events.

Amber and Frosted use the same source geometry for every state, with a lightweight
finish applied to intact/cracked glass. Broken glass is untinted and fully visible.
Crystal uses its supplied normal artwork; its dedicated cracked and broken assets
are missing. **Crystal therefore changes to the standard cracked/broken silhouette
when damaged.** This is an intentional clarity-first fallback; it does not change
hit targets, contents, capacity, durability, damage count, rewards or difficulty.
Skin-specific damaged art can be added later without new gameplay logic.

## Tests and validation

`npm run check` passes **115 tests**, TypeScript checking and validation of all
**50/50** campaign levels. The fifteen new cosmetic tests cover:

- Catalog defaults, IDs, pricing and disabled assets.
- Affordable purchases, insufficient coins, unknown/disabled items and duplicates.
- Free equip, one selection per category and preserved ownership.
- Old-save defaults, invalid equipment and receipt-based inventory recovery.
- Resolver selection, actual image references and every damage fallback.
- Unchanged gameplay configuration/snapshots.
- Double Buy, concurrent purchase/spending admission and relaunch persistence.
- Purchase/equip save failure and retry without a duplicate debit.
- A pending level reward committing once after a cosmetic save.

`npm run levels:check` reproduces all shipped configurations exactly. No level
needed regeneration or changed its minimum moves.

`scripts/check-shop.cjs` passes at **320×568, 390×844 and 430×932**. It exercises
home-to-shop navigation, the two-column grid, all tabs, preview/cancel, double Buy,
free re-equipping, insufficient balance, reload and the equipped background/weight/
bottle in gameplay. Successful placement and all three damage stages preserve
background and board bounds. Screenshots are in `artifacts/shop/`.

`scripts/check-cosmetic-scenes.cjs` checks the supplied backgrounds with Crystal,
Frosted/Amber and metal/wood weights, including dynamic value text and Crystal's
crack fallback. Native-device playtesting remains useful for final visual tuning.

## Missing cosmetic assets

Disabled and hidden from the production shop:

- Bottle: Laboratory and Neon.
- Weight: Marble, Candy, Neon, Galaxy and Gold.
- Background: Beach House.

Amber/Frosted are rendered finishes, not newly generated standalone artwork.
Crystal-specific crack-1, crack-2 and broken images are also missing; the safe
standard damage fallback described above is active.
