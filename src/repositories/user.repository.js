import db from '../database/db.js';

export class UserRepository {
  static async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(u.email) = LOWER(?) LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, u.facility_id, u.phone, u.status, u.created_at, u.updated_at,
              r.name as role_name
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findAll({ role, status, search, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.role_id, u.facility_id, u.phone, u.status, u.created_at, u.updated_at,
             r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      sql += ` AND u.role = ?`;
      params.push(role);
    }
    if (status) {
      sql += ` AND u.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ role, status, search } = {}) {
    let sql = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
    const params = [];

    if (role) {
      sql += ` AND u.role = ?`;
      params.push(role);
    }
    if (status) {
      sql += ` AND u.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async create({ id, name, email, passwordHash, role, roleId, phone, facilityId, status = 'active' }) {
    await db.query(
      `INSERT INTO users (id, name, email, password_hash, role, role_id, phone, facility_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, passwordHash, role, roleId, phone, facilityId, status]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE users SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async delete(id) {
    const { rowCount } = await db.query(`DELETE FROM users WHERE id = ?`, [id]);
    return rowCount > 0;
  }
}
