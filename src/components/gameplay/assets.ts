import { Platform } from "react-native";
import type { BallColor, DamageStage } from "@/types/game";

export { BOTTLE_IMAGES } from '@/assets/cosmetics';
export function weightScale(weight: number) {
  if (weight <= 1) return 0.75;
  if (weight <= 2) return 0.88;
  if (weight <= 5) return 1;
  if (weight <= 10) return 1.12;
  return 1.2;
}
export function trayBallSize(weight: number, width: number) {
  return width * 0.16 * weightScale(weight);
}

export const GAME_FONT = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  default: '"Avenir Next", "Trebuchet MS", sans-serif',
});
