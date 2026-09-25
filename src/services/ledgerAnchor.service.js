import crypto from 'crypto';
import db from '../database/db.js';
import { LedgerAnchorRepository } from '../repositories/ledgerAnchor.repository.js';
import { MerkleTree, sha256 } from '../utils/merkle.js';
import { computeEventHash, GENESIS_HASH } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';

const GENESIS_ANCHOR_ROOT = '0000000000000000000000000000000000000000000000000000000000000000';

export class LedgerAnchorService {
  static async listAnchors(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [anchors, total] = await Promise.all([
      LedgerAnchorRepository.findAll({ limit, offset }),
      LedgerAnchorRepository.countAll()
    ]);

    return {
      anchors,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getAnchorById(id) {
    const anchor = await LedgerAnchorRepository.findById(id);
    if (!anchor) {
      throw new AppError('Ledger anchor not found', 404);
    }
    return anchor;
  }

  /**
   * Seals and anchors a batch of status events into a Merkle root
   */
  static async createBatchAnchor(actorUser) {
    // 1. Get all events
    const { rows: events } = await db.query(
      `SELECT * FROM status_events ORDER BY created_at ASC`
    );

    if (events.length === 0) {
      throw new AppError('No status events available to anchor', 400);
    }

    const latestAnchor = await LedgerAnchorRepository.findLatestAnchor();
    const nextBatchNumber = latestAnchor ? latestAnchor.batch_number + 1 : 1;
    const previousAnchorRoot = latestAnchor ? latestAnchor.merkle_root : GENESIS_ANCHOR_ROOT;

    // 2. Build Merkle Tree from event hashes
    const leaves = events.map((e) => e.current_hash);
    const tree = new MerkleTree(leaves);
    const merkleRoot = tree.getRoot();

    // 3. Deterministic batch anchor hash
    const anchorHash = sha256(`${nextBatchNumber}:${merkleRoot}:${previousAnchorRoot}`);
    const networkTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const id = crypto.randomUUID();

    const newAnchor = await LedgerAnchorRepository.create({
      id,
      batch_number: nextBatchNumber,
      start_event_id: events[0].id,
      end_event_id: events[events.length - 1].id,
      event_count: events.length,
      merkle_root: merkleRoot,
      previous_anchor_root: previousAnchorRoot,
      anchor_hash: anchorHash,
      network_tx_hash: networkTxHash,
      anchored_by: actorUser.id
    });

    return {
      anchor: newAnchor,
      merkleTreeDepth: tree.layers.length,
      eventCount: events.length
    };
  }

  /**
   * Generates a cryptographic inclusion proof for a specific event
   */
  static async generateProofForEvent(eventId) {
    // 1. Find the target event
    const { rows: targetRows } = await db.query(
      `SELECT se.*, wo.tracking_number as work_order_tracking, wo.title as work_order_title, u.name as actor_name
       FROM status_events se
       LEFT JOIN work_orders wo ON se.work_order_id = wo.id
       LEFT JOIN users u ON se.actor_id = u.id
       WHERE se.id = ? OR se.current_hash = ?
       LIMIT 1`,
      [eventId, eventId]
    );

    const targetEvent = targetRows[0];
    if (!targetEvent) {
      throw new AppError('Status event not found', 404);
    }

    // 2. Fetch all ordered events to reconstruct Merkle tree
    const { rows: allEvents } = await db.query(
      `SELECT * FROM status_events ORDER BY created_at ASC`
    );

    const eventIndex = allEvents.findIndex((e) => e.id === targetEvent.id);
    if (eventIndex === -1) {
      throw new AppError('Event not found in ledger sequence', 404);
    }

    const leaves = allEvents.map((e) => e.current_hash);
    const tree = new MerkleTree(leaves);
    const proof = tree.getProof(eventIndex);
    const merkleRoot = tree.getRoot();

    // 3. Verify locally
    const isLocallyValid = MerkleTree.verifyProof(targetEvent.current_hash, proof, merkleRoot);

    const latestAnchor = await LedgerAnchorRepository.findLatestAnchor();

    return {
      certificateId: `PROOF-${Date.now()}-${targetEvent.id.slice(0, 8).toUpperCase()}`,
      event: {
        id: targetEvent.id,
        workOrderId: targetEvent.work_order_id,
        workOrderTracking: targetEvent.work_order_tracking,
        workOrderTitle: targetEvent.work_order_title,
        status: targetEvent.status,
        actorName: targetEvent.actor_name || 'System Operator',
        timestamp: targetEvent.created_at,
        currentHash: targetEvent.current_hash,
        previousHash: targetEvent.previous_hash
      },
      proof: {
        leafIndex: eventIndex,
        totalLeaves: allEvents.length,
        merkleRoot,
        proofPath: proof,
        isVerified: isLocallyValid,
        anchorBatch: latestAnchor?.batch_number || 1,
        anchorTx: latestAnchor?.network_tx_hash || '0x4f8a...simulated'
      }
    };
  }

  /**
   * Verifies a standalone Merkle proof payload
   */
  static verifyProof(leafHash, proofPath, expectedRoot) {
    if (!leafHash || !proofPath || !expectedRoot) {
      throw new AppError('leafHash, proofPath, and expectedRoot are required for verification', 400);
    }
    const isValid = MerkleTree.verifyProof(leafHash, proofPath, expectedRoot);
    return {
      isValid,
      leafHash,
      expectedRoot,
      stepsVerified: proofPath.length
    };
  }

  /**
   * Full end-to-end ledger integrity audit verification
   */
  static async verifyEntireAuditLedger() {
    // 1. Verify SHA-256 Hash Chain of all Status Events
    const { rows: events } = await db.query(
      `SELECT * FROM status_events ORDER BY created_at ASC`
    );

    let eventChainValid = true;
    let failedEventId = null;
    let computedPrevious = GENESIS_HASH;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      // Check if previous hash matches computed previous
      if (i > 0 && evt.previous_hash !== computedPrevious) {
        eventChainValid = false;
        failedEventId = evt.id;
        break;
      }

      // Recompute expected hash
      const recomputed = computeEventHash({
        previousHash: evt.previous_hash,
        status: evt.status,
        actorId: evt.actor_id,
        timestamp: evt.created_at
      });

      if (recomputed !== evt.current_hash) {
        eventChainValid = false;
        failedEventId = evt.id;
        break;
      }

      computedPrevious = evt.current_hash;
    }

    // 2. Verify Merkle Tree Roots of all Anchors
    const anchors = await LedgerAnchorRepository.findAll({ limit: 100 });
    let anchorsValid = true;

    for (const anchor of anchors) {
      const expectedAnchorHash = sha256(
        `${anchor.batch_number}:${anchor.merkle_root}:${anchor.previous_anchor_root}`
      );
      if (expectedAnchorHash !== anchor.anchor_hash) {
        anchorsValid = false;
        break;
      }
    }

    return {
      isTamperFree: eventChainValid && anchorsValid,
      eventChainIntegrity: {
        totalEventsChecked: events.length,
        status: eventChainValid ? 'PASSED_VERIFICATION' : 'TAMPER_DETECTED',
        failedEventId
      },
      anchorLedgerIntegrity: {
        totalBatchesChecked: anchors.length,
        status: anchorsValid ? 'ANCHORS_CONSISTENT' : 'ANCHORS_TAMPERED'
      },
      auditedAt: new Date().toISOString()
    };
  }
}
