import type { ImageSourcePropType } from "react-native";
import type { BallColor, DamageStage } from "../types/game";
import { getCosmetic } from "../domain/cosmetics/catalog";

/** All cosmetic image imports live here. No missing/future image is required. */
type BottleTier = 'normal' | 'royal' | 'legendary' | 'crystal';
const BOTTLE_TIER_IMAGES: Record<BottleTier, Record<DamageStage, ImageSourcePropType>> = {
  normal: {
    pristine: require("../../assets/bottles/normal/normal.webp"),
    hairline: require("../../assets/bottles/normal/cracked1.webp"),
    cracked: require("../../assets/bottles/normal/cracked2.webp"),
    critical: require("../../assets/bottles/normal/cracked2.webp"),
    broken: require("../../assets/bottles/normal/broken.webp"),
  },
  royal: {
    pristine: require("../../assets/bottles/royal/normal.webp"),
    hairline: require("../../assets/bottles/royal/crack1.webp"),
    cracked: require("../../assets/bottles/royal/crack2.webp"),
    critical: require("../../assets/bottles/royal/crack2.webp"),
    broken: require("../../assets/bottles/royal/broken.webp"),
  },
  legendary: {
    pristine: require("../../assets/bottles/legendary/normal.webp"),
    hairline: require("../../assets/bottles/legendary/cracked1.webp"),
    cracked: require("../../assets/bottles/legendary/cracked2.webp"),
    critical: require("../../assets/bottles/legendary/cracked2.webp"),
    broken: require("../../assets/bottles/legendary/broken.webp"),
  },
  crystal: {
    pristine: require("../../assets/bottles/crystal/normal.webp"),
    hairline: require("../../assets/bottles/crystal/crack1.webp"),
    cracked: require("../../assets/bottles/crystal/crack2.webp"),
    critical: require("../../assets/bottles/crystal/crack2.webp"),
    broken: require("../../assets/bottles/crystal/broken.webp"),
  },
};
export const BOTTLE_IMAGES: Record<DamageStage, ImageSourcePropType> = BOTTLE_TIER_IMAGES.normal;
const ROOM = require("../../assets/runtime/gameplay-bg.webp");
const GARDEN = require("../../assets/runtime/garden-bg.webp");
const LABORATORY = require("../../assets/runtime/laboratory-bg.webp");
const NIGHT = require("../../assets/runtime/night-bg.webp");
const WORKSHOP = require("../../assets/runtime/workshop-bg.webp");
export const MENU_BACKGROUND = GARDEN;
interface BottleSkinAssets {
  normal: ImageSourcePropType;
  crack1?: ImageSourcePropType;
  crack2?: ImageSourcePropType;
  broken?: ImageSourcePropType;
  tint?: string;
  tintOpacity?: number;
  glassOpacity?: number;
}
function tierSkin(tier: BottleTier): BottleSkinAssets {
  const images = BOTTLE_TIER_IMAGES[tier];
  return {
    normal: images.pristine,
    crack1: images.hairline,
    crack2: images.cracked,
    broken: images.broken,
    // These are full photo-real bottle renders, not translucent line-art overlays; show them as-is.
    glassOpacity: 1,
  };
}
const BOTTLE_SKINS: Record<string, BottleSkinAssets> = {
  glass_classic: tierSkin('normal'),
  glass_royal: tierSkin('royal'),
  glass_legendary: tierSkin('legendary'),
  glass_crystal: tierSkin('crystal'),
};
export function getBottleSkinAsset(skinId: string, stage: DamageStage) {
  const item = getCosmetic(skinId);
  const skin =
    item?.category === "bottle" && item.available
      ? (BOTTLE_SKINS[item.asset ?? ""] ?? BOTTLE_SKINS.glass_classic)
      : BOTTLE_SKINS.glass_classic;
  const key =
    stage === "pristine"
      ? "normal"
      : stage === "hairline"
        ? "crack1"
        : stage === "broken"
          ? "broken"
          : "crack2";
  return {
    ...skin,
    source: skin[key] ?? BOTTLE_IMAGES[stage],
    fallback: !skin[key],
    // Keep shattered edges fully legible; never apply an intact skin over broken glass.
    tintOpacity: stage === "broken" ? 0 : (skin.tintOpacity ?? 0),
  };
}
interface BackgroundAsset {
  source: ImageSourcePropType;
  tableEdge: number;
  overlay: string;
}
const BACKGROUND_DEFAULT: BackgroundAsset = {
  source: ROOM,
  tableEdge: 0.62,
  overlay: "rgba(37,23,13,.20)",
};
const BACKGROUND_ASSETS: Record<string, BackgroundAsset> = {
  room_cozy: BACKGROUND_DEFAULT,
  garden: { source: GARDEN, tableEdge: 0.60, overlay: "rgba(35,46,20,.16)" },
  laboratory: { source: LABORATORY, tableEdge: 0.63, overlay: "rgba(10,26,38,.22)" },
  night: { source: NIGHT, tableEdge: 0.635, overlay: "rgba(8,12,28,.30)" },
  workshop: { source: WORKSHOP, tableEdge: 0.645, overlay: "rgba(43,27,12,.20)" },
};
export function getGameplayBackground(backgroundId: string): BackgroundAsset {
  const item = getCosmetic(backgroundId);
  const asset =
    item?.category === "background" && item.available ? item.asset : null;
  return (asset ? BACKGROUND_ASSETS[asset] : undefined) ?? BACKGROUND_DEFAULT;
}

