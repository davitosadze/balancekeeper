import type { BottleState, GameState, Level, MoveSnapshot, Tube } from '../types/game';
import { calculateBottleWeight, evaluateDrop, isBottleSolved, isLevelComplete } from '../utils/physics';
import { calculateRewards, calculateStars } from '../utils/scoring';
import { NORMAL_DURABILITY } from './levelConfig';
import { canAfford } from './economy';
import { getHintMove } from './hints';
import { emitGameplayEffects } from './effects';

/** Rebuild cached fields from contents at the single runtime mutation boundary. */
export function refreshBottle(tube: Tube): BottleState {
  const durability = tube.durability ?? (tube.type === 'fragile' ? 1 : NORMAL_DURABILITY);
  const damage = tube.damage ?? 0;
  return { ...tube, id: tube.id ?? `b${tube.index + 1}`, type: tube.type ?? 'normal',
    balls: tube.balls.map(ball => ({ ...ball })), containedWeightIds: tube.balls.map(ball => ball.id),
    currentWeight: calculateBottleWeight(tube), durability, damage,
    isSolved: isBottleSolved(tube), isBroken: damage >= durability };
}
export function initialGame(level: Level, attemptId = 'test-attempt', isReplay = false): GameState {
  return {
    effects: [], effectSequence: 0,
    attemptId, levelSignature: level.signature, isReplay, pendingLevelReward: null,
    freeHintsRemaining: level.rules.freeHints, freeUndosRemaining: level.rules.freeUndos, shuffleUsed: 0,
    comboRewardEvents: [], level: level.id, tubes: level.tubes.map(refreshBottle), tray: level.tray.map(ball => ({ ...ball })), moves: 0,
    combo: 0, maxCombo: 0, score: 0, perfectFits: 0, coinsEarned: 0, selectedBall: null,
    status: 'playing', lossReason: null, history: [], mistakes: 0, undoUsed: 0, hintUsed: 0,
    revivesUsed: 0, hintMove: null, reviveSnapshot: null, currentEvent: null,
    earnedStars: 0, rewards: null, invalidPlacement: null, floatingPoints: [], lastImpact: null, lastBreak: null,
  };
}
export function snapshot(state: GameState): MoveSnapshot {
  return { tubes: state.tubes.map(refreshBottle), tray: state.tray.map(ball => ({ ...ball })), moves: state.moves,
    mistakes: state.mistakes, combo: state.combo, maxCombo: state.maxCombo, score: state.score,
    perfectFits: state.perfectFits, coinsEarned: state.coinsEarned,
    comboRewardEvents: state.comboRewardEvents.map(event => ({ ...event })) };
}
export type GameAction =
  | { type: 'select'; ballId: string }
  | { type: 'drop'; tubeIndex: number }
  | { type: 'invalidDrop' | 'undo' | 'hint' | 'shuffle' }
  | { type: 'revive'; earnedRewardForAttempt?: string };
export interface Transition { state: GameState; accepted: boolean; cost: number; message?: string }
const clearFeedback = { invalidPlacement: null, floatingPoints: [], lastImpact: null, lastBreak: null,
  hintMove: null, selectedBall: null, currentEvent: null };

