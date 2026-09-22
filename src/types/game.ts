export type Difficulty = 'tutorial' | 'easy' | 'medium' | 'hard' | 'challenge';
export type Mechanic = 'basic' | 'overload' | 'durability' | 'combo' | 'move-goal' | 'fragile' | 'locked' | 'exact' | 'oneWay';
export type TutorialType = 'drag' | 'combination' | 'multiple-bottles' | 'choice' | 'overload' | 'durability' | 'combo' | 'move-limit' | 'fragile' | 'locked';
export interface TutorialMetadata { type: TutorialType; step: number; message?: string }
export interface SolutionMove { weightId: string; bottleId: string }
export interface LevelMetadata {
  generationVersion?: number;
  source?: 'handcrafted' | 'generated';
  kind?: 'tutorial' | 'standard' | 'recovery' | 'milestone';
  mechanics?: Mechanic[]; tutorial?: TutorialMetadata;
  milestone?: { title: string; completionMessage: string };
  generation?: { seed: string; attempt: number };
  intendedSolution?: SolutionMove[]; minimumMoves?: number; recommendedMoves?: number; difficultyScore?: number;
}
export type BallColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'cyan';
export type BottleType = 'normal' | 'fragile' | 'locked' | 'exact' | 'oneWay' | 'one-way';
export type BallType = 'normal' | 'heavy' | 'sticky' | 'mystery' | 'split' | 'double';
export interface Ball { id: string; color: BallColor; weight: number; type?: BallType }

/** Optional fields support the existing visual fixtures and legacy level files. */
export interface Tube {
  index: number;
  id?: string;
  balls: Ball[];
  /** Single required weight: reach it to solve the bottle, exceed it to overload. */
  target: number;
  /** Number of overload mistakes before break. Legacy null is normalized to the default. */
  durability?: number | null;
  damage?: number;
  type?: BottleType;
  unlockAfter?: string;
  /** Exact bottles reject excess without damage unless explicitly enabled. */
  damageOnOverload?: boolean;
  /** Legacy HP field, ignored by the new level adapter. */
  maxDurability?: number;
}
export interface BottleState extends Tube {
  id: string;
  type: BottleType;
  currentWeight: number;
  containedWeightIds: string[];
  durability: number;
  damage: number;
  isSolved: boolean;
  isBroken: boolean;
}
export interface LevelRules {
  allowUndo: boolean; allowHint: boolean; allowShuffle: boolean;
  freeHints: number; freeUndos: number;
  hintCost: number; undoCost: number; shuffleCost: number; reviveCost: number;
  /** Optimization goal only; exceeding it never ends the attempt. */
  moveLimit: number | null; moveLimitMode: 'stars';
}
export interface RewardConfig { baseCoins: number; perfectFitCoins: number; threeStarBonus: number; comboMilestones: Record<number, number> }
export interface StarConfig {
  twoStarMaxMoves: number;
  threeStarMaxMoves: number;
}
export interface LegacyLevel {
  id: number; name: string; difficulty: 1 | 2 | 3 | 4 | 5;
  moves: number; tubes: Tube[]; tray: Ball[]; hints: string[]; minMoves: number; unlocks: number;
  lockedTubes?: number[]; unlockAfterCompletions?: number;
  rules?: Partial<LevelRules>; rewards?: Partial<RewardConfig>; stars?: Partial<StarConfig>;
}
/** Concrete campaign format, generated and validated before shipping. */
export interface LevelConfig extends LevelMetadata {
  id: number; name?: string; difficulty: LegacyLevel['difficulty'] | Difficulty;
  bottles: { id: string; target: number; durability?: number; type: BottleType; unlockAfter?: string; damageOnOverload?: boolean }[];
  weights: { id: string; value: number; color: BallColor; type: BallType }[];
  rules: Pick<LevelRules, 'allowUndo' | 'allowHint'> & Partial<LevelRules>; rewards: RewardConfig; stars: StarConfig;
  unlocks?: number; lockedTubes?: number[]; unlockAfterCompletions?: number;
}
export interface Level extends Omit<LegacyLevel, 'rules' | 'rewards' | 'stars'>, LevelMetadata {
  category: Difficulty;
  signature: string;
  rules: LevelRules; rewards: RewardConfig; stars: StarConfig;
}
export type ImpactIntensity = 'light' | 'medium' | 'heavy' | 'severe';
export type DamageStage = 'pristine' | 'hairline' | 'cracked' | 'critical' | 'broken';
export interface BottleImpactEvent {
  tubeIndex: number; intensity: ImpactIntensity; damage: number;
  durability: number; maxDurability: number; at: number;
  outcome: 'placed' | 'rejected'; overloadAmount?: number;
}
export interface BottleBreakEvent { tubeIndex: number; at: number }
export type FailureReason = 'broken';
export interface InvalidPlacementEvent { tubeIndex: number; at: number }
export interface FloatingPointEvent { id: string; amount: number; label: string; tubeIndex: number }
export interface HintMove { ballId: string; tubeIndex: number }
export interface RewardBreakdown { baseCoins: number; perfectFitCoins: number; comboBonus: number; threeStarBonus: number; total: number }
export interface DropEvent {
  ballId: string | null; tubeIndex: number | null; at: number;
  outcome: 'placed' | 'perfectFit' | 'overload' | 'invalid';
  nextWeight: number | null;
}
/** Saved before successful placements. Assistance usage stays outside Undo history. */
export interface MoveSnapshot {
  tubes: BottleState[]; tray: Ball[]; moves: number; mistakes: number; combo: number; maxCombo: number;
  perfectFits: number; coinsEarned: number; score: number;
  comboRewardEvents: { milestone: number; coins: number }[];
}
export interface PlacementRecord { ball: Ball; tubeIndex: number; before: MoveSnapshot }
export interface PendingLevelReward {
  attemptId: string; levelId: number; rewards: RewardBreakdown; stars: 1 | 2 | 3;
  moves: number; perfectFits: number; score: number;
}
export interface GameState extends MoveSnapshot {
  /** Transient semantic feedback journal; never restored or rewound by Undo. */
  effects: GameplayEffect[];
  effectSequence: number;
  attemptId: string;
  levelSignature: string;
  isReplay: boolean;
  pendingLevelReward: PendingLevelReward | null;
  freeHintsRemaining: number; freeUndosRemaining: number; shuffleUsed: number;
  level: number;
  status: 'playing' | 'won' | 'lost';
  lossReason: FailureReason | null;
  selectedBall: string | null;
  history: PlacementRecord[];
  undoUsed: number; hintUsed: number; revivesUsed: number;
  currentEvent: DropEvent | null;
  hintMove: HintMove | null;
  reviveSnapshot: MoveSnapshot | null;
  earnedStars: 0 | 1 | 2 | 3;
  rewards: RewardBreakdown | null;
  invalidPlacement: InvalidPlacementEvent | null;
  floatingPoints: FloatingPointEvent[];
  lastImpact: BottleImpactEvent | null;
  lastBreak: BottleBreakEvent | null;
}
export type GameplayEffectType = 'BALL_PICKUP' | 'DROP_SUCCESS' | 'DROP_INVALID' | 'PERFECT_FIT' | 'COMBO_CHANGED'
  | 'BOTTLE_CRACKED' | 'BOTTLE_BROKEN' | 'BOTTLE_UNLOCKED' | 'BOTTLE_STRESS_CHANGED' | 'LEVEL_COMPLETED' | 'LEVEL_FAILED'
  | 'UNDO' | 'HINT' | 'SHUFFLE' | 'REVIVE';