const BACKGROUND_THUMBNAILS: Record<string, ImageSourcePropType> = {
  room_cozy: require('../../assets/thumbnails/gameplay-bg-thumb.webp'),
  garden: require('../../assets/thumbnails/garden-bg-thumb.webp'),
  laboratory: require('../../assets/thumbnails/laboratory-bg-thumb.webp'),
  night: require('../../assets/thumbnails/night-bg-thumb.webp'),
  workshop: require('../../assets/thumbnails/workshop-bg-thumb.webp'),
};
export function getBackgroundThumbnail(id: string) {
  return BACKGROUND_THUMBNAILS[getCosmetic(id)?.asset ?? ''] ?? BACKGROUND_THUMBNAILS.room_cozy;
}
const BOTTLE_SKIN_THUMBNAILS: Record<string, ImageSourcePropType> = {
  glass_classic: require('../../assets/thumbnails/bottle-normal-thumb.webp'),
  glass_royal: BOTTLE_TIER_IMAGES.royal.pristine,
  glass_legendary: BOTTLE_TIER_IMAGES.legendary.pristine,
  glass_crystal: require('../../assets/thumbnails/bottle-crystal-thumb.webp'),
};
export function getBottleThumbnail(id: string) {
  return BOTTLE_SKIN_THUMBNAILS[getCosmetic(id)?.asset ?? ''] ?? BOTTLE_SKIN_THUMBNAILS.glass_classic;
}
export const MAIN_ART = {
  background: require('../../assets/runtime/main-bg.webp'),
  logo: require('../../assets/runtime/logo.webp'),
  tagline: require('../../assets/runtime/tagline-board.webp'),
};
export function getActiveGameplayAssets(backgroundId: string, bottleSkinId: string) {
  return [...new Set([getGameplayBackground(backgroundId).source,
    ...(['pristine','hairline','cracked','broken'] as const).map(stage => getBottleSkinAsset(bottleSkinId,stage).source)])];
}
/** Photo-real ball renders. Every ball color and equipped skin material has matching art, so every ball in a run shares one consistent photo look. */
export const WEIGHT_BALL_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  green: require('../../assets/weights/weight-green.webp'),
  blue: require('../../assets/weights/weight-blue.webp'),
  red: require('../../assets/weights/weight-red.webp'),
  yellow: require('../../assets/weights/weight-yellow.webp'),
  purple: require('../../assets/weights/weight-purple.webp'),
  cyan: require('../../assets/weights/weight-cyan.webp'),
  wood: require('../../assets/weights/weight-wood.webp'),
  heavy: require('../../assets/weights/weight-heavy.webp'),
};
export type WeightColor = BallColor | 'orange' | 'wood' | 'dark' | 'heavy';
const WEIGHT_STYLES: Record<string, readonly [string,string,string]> = {
  green: ['#b7da83','#659c43','#31532a'], blue: ['#a5dcf3','#448fb8','#284a70'],
  red: ['#edac8e','#bc5341','#682f28'], orange: ['#f5cd86','#cd883d','#795027'],
  yellow: ['#f5cd86','#cd883d','#795027'], purple: ['#c3acd9','#8770a9','#463852'],
  cyan: ['#9fe0d6','#3fa89c','#1f5a52'],
  wood: ['#e6c08c','#ad7d4e','#62462e'], heavy: ['#a9b2ad','#5a6968','#293c40'],
  dark: ['#a9b2ad','#5a6968','#293c40'],
};
export function getWeightSkinStyle(id: string, color: WeightColor = 'green', value = 5) {
  const material = id === 'weight_wood' ? 'wood' : id === 'weight_metal' ? 'heavy' : value >= 15 ? 'heavy' : color;
  // The kettlebell photo's handle occupies its top third, so a label centered on the
  // full square sits in that gap; nudge it down onto the round body every other skin's art already fills.
  const labelOffsetY = material === 'heavy' ? .12 : 0;
  return { material, colors: WEIGHT_STYLES[material] ?? WEIGHT_STYLES.green, labelOffsetY };
}
