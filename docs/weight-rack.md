# Weight rack

The gameplay tray is now an opaque, beveled wooden rack with evenly spaced recessed holders. Weight labels sit beneath the spheres so they do not cover the ball textures. The selected or hinted holder and label turn gold. Existing equipped ball materials remain in use.

`trayLayout` uses a uniform holder width and fits each inventory into pages while keeping every ball at least 44 points wide. Empty holders complete the final row. The original inventory controls rack sizing throughout an attempt, so placing weights, returning a rejected weight, and using Undo do not shift the bottles or resize the background. Arrow controls supplement swipe navigation and page dots. Page transitions respect reduced motion.

Drag origins now account for the holder width and label area. The sphere disappears during a drag while its holder and label stay visible.

Validation:

- TypeScript and `git diff --check` pass.
- All 122 existing tests pass.
- All 50 campaign inventories fit at rack widths of 292, 362, 402, and 572 points, with a minimum ball diameter of 44 points.
- Browser checks cover tap-to-place, drag-to-place, Undo, paging, hints, rejected placement, and stable rack/bottle geometry at 320 × 568, 390 × 844, and 430 × 932.
- Screenshots in `artifacts/weight-rack/` show level 14 with wood and classic skins, including selection and the second page.
