import crypto from 'crypto';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes SHA-256 hash of a string or buffer
 */
export const sha256 = (data) => {
  return crypto.createHash('sha256').update(String(data)).digest('hex');
};

/**
 * Computes the hash for an audit status event in the chain:
 * current_hash = SHA256(previous_hash + status + actor_id + timestamp)
 */
export const computeEventHash = ({ previousHash, status, actorId, timestamp }) => {
  const prev = previousHash || GENESIS_HASH;
  const isoTime = new Date(timestamp).toISOString();
  const payload = `${prev}:${status}:${actorId}:${isoTime}`;
  return sha256(payload);
};

/**
 * Validates the cryptographic integrity of a status event chain
 * @param {Array} events - Chronological array of status events
 * @returns {{ isValid: boolean, error?: string, verifiedCount: number }}
 */
export const verifyEventChainIntegrity = (events) => {
  if (!events || events.length === 0) {
    return { isValid: true, verifiedCount: 0 };
  }

  let expectedPreviousHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Check 1: Previous hash must match the expected previous hash
    if (event.previous_hash !== expectedPreviousHash) {
      return {
        isValid: false,
        error: `Broken link at event #${i + 1} (${event.id}): previous_hash '${event.previous_hash}' does not match expected '${expectedPreviousHash}'`,
        verifiedCount: i
      };
    }

    // Check 2: Recomputed SHA-256 hash must match current_hash
    const recomputed = computeEventHash({
      previousHash: event.previous_hash,
      status: event.status,
      actorId: event.actor_id,
      timestamp: event.created_at
    });

    if (recomputed !== event.current_hash) {
      return {
        isValid: false,
        error: `Tampered event payload at #${i + 1} (${event.id}): stored hash '${event.current_hash}' != calculated '${recomputed}'`,
        verifiedCount: i
      };
    }

    expectedPreviousHash = event.current_hash;
  }

  return { isValid: true, verifiedCount: events.length };
};
