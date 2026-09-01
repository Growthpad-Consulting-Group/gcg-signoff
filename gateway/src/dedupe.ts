/**
 * Message-ID-based dedup guard. Real-world testing (see gateway/README.md) showed Google's
 * Outbound Gateway resubmitting the exact same message many times in quick succession — even
 * after our gateway responded 250 OK every single time, and even after cutting per-message
 * latency with connection pooling made no difference to the retry cadence. That rules out a
 * timeout/latency explanation; the more likely one is Google's side doing redundant parallel
 * delivery attempts (common in large distributed MTA fleets) and expecting the receiving
 * gateway to deduplicate by Message-ID, same as any enterprise mail relay would.
 *
 * A short in-memory TTL cache is sufficient here — this only needs to catch resubmissions that
 * arrive within roughly the same delivery window (observed: seconds to low minutes apart), not
 * provide exactly-once delivery across gateway restarts.
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes — comfortably longer than any resubmission burst observed
const seen = new Map<string, number>();

function purgeExpired(now: number) {
  for (const [id, seenAt] of seen) {
    if (now - seenAt > TTL_MS) seen.delete(id);
  }
}

/** Returns true (and records it) the first time a Message-ID is seen; false on any repeat
 * within the TTL window. A missing/empty messageId is never deduped — always processed. */
export function isFirstDelivery(messageId: string | undefined): boolean {
  if (!messageId) return true;
  const now = Date.now();
  purgeExpired(now);
  if (seen.has(messageId)) return false;
  seen.set(messageId, now);
  return true;
}
