import type { GameState, GameplayEffect } from '../types/game';
import type { GameAction, Transition } from './gameplay';
import { evaluateDrop, isBottleLocked } from '../utils/physics';
import { getBottleStress, getComboFeedback } from './bottleFeedback';

type Payload = Omit<GameplayEffect, 'id' | 'at' | 'sequence'>;
/** Feedback observes a completed domain transition. It never changes rewards or rules. */
export function emitGameplayEffects(before: GameState, result: Transition, action: GameAction, at: number): Transition {
  if (before === result.state) return result;
  const next = result.state, emitted: Payload[] = [];
  const add = (type: GameplayEffect['type'], fields: Omit<Payload,'type'> = {}) => emitted.push({ type, ...fields });
  if (action.type === 'select' && next.selectedBall && next.selectedBall !== before.selectedBall) add('BALL_PICKUP', { weightId: next.selectedBall });
  if (action.type === 'drop' || action.type === 'invalidDrop') {
    const bottleIndex = action.type === 'drop' ? action.tubeIndex : undefined;
    const ball = before.tray.find(b => b.id === before.selectedBall);
    const fields = { bottleIndex, weightId: ball?.id };
    if (result.accepted && action.type === 'drop') {
      add('DROP_SUCCESS', fields);
      if (next.perfectFits > before.perfectFits) add('PERFECT_FIT', fields);
      for (let i = 0; i < next.tubes.length; i++) {
        if (isBottleLocked(before.tubes[i], before.tubes) && !isBottleLocked(next.tubes[i], next.tubes)) add('BOTTLE_UNLOCKED', { bottleIndex: i });
        const stress = getBottleStress(next.tubes[i]);
        if (stress !== getBottleStress(before.tubes[i])) add('BOTTLE_STRESS_CHANGED', { bottleIndex: i, stress });
      }
    } else if (before.status === 'playing') {
      const reason = bottleIndex !== undefined && ball ? evaluateDrop(before.tubes[bottleIndex], ball.weight, { bottles: before.tubes }).reason ?? 'invalid' : 'invalid';
      add('DROP_INVALID', { ...fields, reason });
      if (bottleIndex !== undefined && next.tubes[bottleIndex]?.damage > before.tubes[bottleIndex]?.damage) {
        add(next.tubes[bottleIndex].isBroken ? 'BOTTLE_BROKEN' : 'BOTTLE_CRACKED', { ...fields, damage: next.tubes[bottleIndex].damage });
      }
    }
  }
  if (next.combo !== before.combo) add('COMBO_CHANGED', { combo: next.combo, tier: getComboFeedback(next.combo)?.tier ?? 0 });
  if (before.status !== 'won' && next.status === 'won') add('LEVEL_COMPLETED');
  if (before.status === 'playing' && next.status === 'lost') add('LEVEL_FAILED');
  if (result.accepted && ['undo','hint','shuffle','revive'].includes(action.type)) add(action.type.toUpperCase() as GameplayEffect['type']);
  if (!emitted.length) return result;
  let sequence = before.effectSequence ?? 0;
  const effects = emitted.map(event => ({ ...event, at, sequence: ++sequence, id: `${before.attemptId}:effect:${sequence}` }));
  return { ...result, state: { ...next, effectSequence: sequence, effects: [...(before.effects ?? []), ...effects].slice(-64) } };
}
