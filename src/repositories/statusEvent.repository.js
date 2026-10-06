import crypto from 'crypto';
import db from '../database/db.js';
import { computeEventHash, GENESIS_HASH } from '../utils/crypto.js';

export { GENESIS_HASH };

export class StatusEventRepository {
  static async getLatestEventByWorkOrderId(workOrderId) {
    const { rows } = await db.query(
      `SELECT * FROM status_events 
       WHERE work_order_id = ? 
       ORDER BY created_at DESC, rowid DESC 
       LIMIT 1`,
      [workOrderId]
    );
    return rows[0] || null;
  }

  static async getLastEvent(workOrderId) {
    return this.getLatestEventByWorkOrderId(workOrderId);
  }

  static async getEventsByWorkOrderId(workOrderId) {
    const { rows } = await db.query(
      `SELECT se.*,
              u.name as actor_name,
              u.email as actor_email,
              u.role as actor_role
       FROM status_events se
       LEFT JOIN users u ON se.actor_id = u.id
       WHERE se.work_order_id = ?
       ORDER BY se.created_at ASC, se.rowid ASC`,
      [workOrderId]
    );
    return rows;
  }

  static async recordEvent({
    workOrderId,
    status,
    actorId,
    notes = null,
    metadata = null,
    createdAt = null
  }) {
    const lastEvent = await this.getLatestEventByWorkOrderId(workOrderId);
    const previousHash = lastEvent ? lastEvent.current_hash : GENESIS_HASH;
    const timestamp = createdAt || new Date().toISOString();
    const currentHash = computeEventHash({
      previousHash,
      status,
      actorId: actorId || 'system',
      timestamp
    });

    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;

    await this.create({
      id: eventId,
      work_order_id: workOrderId,
      status,
      actor_id: actorId || 'system',
      previous_hash: previousHash,
      current_hash: currentHash,
      notes,
      metadata,
      created_at: timestamp
    });

    return {
      id: eventId,
      work_order_id: workOrderId,
      status,
      actor_id: actorId,
      previous_hash: previousHash,
      current_hash: currentHash,
      notes,
      metadata,
      created_at: timestamp
    };
  }

  static async create({
    id,
    work_order_id,
    status,
    actor_id,
    previous_hash,
    current_hash,
    notes = null,
    metadata = null,
    created_at = null
  }) {
    if (created_at) {
      await db.query(
        `INSERT INTO status_events (id, work_order_id, status, actor_id, previous_hash, current_hash, notes, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, work_order_id, status, actor_id, previous_hash, current_hash, notes, metadata, created_at]
      );
    } else {
      await db.query(
        `INSERT INTO status_events (id, work_order_id, status, actor_id, previous_hash, current_hash, notes, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, work_order_id, status, actor_id, previous_hash, current_hash, notes, metadata]
      );
    }

    const { rows } = await db.query(`SELECT * FROM status_events WHERE id = ?`, [id]);
    return rows[0];
  }
}

