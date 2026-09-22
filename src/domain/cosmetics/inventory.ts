import type { CoinTransaction, PlayerProgress } from '../../types/game';
import { spendCoins } from '../economy';
import { DEFAULT_COSMETICS, DEFAULT_EQUIPPED, EQUIPPED_KEY, getCosmetic, type CosmeticCategory } from './catalog';
export interface EquippedCosmetics { bottleSkinId: string; weightSkinId: string; backgroundId: string }
export interface CosmeticInventory { ownedCosmetics: string[]; equipped: EquippedCosmetics }
export const cosmeticTransactionId = (id: string) => `cosmetic:${id}`;
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length < 120;
/** Defaults cannot be lost. Retired ownership survives; invalid equipment safely falls back. */
export function restoreCosmetics(saved?: Partial<CosmeticInventory>, transactions: Record<string,CoinTransaction> = {}): CosmeticInventory {
  const owned = new Set<string>(DEFAULT_COSMETICS);
  if(Array.isArray(saved?.ownedCosmetics)) saved.ownedCosmetics.filter(validId).forEach(id => owned.add(id));
  for(const [key, tx] of Object.entries(transactions)) {
    if(tx && tx.reason === 'cosmetic_purchase' && tx.id === key && key.startsWith('cosmetic:') && Number.isSafeInteger(tx.amount) && tx.amount <= 0) {
      const id = key.slice('cosmetic:'.length); if(validId(id)) owned.add(id);
    }
  }
  const equipped: EquippedCosmetics = {...DEFAULT_EQUIPPED};
  for(const category of ['bottle','weight','background'] as const) {
    const key = EQUIPPED_KEY[category], id = saved?.equipped?.[key];
    const item = typeof id === 'string' ? getCosmetic(id) : undefined;
    if(item?.available && item.asset && item.category === category && owned.has(item.id)) equipped[key] = item.id;
  }
  return {ownedCosmetics:[...owned],equipped};
}
export function resolveEquippedCosmetic(inventory: CosmeticInventory, category: CosmeticCategory): string {
  const key = EQUIPPED_KEY[category], id = inventory.equipped?.[key], item = getCosmetic(id);
  return item?.available && item.asset && item.category === category && inventory.ownedCosmetics.includes(id) ? id : DEFAULT_EQUIPPED[key];
}
export interface CosmeticResult { progress: PlayerProgress; applied: boolean; message?: string }
export function purchaseCosmetic(progress: PlayerProgress, id: string, at = 0): CosmeticResult {
  const item = getCosmetic(id);
  if(!item?.available || !item.asset || item.unlockType !== 'coins') return {progress,applied:false,message:'This item is unavailable.'};
  if(progress.ownedCosmetics.includes(id)) return {progress,applied:false,message:'Already owned.'};
  // One deterministic lifetime receipt per item protects duplicate calls and retries.
  const result = spendCoins(progress,item.price,'cosmetic_purchase',cosmeticTransactionId(id),at);
  if(!result.applied) return {progress,applied:false,message:result.transaction ? 'Already purchased.' : `Need ${Math.max(0,item.price-progress.coins).toLocaleString()} more coins.`};
  return {applied:true,progress:{...result.progress,ownedCosmetics:[...new Set([...DEFAULT_COSMETICS,...progress.ownedCosmetics,id])],
    equipped:{...progress.equipped,[EQUIPPED_KEY[item.category]]:id}}};
}
export function equipCosmetic(progress: PlayerProgress, id: string): CosmeticResult {
  const item = getCosmetic(id);
  if(!item?.available || !item.asset || !progress.ownedCosmetics.includes(id)) return {progress,applied:false,message:'Own this item before equipping it.'};
  const key = EQUIPPED_KEY[item.category];
  if(progress.equipped[key] === id) return {progress,applied:false,message:'Already equipped.'};
  return {applied:true,progress:{...progress,equipped:{...progress.equipped,[key]:id}}};
}
