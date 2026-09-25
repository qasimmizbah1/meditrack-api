import db from '../database/db.js';

export class FacilityRepository {
  static async findAll({ search, status, city, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT f.*,
             (SELECT COUNT(*) FROM users u WHERE u.facility_id = f.id) as staff_count
      FROM facilities f
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND f.status = ?`;
      params.push(status);
    }
    if (city) {
      sql += ` AND LOWER(f.city) = LOWER(?)`;
      params.push(city);
    }
    if (search) {
      sql += ` AND (f.name LIKE ? OR f.code LIKE ? OR f.city LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY f.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ search, status, city } = {}) {
    let sql = `SELECT COUNT(*) as total FROM facilities f WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND f.status = ?`;
      params.push(status);
    }
    if (city) {
      sql += ` AND LOWER(f.city) = LOWER(?)`;
      params.push(city);
    }
    if (search) {
      sql += ` AND (f.name LIKE ? OR f.code LIKE ? OR f.city LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT f.*,
              (SELECT COUNT(*) FROM users u WHERE u.facility_id = f.id) as staff_count
       FROM facilities f 
       WHERE f.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByCode(code) {
    const { rows } = await db.query(
      `SELECT * FROM facilities WHERE UPPER(code) = UPPER(?) LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  }

  static async create({ id, name, code, type, address, city, state, contact_name, contact_email, contact_phone, total_beds, status }) {
    await db.query(
      `INSERT INTO facilities (id, name, code, type, address, city, state, contact_name, contact_email, contact_phone, total_beds, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, code, type, address, city, state, contact_name, contact_email, contact_phone, total_beds, status]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE facilities SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async delete(id) {
    const { rowCount } = await db.query(`DELETE FROM facilities WHERE id = ?`, [id]);
    return rowCount > 0;
  }
}
