import { useGameStore } from '../store/gameStore';
import { resolveEquippedCosmetic } from '../domain/cosmetics/inventory';
import type { CosmeticCategory } from '../domain/cosmetics/catalog';
/** Presentation-only selectors. Config, puzzle state and solver never import cosmetics. */
export function useEquippedCosmetic(category: CosmeticCategory) {
  return useGameStore(state => resolveEquippedCosmetic(state.progress,category));
}
