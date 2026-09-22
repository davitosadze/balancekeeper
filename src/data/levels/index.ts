import { normalizeLevel } from '../../domain/levelConfig';
import type { LevelConfig } from '../../types/game';
import campaign from './campaign/campaign-v1.json';

/** Concrete, validated campaign. Generation and exhaustive validation run before shipping. */
export const LEVEL_CONFIGS = campaign as LevelConfig[];
export const LEVELS = LEVEL_CONFIGS.map(normalizeLevel);
export function getLevelById(id: number) {
  const level = LEVELS.find(item => item.id === id);
  if (!level) throw new Error(`No level found with id ${id}`);
  return level;
}
export function getTotalLevels(): number { return LEVELS.length; }
export function getUnlockedLevels(unlockedLevels: number[] = [1], highestUnlockedLevel = 1): number[] {
  return LEVELS.filter(level => level.id <= highestUnlockedLevel || unlockedLevels.includes(level.id)).map(level => level.id);
}
