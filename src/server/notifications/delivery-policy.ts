const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

export function notificationRetryDelayMs(attempt: number) {
  const safeAttempt = Math.max(1, Math.min(16, Math.trunc(attempt)));
  return Math.min(MAX_RETRY_DELAY_MS, 60_000 * (2 ** (safeAttempt - 1)));
}