/** Pure attempt transitions authorize a cost; the store commits it with the resulting state. */
export function transition(state: GameState, level: Level, action: GameAction, at = 0, coins = 0, random: () => number = Math.random): Transition {
  const result = reduceGameplay(state, level, action, at, coins, random);
  return emitGameplayEffects(state, result, action, at);
}
function reduceGameplay(state: GameState, level: Level, action: GameAction, at: number, coins: number, random: () => number): Transition {
  const unchanged = (message?: string): Transition => ({ state, accepted: false, cost: 0, message });
  const changed = (next: GameState, cost = 0): Transition => ({ state: next, accepted: true, cost });
  if (action.type === 'revive') {
    if (action.earnedRewardForAttempt !== undefined && action.earnedRewardForAttempt !== state.attemptId) return unchanged();
    if (!canRevive(state)) return unchanged('No revive remains for this attempt.');
    const cost = action.earnedRewardForAttempt === undefined ? level.rules.reviveCost : 0;
    if (!canAfford(coins, cost)) return unchanged(`Need ${cost} coins.`);
    const restored = state.reviveSnapshot!;
    return changed({ ...state, ...restored, tubes: restored.tubes.map(refreshBottle), tray: restored.tray.map(ball => ({ ...ball })),
      ...clearFeedback, mistakes: state.mistakes, combo: 0, revivesUsed: state.revivesUsed + 1,
      status: 'playing', lossReason: null, reviveSnapshot: null }, cost);
  }
  if (state.status !== 'playing') return unchanged();
  if (action.type === 'select') {
    if (!state.tray.some(ball => ball.id === action.ballId)) return unchanged();
    return changed({ ...state, selectedBall: state.selectedBall === action.ballId ? null : action.ballId });
  }
  if (action.type === 'invalidDrop') return changed({ ...state, selectedBall: null, combo: 0, hintMove: null,
    currentEvent: { ballId: state.selectedBall, tubeIndex: null, at, outcome: 'invalid', nextWeight: null } });
  if (action.type === 'drop') {
    const ball = state.tray.find(ball => ball.id === state.selectedBall);
    const tube = state.tubes[action.tubeIndex];
    if (!ball) return { accepted: false, cost: 0, state: { ...state, combo: 0, selectedBall: null, hintMove: null,
      currentEvent: { ballId: null, tubeIndex: action.tubeIndex, at, outcome: 'invalid', nextWeight: null } } };
    const result = evaluateDrop(tube, ball.weight, { bottles: state.tubes });
    const currentEvent = { ballId: ball.id, tubeIndex: action.tubeIndex, at, nextWeight: result.nextWeight,
      outcome: (result.accepted ? result.perfectFit ? 'perfectFit' : 'placed' : result.reason === 'overload' ? 'overload' : 'invalid') as NonNullable<GameState['currentEvent']>['outcome'] };
    if (!result.accepted) {
      let next: GameState = { ...state, ...clearFeedback, combo: 0, currentEvent,
        invalidPlacement: tube ? { tubeIndex: action.tubeIndex, at } : null };
      if (result.reason === 'overload') {
        const damaged = refreshBottle({ ...tube, damage: tube.damage + 1 });
        const tubes = state.tubes.map((item, index) => index === action.tubeIndex ? damaged : item);
        next = { ...next, tubes, mistakes: state.mistakes + 1,
          lastImpact: { tubeIndex: action.tubeIndex, at, intensity: damaged.isBroken ? 'heavy' : damaged.damage >= 2 ? 'medium' : 'light',
            damage: 1, durability: Math.max(0, damaged.durability - damaged.damage),
            maxDurability: damaged.durability, outcome: 'rejected', overloadAmount: result.nextWeight - tube.target },
          status: damaged.isBroken ? 'lost' : 'playing', lossReason: damaged.isBroken ? 'broken' : null,
          lastBreak: damaged.isBroken ? { tubeIndex: action.tubeIndex, at } : null,
          // Exact pre-break contents and damage; the failed overload remains a mistake on revive.
          reviveSnapshot: damaged.isBroken ? snapshot(state) : null,
        };
      }
      // Rejections keep the ball in the tray and never create a move or history entry.
      return { state: next, accepted: false, cost: 0 };
    }
    const before = snapshot(state);
    const tubes = state.tubes.map((item, index) => index === action.tubeIndex
      ? refreshBottle({ ...item, balls: [...item.balls, ball] }) : item);
    const combo = state.combo + 1;
    const milestoneCoins = level.rewards.comboMilestones[combo] ?? 0;
    const newMilestone = milestoneCoins > 0 && !state.comboRewardEvents.some(event => event.milestone === combo);
    const comboRewardEvents = newMilestone ? [...state.comboRewardEvents, { milestone: combo, coins: milestoneCoins }] : state.comboRewardEvents;
    const events = result.perfectFit
      ? [{ id: `${at}-fit`, amount: level.rewards.perfectFitCoins, label: 'PERFECT FIT', tubeIndex: action.tubeIndex }]
      : [];
    let next: GameState = { ...state, ...clearFeedback, tubes, tray: state.tray.filter(item => item.id !== ball.id),
      moves: state.moves + 1, combo, maxCombo: Math.max(state.maxCombo, combo), score: state.score + 10,
      perfectFits: state.perfectFits + (result.perfectFit ? 1 : 0),
      coinsEarned: state.coinsEarned + (result.perfectFit ? level.rewards.perfectFitCoins : 0) + (newMilestone ? milestoneCoins : 0),
      comboRewardEvents, currentEvent,
      history: [...state.history, { ball: { ...ball }, tubeIndex: action.tubeIndex, before }],
      floatingPoints: [...state.floatingPoints, ...events],
    };
    if (isLevelComplete(tubes)) {
      next = { ...next, status: 'won' };
      const earnedStars = calculateStars(next, level.stars);
      const rewards = calculateRewards(next, level, earnedStars);
      next = { ...next, earnedStars, rewards, coinsEarned: rewards.total,
        pendingLevelReward: { attemptId: state.attemptId, levelId: level.id, rewards, stars: earnedStars as 1 | 2 | 3,
          moves: next.moves, perfectFits: next.perfectFits, score: next.score } };
    }
    return changed(next);
  }
  if (action.type === 'undo') {
    if (!level.rules.allowUndo || !state.history.length) return unchanged('No move to undo.');
    const cost = utilityCost(state, level, 'undo');
    if (!canAfford(coins, cost)) return unchanged(`Need ${cost} coins.`);
    const previous = state.history[state.history.length - 1].before;
    return changed({ ...state, ...previous, tubes: previous.tubes.map(refreshBottle), tray: previous.tray.map(ball => ({ ...ball })),
      ...clearFeedback, combo: 0, history: state.history.slice(0, -1), undoUsed: state.undoUsed + 1, freeUndosRemaining: Math.max(0, state.freeUndosRemaining - 1) }, cost);
  }
  if (action.type === 'hint') {
    if (!level.rules.allowHint) return unchanged('Hints are unavailable in this level.');
    const hintMove = getHintMove(state, level);
    if (!hintMove) return { accepted: false, cost: 0, message: 'No safe move found. Try Undo or restart.',
      state: { ...state, combo: 0, hintMove: null, selectedBall: null } };
    const cost = utilityCost(state, level, 'hint');
    if (!canAfford(coins, cost)) return unchanged(`Need ${cost} coins.`);
    return changed({ ...state, ...clearFeedback, combo: 0, hintUsed: state.hintUsed + 1, hintMove,
      freeHintsRemaining: Math.max(0, state.freeHintsRemaining - 1) }, cost);
  }
  if (!level.rules.allowShuffle || state.tray.length < 2) return unchanged('Not enough weights to shuffle.');
  const cost = level.rules.shuffleCost;
  if (!canAfford(coins, cost)) return unchanged(`Need ${cost} coins.`);
  const tray = [...state.tray];
  for (let i = tray.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [tray[i], tray[j]] = [tray[j], tray[i]];
  }
  if (tray.every((ball, index) => ball.id === state.tray[index].id)) [tray[0], tray[1]] = [tray[1], tray[0]];
  return changed({ ...state, tray, selectedBall: null, hintMove: null, shuffleUsed: state.shuffleUsed + 1 }, cost);
}

