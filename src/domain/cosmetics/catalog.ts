export type CosmeticCategory = 'bottle' | 'weight' | 'background';
export type CosmeticUnlockType = 'default' | 'coins' | 'level' | 'achievement' | 'daily' | 'event';
export interface CosmeticDefinition {
  id: string; category: CosmeticCategory; name: string; price: number;
  asset: string | null; previewAsset?: string; rarity?: 'common' | 'rare' | 'epic';
  isDefault?: boolean; unlockType: CosmeticUnlockType; unlockValue?: number;
  available: boolean;
}
export const DEFAULT_EQUIPPED = {
  bottleSkinId: 'bottle_classic', weightSkinId: 'weight_classic', backgroundId: 'background_cozy_room',
} as const;
export const DEFAULT_COSMETICS = Object.values(DEFAULT_EQUIPPED);
export const EQUIPPED_KEY = { bottle:'bottleSkinId', weight:'weightSkinId', background:'backgroundId' } as const;
const item = (id: string, category: CosmeticCategory, name: string, price: number, asset: string | null): CosmeticDefinition => ({
  id, category, name, price, asset, available: asset !== null, isDefault: price === 0,
  unlockType: price === 0 ? 'default' : 'coins', rarity: price >= 1500 ? 'epic' : price >= 750 ? 'rare' : 'common',
});
/** Prices and availability are data, never supplied by Shop purchase arguments. */
export const COSMETICS: readonly CosmeticDefinition[] = [
  item('bottle_classic','bottle','Classic Glass',0,'glass_classic'),
  item('bottle_royal','bottle','Royal',750,'glass_royal'),
  item('bottle_legendary','bottle','Legendary',1000,'glass_legendary'),
  item('bottle_crystal','bottle','Crystal',1500,'glass_crystal'),
  item('bottle_laboratory','bottle','Laboratory',1800,null),
  item('bottle_neon','bottle','Neon',2500,null),
  item('weight_classic','weight','Classic',0,'weight_classic'),
  item('weight_wood','weight','Wood',500,'weight_wood'),
  item('weight_metal','weight','Metal',750,'weight_metal'),
  item('weight_marble','weight','Marble',900,null),
  item('weight_candy','weight','Candy',1000,null),
  item('weight_neon','weight','Neon',1500,null),
  item('weight_galaxy','weight','Galaxy',2200,null),
  item('weight_gold','weight','Gold',3000,null),
  item('background_cozy_room','background','Cozy Room',0,'room_cozy'),
  item('background_workshop','background','Workshop',1500,'workshop'),
  item('background_garden','background','Garden',1800,'garden'),
  item('background_laboratory','background','Laboratory',2200,'laboratory'),
  item('background_night_room','background','Night Room',2500,'night'),
  item('background_beach_house','background','Beach House',3000,null),
];
export const getCosmetic = (id: string): CosmeticDefinition | undefined => COSMETICS.find(item => item.id === id);
export const getShopItems = (category: CosmeticCategory) => COSMETICS.filter(item => item.category === category && item.available);
