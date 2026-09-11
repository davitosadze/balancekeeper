import type { Level } from "@/types/game";

import level1 from "./level-1.json";
import level2 from "./level-2.json";
import level3 from "./level-3.json";
import level4 from "./level-4.json";
import level5 from "./level-5.json";
import level6 from "./level-6.json";
import level7 from "./level-7.json";
import level8 from "./level-8.json";
import level9 from "./level-9.json";
import level10 from "./level-10.json";
import level11 from "./level-11.json";
import level12 from "./level-12.json";
import level13 from "./level-13.json";
import level14 from "./level-14.json";
import level15 from "./level-15.json";
import level16 from "./level-16.json";
import level17 from "./level-17.json";
import level18 from "./level-18.json";
import level19 from "./level-19.json";
import level20 from "./level-20.json";
import level21 from "./level-21.json";
import level22 from "./level-22.json";
import level23 from "./level-23.json";
import level24 from "./level-24.json";
import level25 from "./level-25.json";
import level26 from "./level-26.json";
import level27 from "./level-27.json";
import level28 from "./level-28.json";
import level29 from "./level-29.json";
import level30 from "./level-30.json";
import level31 from "./level-31.json";
import level32 from "./level-32.json";
import level33 from "./level-33.json";
import level34 from "./level-34.json";
import level35 from "./level-35.json";
import level36 from "./level-36.json";
import level37 from "./level-37.json";
import level38 from "./level-38.json";
import level39 from "./level-39.json";
import level40 from "./level-40.json";
import level41 from "./level-41.json";
import level42 from "./level-42.json";
import level43 from "./level-43.json";
import level44 from "./level-44.json";
import level45 from "./level-45.json";
import level46 from "./level-46.json";
import level47 from "./level-47.json";
import level48 from "./level-48.json";
import level49 from "./level-49.json";
import level50 from "./level-50.json";
import level51 from "./level-51.json";
import level52 from "./level-52.json";

/** All 52 levels (50 core + 1 gimmick-showcase bonus + 1 additional), in order, as typed Level objects. */
export const LEVELS: Level[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
  level11,
  level12,
  level13,
  level14,
  level15,
  level16,
  level17,
  level18,
  level19,
  level20,
  level21,
  level22,
  level23,
  level24,
  level25,
  level26,
  level27,
  level28,
  level29,
  level30,
  level31,
  level32,
  level33,
  level34,
  level35,
  level36,
  level37,
  level38,
  level39,
  level40,
  level41,
  level42,
  level43,
  level44,
  level45,
  level46,
  level47,
  level48,
  level49,
  level50,
  level51,
  level52,
] as unknown as Level[];

/**
 * Looks up a level by its id.
 * @param id - The level id (1-51).
 * @returns The matching Level.
 * @throws If no level with that id exists.
 */
export function getLevelById(id: number): Level {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) {
    throw new Error(`No level found with id ${id}`);
  }
  return level;
}

/**
 * @returns The total number of levels available.
 */
export function getTotalLevels(): number {
  return LEVELS.length;
}

/**
 * Computes which level ids are unlocked given the player's current progress.
 * Level 1 is always unlocked.
 * @param unlockedLevels - Array of unlocked level ids from PlayerProgress.
 * @returns Sorted array of unlocked level ids.
 */
export function getUnlockedLevels(unlockedLevels: number[]): number[] {
  const set = new Set<number>([1, ...unlockedLevels]);
  return Array.from(set).sort((a, b) => a - b);
}
