import {toRaw} from 'vue';
import {ViewModel} from '@/common/models/PlayerModel';

/** Keep unchanged JSON branches stable so an opponent's move doesn't rerender every card. */
function share(previous: unknown, next: unknown): unknown {
  if (previous === next) return previous;
  if (previous === null || next === null || typeof previous !== 'object' || typeof next !== 'object') return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  const before = toRaw(previous) as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  let equal = Object.keys(before).length === keys.length;
  for (const key of keys) {
    after[key] = share(before[key], after[key]);
    if (!Object.hasOwn(before, key) || after[key] !== before[key]) equal = false;
  }
  if (Array.isArray(next) && Array.isArray(previous) && next.length !== previous.length) equal = false;
  return equal ? previous : next;
}

export function reuseGameView<T extends ViewModel>(previous: T | undefined, next: T): T {
  if (!previous || previous.id !== next.id || previous.runId !== next.runId) return next;
  const before = toRaw(previous);
  for (const key of Object.keys(next) as Array<keyof T>) {
    // Every new decision must reset its form, even when it resembles the previous question.
    if (key !== 'waitingFor') next[key] = share(before[key], next[key]) as T[keyof T];
  }
  return next;
}
