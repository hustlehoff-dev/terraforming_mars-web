/*
 * Remembers a choice the player is making (cards ticked, corporation picked...) in this browser,
 * so a page reload does not lose it. A choice is stored under the player and a fingerprint of the
 * question (its title and cards), so it only comes back for the same question.
 */
const PREFIX = 'tm-choice:';
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

function playerKey(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get('id') ?? undefined;
  } catch {
    return undefined;
  }
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return (h >>> 0).toString(36);
}

function storageKey(question: string): string | undefined {
  const player = playerKey();
  return player === undefined ? undefined : `${PREFIX}${player}:${hash(question)}`;
}

/** The remembered answer for this question, if any. */
export function recallChoice<T>(question: string): T | undefined {
  const key = storageKey(question);
  if (key === undefined) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return undefined;
    }
    const stored = JSON.parse(raw) as {t: number, v: T};
    return Date.now() - stored.t < MAX_AGE_MS ? stored.v : undefined;
  } catch {
    return undefined;
  }
}

export function rememberChoice(question: string, value: unknown): void {
  const key = storageKey(question);
  if (key === undefined) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify({t: Date.now(), v: value}));
  } catch {
    // Storage full or blocked: the choice is simply not remembered.
  }
}

/** Removes remembered choices older than two days. */
function purgeOld(): void {
  try {
    const storage = window.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) {
        try {
          const stored = JSON.parse(storage.getItem(key) ?? '{}') as {t?: number};
          if (stored.t === undefined || Date.now() - stored.t > MAX_AGE_MS) {
            storage.removeItem(key);
          }
        } catch {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // No storage: nothing to clean.
  }
}

purgeOld();