export interface GameplayEffect {
  id: string; sequence: number; type: GameplayEffectType; at: number;
  bottleIndex?: number; weightId?: string; combo?: number; tier?: number;
  reason?: string; stress?: 'safe' | 'warning' | 'danger' | 'overload';
  /** The bottle's cumulative mistake count at the moment of a BOTTLE_CRACKED/BOTTLE_BROKEN effect. */
  damage?: number;
}
export interface LevelProgress {
  levelId: number; bestStars: 0 | 1 | 2 | 3; bestMoves: number | null;
  completed: boolean; bestPerfectFits: number; bestScore: number;
}
export type TransactionReason = 'level_reward' | 'hint' | 'undo' | 'shuffle' | 'revive' | 'debug' | 'cosmetic_purchase';
export interface CoinTransaction {
  id: string; reason: TransactionReason; amount: number; balanceBefore: number; balanceAfter: number; at: number;
}
export interface PlayerProgress {
  ownedCosmetics: string[];
  equipped: { bottleSkinId: string; weightSkinId: string; backgroundId: string };
  highestUnlockedLevel: number;
  transactions: Record<string, CoinTransaction>;
  unlockedLevels: number[]; levelProgress: Record<number, LevelProgress>; bestScore: number;
  levelsCompleted: number; totalPlaytimeSeconds: number; coins: number;
}
export interface GameSettings {
  reducedMotion?: boolean;
  soundEnabled: boolean; musicEnabled: boolean; hapticsEnabled: boolean; highContrast: boolean; volume: number;
  animationSpeed: 'slow' | 'normal' | 'fast';
}
