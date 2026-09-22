# Woodland screens

Settings, Level Complete, the Bottle Broken result, and the Shop now share a wooden frame, warm cream typography, beveled buttons, and hanging signs. Completion and failure use red ribbon banners. Settings and the shop use the existing room artwork; completion reuses the generated forest from the level-selector redesign. No new generated assets are required.

Shared presentation components live in `src/components/ui/Woodland.tsx`. Failure presentation is isolated in `src/components/gameplay/FailureScreen.tsx`; gameplay still owns restart, revive availability, pricing, and transactions.

The settings page retains the existing sound, volume, haptics, reduced-motion, persistence-retry, and reset actions, and links to the tutorial and shop. The reference's music, localization, restore-purchase, and support options are not exposed because this app currently has no corresponding implementation or destinations.

Completion renders the actual reward breakdown and wallet receipt, including replay limits and save failures. The shop retains preview, cancel, buy, free equip, balance checks, and transaction retry. The failure screen renders the actual revive price and shortfall. Completion and failure use `FixedResultLayout` to measure and fit the full result composition inside the available safe-area height, with no scroll container. Every result action stays visible on small displays. Settings and the shop retain scrolling for their lists.

Validation:

- `npx tsc --noEmit` and `git diff --check` passed.
- `npm test`: all 122 tests passed.
- Browser checks at 320 × 568, 390 × 844, and 430 × 932 cover settings persistence; two-column shop geometry; previews and cancellation; purchases and free equip; insufficient coins; completion rewards saved once across reload; next-level navigation; failure, paid revive, and restart.
- Preview captures are in `artifacts/woodland/`, including `settings-390.png`, `complete-390.png`, `failed-390.png`, and `shop-bottles-390.png`.

Browser screenshots use isolated saved profiles. Native device rendering has not been verified in this pass.

Fixed-result follow-up: TypeScript and browser checks at 320 × 568, 390 × 754, and 430 × 838 verify that both result compositions and every action fit, wheel input does not move them, and Continue/Restart still work. The latter heights reserve space for phone safe areas. Captures are in `artifacts/woodland-fixed/`.
