import { GAME_ECONOMY } from './economy';
import { hashSeed } from './levels/random';
import type { Difficulty, LegacyLevel, LevelConfig, Level, LevelMetadata, LevelRules, RewardConfig } from '../types/game';

export const DEFAULT_RULES: LevelRules = {
  allowUndo: true, allowHint: true, allowShuffle: true,
  freeHints: GAME_ECONOMY.freeHintsPerLevel, freeUndos: GAME_ECONOMY.freeUndosPerLevel,
  hintCost: GAME_ECONOMY.hintCost, undoCost: GAME_ECONOMY.undoCost,
  shuffleCost: GAME_ECONOMY.shuffleCost, reviveCost: GAME_ECONOMY.reviveCost,
  moveLimit: null, moveLimitMode: 'stars',
};
export const DEFAULT_REWARDS: Omit<RewardConfig, 'baseCoins'> = {
  perfectFitCoins: 10, threeStarBonus: 25, comboMilestones: { 2: 2, 3: 4, 4: 6, 5: 10 },
};
export const NORMAL_DURABILITY = 3;
const integer = (value: number, name: string, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`Invalid ${name}: ${value}`);
};

/** Shape/default validation plus the adapter used by the existing renderer. */
export function normalizeLevel(input: LegacyLevel | LevelConfig): Level {
  if (!input || typeof input !== 'object') throw new Error('Malformed level config');
  const modern = 'bottles' in input;
  const category: Difficulty = typeof input.difficulty === 'number'
    ? ({ 1: 'easy', 2: 'medium', 3: 'medium', 4: 'hard', 5: 'challenge' } as const)[input.difficulty] : input.difficulty;
  if (!['tutorial','easy','medium','hard','challenge'].includes(category)) throw new Error('Invalid difficulty');
  const difficulty = ({ tutorial: 1, easy: 1, medium: 2, hard: 4, challenge: 5 } as const)[category];
  if (modern && (!Array.isArray(input.bottles) || !Array.isArray(input.weights))) throw new Error('Bottles and weights must be arrays');
  const tubes = modern ? input.bottles.map((b, index) => ({ ...b, index, balls: [] })) : input.tubes;
  const tray = modern ? input.weights.map(({ value, ...ball }) => ({ ...ball, weight: value })) : input.tray;
  const metadata: LevelMetadata = modern ? {
    generationVersion: input.generationVersion, source: input.source, kind: input.kind, mechanics: input.mechanics,
    tutorial: input.tutorial, milestone: input.milestone, generation: input.generation,
    intendedSolution: input.intendedSolution, minimumMoves: input.minimumMoves,
    recommendedMoves: input.recommendedMoves, difficultyScore: input.difficultyScore,
  } : {};
  const recommended = metadata.minimumMoves ?? (modern ? tray.length : input.minMoves);
  const rules = { ...DEFAULT_RULES, ...input.rules };
  const rewards = { ...DEFAULT_REWARDS, baseCoins: ({ tutorial: 25, easy: 40, medium: 60, hard: 100, challenge: 150 })[category], ...input.rewards };
  const stars = { twoStarMaxMoves: modern ? Math.ceil(recommended * 1.5) : input.moves, threeStarMaxMoves: recommended, ...input.stars };
  integer(input.id, 'level id', 1);
  if (!Array.isArray(tubes) || !tubes.length) throw new Error('A level must contain bottles');
  if (!Array.isArray(tray) || !tray.length) throw new Error('A level must contain weights');
  for (const key of ['allowHint','allowUndo','allowShuffle'] as const) if (typeof rules[key] !== 'boolean') throw new Error(`Invalid ${key}`);
  for (const key of ['freeHints','freeUndos','hintCost','undoCost','shuffleCost','reviveCost'] as const) integer(rules[key], key);
  if (rules.moveLimit !== null) integer(rules.moveLimit, 'move goal', 1);
  if (rules.moveLimitMode !== 'stars') throw new Error('Only star-based move goals are supported');
  for (const key of ['baseCoins','perfectFitCoins','threeStarBonus'] as const) integer(rewards[key], key);
  if (!rewards.comboMilestones || typeof rewards.comboMilestones !== 'object') throw new Error('Invalid combo milestones');
  Object.entries(rewards.comboMilestones).forEach(([key, value]) => { integer(Number(key), 'combo milestone', 2); integer(value, 'combo bonus'); });
  integer(stars.twoStarMaxMoves, 'two-star moves', 1); integer(stars.threeStarMaxMoves, 'three-star moves', 1);
  if (stars.threeStarMaxMoves > stars.twoStarMaxMoves) throw new Error('Three-star threshold must be stricter than two-star threshold');
  if (rules.moveLimit != null && rules.moveLimit !== stars.threeStarMaxMoves) throw new Error('Move goal must match the three-star threshold');
  const ids = new Set<string>();
  const uniqueId = (id: string) => {
    if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid empty id');
    if (ids.has(id)) throw new Error(`Duplicate id: ${id}`); ids.add(id);
  };
  const normalized = tubes.map((tube, index) => {
    const id = tube.id ?? `b${index + 1}`, type = tube.type === 'one-way' ? 'oneWay' : tube.type ?? 'normal'; uniqueId(id);
    const durability = tube.durability ?? (type === 'fragile' ? 1 : NORMAL_DURABILITY);
    integer(tube.target, 'target', 1); integer(durability, 'durability', 1);
    if (!['normal','fragile','locked','exact','oneWay'].includes(type)) throw new Error(`Bottle type ${type} is reserved for later`);
    if (tube.damageOnOverload !== undefined && (typeof tube.damageOnOverload !== 'boolean' || type !== 'exact')) throw new Error('damageOnOverload is an exact-bottle boolean override');
    if (type !== 'locked' && tube.unlockAfter != null) throw new Error('Only locked bottles may reference an unlock condition');
    return { ...tube, id, type, index, durability, damage: 0 };
  });
  const visiting = new Set<string>(), visited = new Set<string>();
  const checkLock = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error('Cyclic bottle unlock references');
    const tube = normalized.find(b => b.id === id)!;
    visiting.add(id);
    if (tube.type === 'locked') {
      if (!tube.unlockAfter || !normalized.some(b => b.id === tube.unlockAfter)) throw new Error(`Invalid unlock reference for ${id}`);
      checkLock(tube.unlockAfter);
    }
    visiting.delete(id); visited.add(id);
  };
  normalized.forEach(tube => checkLock(tube.id));
  for (const ball of [...tray, ...normalized.flatMap(tube => tube.balls)]) {
    uniqueId(ball.id); integer(ball.weight, 'ball weight', 1);
    if (!['red','blue','green','yellow','purple','cyan'].includes(ball.color)) throw new Error('Invalid weight color');
    if (ball.type && ball.type !== 'normal') throw new Error(`Ball type ${ball.type} is reserved for later`);
  }
  if (input.lockedTubes?.length && !normalized.some(b => b.type === 'locked')) throw new Error('Legacy count-based locks must use unlockAfter references');
  const signature = `${metadata.generationVersion ?? 0}:${hashSeed(JSON.stringify({ tubes: normalized, tray, rules, rewards, stars }))}`;
  return { ...metadata, signature, category, id: input.id, name: input.name ?? `Level ${input.id}`, difficulty,
    tubes: normalized, tray, rules, rewards, stars, lockedTubes: normalized.filter(b => b.type === 'locked').map(b => b.index),
    minMoves: recommended, moves: stars.twoStarMaxMoves, hints: modern ? [] : input.hints, unlocks: input.unlocks ?? input.id + 1 };
}
