import type { LevelConfig, Level, Mechanic, SolutionMove } from '../../types/game';
import { normalizeLevel } from '../levelConfig';
import { evaluateDrop, isLevelComplete } from '../../utils/physics';
import { solveLevel, type SolverResult } from './solver';

const MECHANICS: Mechanic[] = ['basic','overload','durability','combo','move-goal','fragile','locked','exact','oneWay'];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonemptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export interface ValidationResult { valid: boolean; errors: string[]; level?: Level; solver?: SolverResult }
export function checkSolution(level: Level, solution: readonly SolutionMove[]): boolean {
  let tubes = level.tubes.map(b => ({ ...b, balls: [...b.balls] }));
  const tray = [...level.tray];
  for (const move of solution) {
    const ballIndex = tray.findIndex(b => b.id === move.weightId), bottleIndex = tubes.findIndex(b => b.id === move.bottleId);
    if (ballIndex < 0 || bottleIndex < 0) return false;
    const ball = tray[ballIndex], tube = tubes[bottleIndex];
    if (!evaluateDrop(tube, ball.weight, { bottles: tubes }).accepted) return false;
    tubes = tubes.map((b,i) => i === bottleIndex ? { ...b, balls: [...b.balls, ball] } : b);
    tray.splice(ballIndex,1);
  }
  return isLevelComplete(tubes);
}
/** Strict shipping validation; normalization's legacy defaults cannot conceal malformed authored data. */
export function validateLevelConfig(input: unknown, options: { campaign?: boolean; nodeLimit?: number } = {}): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['Malformed config'] };
  const config = input as LevelConfig;
  for (const key of ['id','difficulty','bottles','weights','rules','rewards','stars']) if (!(key in config)) errors.push(`Missing ${key}`);
  if (!Array.isArray(config.bottles) || !Array.isArray(config.weights)) return { valid: false, errors: [...errors,'Bottles and weights must be arrays'] };
  if (config.bottles.length > 5 || config.weights.length > 18) errors.push('Puzzle exceeds supported board/search size');
  for (const bottle of config.bottles) {
    if (!bottle || typeof bottle !== 'object') { errors.push('Malformed bottle'); continue; }
    for (const key of ['id','target','type', ...(bottle.type === 'fragile' && bottle.durability === undefined ? [] : ['durability'])]) if (!(key in bottle) || (bottle as unknown as Record<string,unknown>)[key] == null) errors.push(`Missing bottle ${key}`);
  }
  for (const ball of config.weights) {
    if (!ball || typeof ball !== 'object') { errors.push('Malformed weight'); continue; }
    for (const key of ['id','value','color','type']) if (!(key in ball)) errors.push(`Missing weight ${key}`);
    if (ball.type !== 'normal') errors.push('Only normal weight types are supported');
  }
  for (const key of ['rules','rewards','stars'] as const) {
    if (!config[key] || typeof config[key] !== 'object' || Array.isArray(config[key])) errors.push(`Malformed ${key}`);
  }
  if (config.stars && (!Number.isSafeInteger(config.stars.threeStarMaxMoves) || !Number.isSafeInteger(config.stars.twoStarMaxMoves))) errors.push('Missing star thresholds');
  if (config.rewards && ['baseCoins','perfectFitCoins','threeStarBonus','comboMilestones'].some(key => !(key in Object(config.rewards)))) errors.push('Missing reward fields');
  if (config.rules && (typeof config.rules.allowUndo !== 'boolean' || typeof config.rules.allowHint !== 'boolean')) errors.push('Missing action allow flags');
  if (config.rewards && !isRecord(config.rewards.comboMilestones)) errors.push('Malformed combo milestones');
  if (config.mechanics !== undefined && (!Array.isArray(config.mechanics) || config.mechanics.some(m => !MECHANICS.includes(m)))) errors.push('Invalid mechanics');
  if (config.tutorial !== undefined && (!isRecord(config.tutorial)
    || !['drag','combination','multiple-bottles','choice','overload','durability','combo','move-limit','fragile','locked'].includes(config.tutorial.type)
    || !Number.isSafeInteger(config.tutorial.step) || config.tutorial.step < 1
    || (config.tutorial.message !== undefined && !nonemptyString(config.tutorial.message)))) errors.push('Invalid tutorial metadata');
  if (config.name !== undefined && !nonemptyString(config.name)) errors.push('Invalid level name');
  if (config.source !== undefined && !['handcrafted','generated'].includes(config.source)) errors.push('Invalid level source');
  if (config.kind !== undefined && !['tutorial','standard','recovery','milestone'].includes(config.kind)) errors.push('Invalid level kind');
  for (const key of ['generationVersion','minimumMoves','recommendedMoves','difficultyScore'] as const) {
    const value = config[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < (key === 'difficultyScore' ? 0 : 1))) errors.push(`Invalid ${key}`);
  }
  if (config.generation !== undefined && (!isRecord(config.generation) || !nonemptyString(config.generation.seed)
    || !Number.isSafeInteger(config.generation.attempt) || config.generation.attempt < 0)) errors.push('Invalid generation metadata');
  if (config.milestone !== undefined && (!isRecord(config.milestone) || !nonemptyString(config.milestone.title)
    || !nonemptyString(config.milestone.completionMessage))) errors.push('Invalid milestone metadata');
  if (config.intendedSolution !== undefined && (!Array.isArray(config.intendedSolution)
    || config.intendedSolution.some(move => !isRecord(move) || !nonemptyString(move.weightId) || !nonemptyString(move.bottleId)))) errors.push('Malformed intended solution');
  if (errors.length) return { valid: false, errors };
  let level: Level;
  try { level = normalizeLevel(config); } catch (error) { return { valid: false, errors: [(error as Error).message] }; }
  if (options.campaign) {
    if (level.id < 1 || level.id > 50) errors.push('Campaign id outside 1–50');
    if (level.id < 31 && level.tubes.some(b => b.type === 'fragile')) errors.push('Fragile introduced before Level 31');
    if (level.id < 41 && level.tubes.some(b => b.type === 'locked')) errors.push('Locked introduced before Level 41');
    if (level.id < 21 && level.rules.moveLimit != null) errors.push('Move goal introduced before Level 21');
    if (level.id <= 10 && config.source !== 'handcrafted') errors.push('Levels 1–10 must be handcrafted');
    if (level.id % 10 === 0 && (!level.milestone || level.category !== 'challenge')) errors.push('Missing milestone challenge');
    for (const mechanic of ['fragile','locked'] as const) if (level.tubes.some(b => b.type === mechanic) !== !!level.mechanics?.includes(mechanic)) errors.push(`Incorrect ${mechanic} metadata`);
  }
  const solver = solveLevel(level, undefined, options.nodeLimit);
  if (solver.status === 'limit') errors.push('Search limit: minimum moves not proven');
  else if (!solver.solvable || !checkSolution(level, solver.solution)) errors.push('No valid completion path');
  if (solver.minimumMoves != null) {
    if (level.stars.threeStarMaxMoves < solver.minimumMoves || level.stars.twoStarMaxMoves < solver.minimumMoves) errors.push('Impossible star threshold');
    if (config.minimumMoves != null && config.minimumMoves !== solver.minimumMoves) errors.push('Incorrect minimumMoves metadata');
    if (config.recommendedMoves != null && config.recommendedMoves < solver.minimumMoves) errors.push('Impossible recommended moves');
  }
  if (config.intendedSolution && !checkSolution(level, config.intendedSolution)) errors.push('Invalid intended solution');
  return { valid: errors.length === 0, errors, level, solver };
}