export function canRevive(state: GameState): boolean {
  return state.status === 'lost' && state.lossReason === 'broken' && state.reviveSnapshot != null && state.revivesUsed < 1;
}
export function utilityCost(state: GameState, level: Level, action: 'undo' | 'hint' | 'shuffle' | 'revive'): number {
  if (action === 'undo') return state.freeUndosRemaining > 0 ? 0 : level.rules.undoCost;
  if (action === 'hint') return state.freeHintsRemaining > 0 ? 0 : level.rules.hintCost;
  return action === 'shuffle' ? level.rules.shuffleCost : level.rules.reviveCost;
}
export function gameplayActions(state: GameState, level: Level, coins = 0) {
  const playing = state.status === 'playing';
  const undoCost = utilityCost(state, level, 'undo'), hintCost = utilityCost(state, level, 'hint');
  return {
    undo: { enabled: playing && level.rules.allowUndo && state.history.length > 0 && canAfford(coins, undoCost),
      freeUses: state.freeUndosRemaining, cost: undoCost },
    hint: { enabled: playing && level.rules.allowHint && canAfford(coins, hintCost) && state.tray.length > 0 && state.tubes.every(tube => tube.currentWeight <= tube.target) && state.tubes.some(tube => tube.currentWeight < tube.target),
      freeUses: state.freeHintsRemaining, cost: hintCost },
    shuffle: { enabled: playing && level.rules.allowShuffle && state.tray.length > 1 && canAfford(coins, level.rules.shuffleCost),
      freeUses: 0, cost: level.rules.shuffleCost },
  };
}
