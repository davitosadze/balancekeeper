import type { LevelConfig } from '../../types/game';
import { normalizeLevel } from '../levelConfig';
import { fromSolution } from './authoring';
import { planLevel } from './plan';
import { DIFFICULTY_PROFILES, LEVEL_GENERATION_VERSION } from './profiles';
import { seededRandom } from './random';
import { solveLevel } from './solver';
import { validateLevelConfig } from './validation';

export function difficultyScore(config: LevelConfig, minimumMoves: number): number {
  return config.bottles.length * 2 + minimumMoves + Math.max(0, config.weights.length - (config.intendedSolution?.length ?? 0)) * 2
    + config.bottles.reduce((sum,b) => sum + 3 + (b.type === 'normal' ? 0 : 3),0);
}
/** Development/build only. Every candidate starts with an exact completion witness. */
export function generateLevel(id: number, version = LEVEL_GENERATION_VERSION): LevelConfig {
  if (version !== LEVEL_GENERATION_VERSION) throw new Error('Use the archived builder for a different generation version');
  const plan = planLevel(id), profile = DIFFICULTY_PROFILES[plan.difficulty];
  if (plan.mechanics?.some(mechanic => !profile.allowedMechanics.includes(mechanic))) throw new Error(`Unsupported mechanic in Level ${id}'s difficulty profile`);
  for (let attempt=0;attempt<64;attempt++) {
    const seed = `balance-keeper-v${version}:${id}:${attempt}`, rng = seededRandom(seed);
    const bottleCount = id === 50 ? 5 : rng.int(...profile.bottles);
    const ballCount = rng.int(Math.max(profile.solutionBalls[0],bottleCount*2), Math.max(profile.solutionBalls[1],bottleCount*2));
    const sizes = Array(bottleCount).fill(2);
    for (let i=bottleCount*2;i<ballCount;i++) sizes[rng.int(0,bottleCount-1)]++;
    const groups: number[][] = [], targets: number[] = [];
    let unsuitable = false;
    for (const size of sizes) {
      let chosen: number[] | null = null;
      for (let trial=0;trial<100;trial++) {
        const values = Array.from({length:size}, () => rng.int(2,10)), target = values.reduce((a,b) => a+b,0);
        if (target >= profile.target[0] && target <= profile.target[1] && !targets.includes(target)) { chosen = values; targets.push(target); break; }
      }
      if (!chosen) { unsuitable = true; break; }
      groups.push(chosen);
    }
    if (unsuitable) continue;
    const distractorCount = plan.kind === 'recovery' ? 0 : rng.int(...profile.distractors);
    const distractors = Array.from({length:distractorCount}, (_,i) =>
      id >= 21 && plan.difficulty !== 'challenge' && i === 0 ? targets[rng.int(0,targets.length-1)] : rng.int(3, Math.max(...targets)-1));
    const baseCoins = id === 50 ? 250 : plan.milestone ? ({20:175,30:195,40:220} as Record<number,number>)[id]
      : plan.difficulty === 'challenge' ? 180 : rng.int(...profile.baseCoins);
    const config = fromSolution(id, plan.difficulty, groups,
      { ...plan, source: 'generated', baseCoins, distractors, generation: { seed, attempt } });
    config.bottles.forEach(b => { b.durability = rng.int(...profile.durability); });
    if (plan.mechanics?.includes('fragile')) {
      config.bottles[1].type = 'fragile'; config.bottles[1].durability = 1;
      if (bottleCount >= 4) { config.bottles[3].type = 'fragile'; config.bottles[3].durability = 1; }
    }
    if (plan.mechanics?.includes('locked')) {
      // Tutorial: solve b1 to open b2. Later: b1 -> b3 -> b5 (when present).
      const first = bottleCount === 2 ? 1 : 2;
      config.bottles[first].type = 'locked'; config.bottles[first].unlockAfter = 'b1';
      if (bottleCount === 5) { config.bottles[4].type = 'locked'; config.bottles[4].unlockAfter = config.bottles[first].id; }
    }
    config.weights = rng.shuffle(config.weights);
    const result = solveLevel(normalizeLevel(config), undefined, 12000);
    if (result.status !== 'solved' || result.minimumMoves == null) continue;
    // Challenge layouts must require combinations, not one obvious ball per bottle.
    if (plan.difficulty === 'challenge' && result.minimumMoves < bottleCount*2-1) continue;
    config.minimumMoves = result.minimumMoves;
    config.difficultyScore = difficultyScore(config, result.minimumMoves);
    if (config.difficultyScore < profile.minimumDifficultyScore) continue;
    config.stars = { threeStarMaxMoves: result.minimumMoves + profile.threeStarSlack,
      twoStarMaxMoves: result.minimumMoves + profile.threeStarSlack + profile.twoStarSlack };
    config.recommendedMoves = result.minimumMoves + profile.recommendedMoveSlack + profile.threeStarSlack;
    if (plan.mechanics?.includes('move-goal')) config.rules.moveLimit = config.stars.threeStarMaxMoves;
    const validation = validateLevelConfig(config, { campaign: true, nodeLimit: 12000 });
    if (validation.valid) return config;
  }
  throw new Error(`Unable to generate an efficiently solvable Level ${id} after 64 candidates`);
}
