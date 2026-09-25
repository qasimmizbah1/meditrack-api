import db from '../database/db.js';

export class InspectionRepository {
  static async findAll({ result, inspectorId, facilityId, search, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT i.*,
             wo.tracking_number as work_order_tracking,
             wo.title as work_order_title,
             wo.status as work_order_status,
             f.name as facility_name,
             f.code as facility_code,
             u.name as inspector_name,
             u.email as inspector_email,
             (SELECT COUNT(*) FROM inspection_photos ip WHERE ip.inspection_id = i.id) as photo_count
      FROM inspections i
      LEFT JOIN work_orders wo ON i.work_order_id = wo.id
      LEFT JOIN facilities f ON wo.facility_id = f.id
      LEFT JOIN users u ON i.inspector_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (result) {
      sql += ` AND i.result = ?`;
      params.push(result);
    }
    if (inspectorId) {
      sql += ` AND i.inspector_id = ?`;
      params.push(inspectorId);
    }
    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (search) {
      sql += ` AND (wo.tracking_number LIKE ? OR wo.title LIKE ? OR i.observations LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY i.inspected_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ result, inspectorId, facilityId, search } = {}) {
    let sql = `
      SELECT COUNT(*) as total
      FROM inspections i
      LEFT JOIN work_orders wo ON i.work_order_id = wo.id
      WHERE 1=1
    `;
    const params = [];

    if (result) {
      sql += ` AND i.result = ?`;
      params.push(result);
    }
    if (inspectorId) {
      sql += ` AND i.inspector_id = ?`;
      params.push(inspectorId);
    }
    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (search) {
      sql += ` AND (wo.tracking_number LIKE ? OR wo.title LIKE ? OR i.observations LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT i.*,
              wo.tracking_number as work_order_tracking,
              wo.title as work_order_title,
              wo.status as work_order_status,
              f.name as facility_name,
              f.code as facility_code,
              u.name as inspector_name,
              u.email as inspector_email
       FROM inspections i
       LEFT JOIN work_orders wo ON i.work_order_id = wo.id
       LEFT JOIN facilities f ON wo.facility_id = f.id
       LEFT JOIN users u ON i.inspector_id = u.id
       WHERE i.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByWorkOrderId(workOrderId) {
    const { rows } = await db.query(
      `SELECT i.*,
              u.name as inspector_name
       FROM inspections i
       LEFT JOIN users u ON i.inspector_id = u.id
       WHERE i.work_order_id = ?
       ORDER BY i.inspected_at DESC`,
      [workOrderId]
    );
    return rows;
  }

  static async create({ id, work_order_id, inspector_id, result, checklist_results, observations, recommendations }) {
    await db.query(
      `INSERT INTO inspections (id, work_order_id, inspector_id, result, checklist_results, observations, recommendations)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, work_order_id, inspector_id, result, checklist_results, observations, recommendations]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE inspections SET ${setClauses} WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async addPhoto({ id, inspection_id, photo_url, caption }) {
    await db.query(
      `INSERT INTO inspection_photos (id, inspection_id, photo_url, caption)
       VALUES (?, ?, ?, ?)`,
      [id, inspection_id, photo_url, caption]
    );
    const { rows } = await db.query(`SELECT * FROM inspection_photos WHERE id = ?`, [id]);
    return rows[0];
  }

  static async getPhotos(inspectionId) {
    const { rows } = await db.query(
      `SELECT * FROM inspection_photos WHERE inspection_id = ? ORDER BY created_at ASC`,
      [inspectionId]
    );
    return rows;
  }
}
