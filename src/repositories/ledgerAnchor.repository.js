import db from '../database/db.js';

export class LedgerAnchorRepository {
  static async findLatestAnchor() {
    const { rows } = await db.query(
      `SELECT * FROM ledger_anchors ORDER BY batch_number DESC LIMIT 1`
    );
    return rows[0] || null;
  }

  static async findAll({ limit = 50, offset = 0 } = {}) {
    const { rows } = await db.query(
      `SELECT la.*, u.name as anchored_by_name, u.email as anchored_by_email
       FROM ledger_anchors la
       LEFT JOIN users u ON la.anchored_by = u.id
       ORDER BY la.batch_number DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    );
    return rows;
  }

  static async countAll() {
    const { rows } = await db.query(`SELECT COUNT(*) as total FROM ledger_anchors`);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT la.*, u.name as anchored_by_name, u.email as anchored_by_email
       FROM ledger_anchors la
       LEFT JOIN users u ON la.anchored_by = u.id
       WHERE la.id = ? OR la.merkle_root = ?
       LIMIT 1`,
      [id, id]
    );
    return rows[0] || null;
  }

  static async create({
    id,
    batch_number,
    start_event_id,
    end_event_id,
    event_count,
    merkle_root,
    previous_anchor_root,
    anchor_hash,
    network_tx_hash,
    anchored_by
  }) {
    await db.query(
      `INSERT INTO ledger_anchors (id, batch_number, start_event_id, end_event_id, event_count, merkle_root, previous_anchor_root, anchor_hash, network_tx_hash, anchored_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        batch_number,
        start_event_id,
        end_event_id,
        event_count,
        merkle_root,
        previous_anchor_root,
        anchor_hash,
        network_tx_hash,
        anchored_by
      ]
    );
    return this.findById(id);
  }
}
