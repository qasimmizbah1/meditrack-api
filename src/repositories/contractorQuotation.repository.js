import db from '../database/db.js';
import crypto from 'crypto';

export class ContractorQuotationRepository {
  static async findByWorkOrderId(workOrderId) {
    const sql = `
      SELECT cq.*, u.name as contractor_name, u.email as contractor_email
      FROM contractor_quotations cq
      LEFT JOIN users u ON cq.contractor_id = u.id
      WHERE cq.work_order_id = ?
      ORDER BY cq.created_at ASC
    `;
    const { rows } = await db.query(sql, [workOrderId]);
    return rows;
  }

  static async findById(id) {
    const sql = `
      SELECT cq.*, u.name as contractor_name, u.email as contractor_email
      FROM contractor_quotations cq
      LEFT JOIN users u ON cq.contractor_id = u.id
      WHERE cq.id = ?
    `;
    const { rows } = await db.query(sql, [id]);
    return rows[0] || null;
  }

  static async create({ work_order_id, contractor_id, contractor_name, quote_ref, amount, breakdown, notes }) {
    const id = `cq_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO contractor_quotations (
        id, work_order_id, contractor_id, contractor_name, quote_ref, amount, breakdown, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    `;
    await db.query(sql, [
      id,
      work_order_id,
      contractor_id,
      contractor_name || null,
      quote_ref || null,
      Number(amount) || 0,
      breakdown ? JSON.stringify(breakdown) : null,
      notes || null,
      now,
      now
    ]);
    return this.findById(id);
  }

  static async updateStatus(id, status) {
    const now = new Date().toISOString();
    await db.query(`UPDATE contractor_quotations SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
    return this.findById(id);
  }

  static async updateAllStatusForWorkOrderExcept(workOrderId, exceptQuoteId, status) {
    const now = new Date().toISOString();
    await db.query(
      `UPDATE contractor_quotations SET status = ?, updated_at = ? WHERE work_order_id = ? AND id != ?`,
      [status, now, workOrderId, exceptQuoteId]
    );
  }
}
