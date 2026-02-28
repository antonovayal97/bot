/** Простой in-memory стейт для ожидания ввода (без сессий) */
type WaitingState = 'topup_amount';

const pending: Map<string, { state: WaitingState; since: number }> = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 минут

function cleanup() {
  const now = Date.now();
  for (const [k, v] of pending.entries()) {
    if (now - v.since > TTL_MS) pending.delete(k);
  }
}

export function setWaiting(telegramId: string, state: WaitingState): void {
  pending.set(telegramId, { state, since: Date.now() });
  if (pending.size > 1000) cleanup();
}

export function getAndClearWaiting(telegramId: string): WaitingState | null {
  const v = pending.get(telegramId);
  pending.delete(telegramId);
  return v?.state ?? null;
}

export function hasWaiting(telegramId: string): boolean {
  return pending.has(telegramId);
}
