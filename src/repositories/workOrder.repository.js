import db from '../database/db.js';

export class WorkOrderRepository {
  static async generateNextTrackingNumber() {
    const year = new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE tracking_number LIKE ?`,
      [`WO-${year}-%`]
    );
    const count = Number(rows[0]?.count || 0) + 1;
    return `WO-${year}-${String(count).padStart(4, '0')}`;
  }

  static async findAll({
    facilityId,
    status,
    priority,
    category,
    reportedBy,
    assignedTo,
    search,
    limit = 50,
    offset = 0
  } = {}) {
    let sql = `
      SELECT wo.*,
             f.name as facility_name,
             f.code as facility_code,
             u.name as reported_by_name,
             u.email as reported_by_email,
             COALESCE(c.name, ua.name) as assigned_to_name,
             c.name as contractor_name,
             inv.id as invoice_id,
             inv.invoice_number,
             inv.status as invoice_status,
             inv.total_amount as invoice_total_amount,
             (SELECT COUNT(*) FROM work_order_photos wop WHERE wop.work_order_id = wo.id) as photo_count
      FROM work_orders wo
      LEFT JOIN facilities f ON wo.facility_id = f.id
      LEFT JOIN users u ON wo.reported_by = u.id
      LEFT JOIN users ua ON wo.assigned_to = ua.id
      LEFT JOIN contractors c ON wo.contractor_id = c.id OR wo.assigned_to = c.id
      LEFT JOIN invoices inv ON inv.work_order_id = wo.id
      WHERE 1=1
    `;
    const params = [];

    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (status) {
      if (status === 'active') {
        sql += ` AND wo.status IN ('approved', 'assigned', 'in_progress')`;
      } else {
        sql += ` AND wo.status = ?`;
        params.push(status);
      }
    }
    if (priority) {
      sql += ` AND (wo.priority = ? OR wo.urgency_category = ?)`;
      params.push(priority, priority);
    }
    if (category) {
      sql += ` AND wo.category = ?`;
      params.push(category);
    }
    if (reportedBy) {
      sql += ` AND wo.reported_by = ?`;
      params.push(reportedBy);
    }
    if (assignedTo) {
      sql += ` AND wo.assigned_to = ?`;
      params.push(assignedTo);
    }
    if (search) {
      sql += ` AND (wo.title LIKE ? OR wo.tracking_number LIKE ? OR wo.description LIKE ? OR wo.location_details LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY wo.created_at DESC, wo.tracking_number DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ facilityId, status, priority, category, reportedBy, assignedTo, search } = {}) {
    let sql = `SELECT COUNT(*) as total FROM work_orders wo WHERE 1=1`;
    const params = [];

    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (status) {
      if (status === 'active') {
        sql += ` AND wo.status IN ('approved', 'assigned', 'in_progress')`;
      } else {
        sql += ` AND wo.status = ?`;
        params.push(status);
      }
    }
    if (priority) {
      sql += ` AND (wo.priority = ? OR wo.urgency_category = ?)`;
      params.push(priority, priority);
    }
    if (category) {
      sql += ` AND wo.category = ?`;
      params.push(category);
    }
    if (reportedBy) {
      sql += ` AND wo.reported_by = ?`;
      params.push(reportedBy);
    }
    if (assignedTo) {
      sql += ` AND wo.assigned_to = ?`;
      params.push(assignedTo);
    }
    if (search) {
      sql += ` AND (wo.title LIKE ? OR wo.tracking_number LIKE ? OR wo.description LIKE ? OR wo.location_details LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT wo.*,
              f.name as facility_name,
              f.code as facility_code,
              f.address as facility_address,
              f.city as facility_city,
              u.name as reported_by_name,
              u.email as reported_by_email,
              COALESCE(c.name, ua.name) as assigned_to_name,
              COALESCE(c.email, ua.email) as assigned_to_email,
              uass.name as assessor_name,
              uass.email as assessor_email,
              c.name as contractor_name,
              inv.id as invoice_id,
              inv.invoice_number,
              inv.status as invoice_status,
              inv.total_amount as invoice_total_amount
       FROM work_orders wo
       LEFT JOIN facilities f ON wo.facility_id = f.id
       LEFT JOIN users u ON wo.reported_by = u.id
       LEFT JOIN users ua ON wo.assigned_to = ua.id
       LEFT JOIN users uass ON wo.assessor_id = uass.id
       LEFT JOIN contractors c ON wo.contractor_id = c.id OR wo.assigned_to = c.id
       LEFT JOIN invoices inv ON inv.work_order_id = wo.id
       WHERE wo.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async create({
    id,
    tracking_number,
    title,
    description,
    facility_id,
    location_details,
    category,
    priority,
    urgency_category = 'Urgent 4–8 days',
    funding_route = 'route_b',
    status = 'reported',
    reported_by,
    approved_by = null,
    estimated_cost = 0,
    due_date
  }) {
    await db.query(
      `INSERT INTO work_orders (id, tracking_number, title, description, facility_id, location_details, category, priority, urgency_category, funding_route, status, reported_by, approved_by, estimated_cost, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tracking_number, title, description, facility_id, location_details, category, priority, urgency_category, funding_route, status, reported_by, approved_by, estimated_cost, due_date]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE work_orders SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async addPhoto({ id, work_order_id, photo_url, caption, stage = 'initial', uploaded_by }) {
    await db.query(
      `INSERT INTO work_order_photos (id, work_order_id, photo_url, caption, stage, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, work_order_id, photo_url, caption, stage, uploaded_by]
    );
    const { rows } = await db.query(`SELECT * FROM work_order_photos WHERE id = ?`, [id]);
    return rows[0];
  }

  static async getPhotos(workOrderId) {
    const { rows } = await db.query(
      `SELECT p.*, u.name as uploaded_by_name 
       FROM work_order_photos p
       LEFT JOIN users u ON p.uploaded_by = u.id
       WHERE p.work_order_id = ?
       ORDER BY p.created_at ASC`,
      [workOrderId]
    );
    return rows;
  }
}
