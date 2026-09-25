import db from '../database/db.js';

export class NotificationRepository {
  static async findByUserId(userId, { isRead, limit = 20, offset = 0 } = {}) {
    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];

    if (isRead !== undefined) {
      sql += ` AND is_read = ?`;
      params.push(isRead ? 1 : 0);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countUnreadByUserId(userId) {
    const { rows } = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return rows[0]?.count || 0;
  }

  static async create({ id, user_id, title, message, type = 'info', link = null }) {
    await db.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, user_id, title, message, type, link]
    );
    const { rows } = await db.query(`SELECT * FROM notifications WHERE id = ?`, [id]);
    return rows[0];
  }

  static async markAsRead(id, userId) {
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    const { rows } = await db.query(`SELECT * FROM notifications WHERE id = ?`, [id]);
    return rows[0];
  }

  static async markAllAsRead(userId) {
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return true;
  }
}
