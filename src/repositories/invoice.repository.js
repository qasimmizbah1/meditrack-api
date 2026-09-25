import db from '../database/db.js';

export class InvoiceRepository {
  static async generateNextInvoiceNumber() {
    const year = new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?`,
      [`INV-${year}-%`]
    );
    const count = Number(rows[0]?.count || 0) + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  }

  static async findAll({ status, contractorId, facilityId, search, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT inv.*,
             wo.tracking_number as work_order_tracking,
             wo.title as work_order_title,
             wo.status as work_order_status,
             c.name as contractor_name,
             c.registration_number as contractor_reg,
             c.email as contractor_email,
             f.name as facility_name
      FROM invoices inv
      LEFT JOIN work_orders wo ON inv.work_order_id = wo.id
      LEFT JOIN contractors c ON inv.contractor_id = c.id
      LEFT JOIN facilities f ON wo.facility_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND inv.status = ?`;
      params.push(status);
    }
    if (contractorId) {
      sql += ` AND inv.contractor_id = ?`;
      params.push(contractorId);
    }
    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (search) {
      sql += ` AND (inv.invoice_number LIKE ? OR wo.tracking_number LIKE ? OR c.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY inv.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ status, contractorId, facilityId, search } = {}) {
    let sql = `
      SELECT COUNT(*) as total
      FROM invoices inv
      LEFT JOIN work_orders wo ON inv.work_order_id = wo.id
      LEFT JOIN contractors c ON inv.contractor_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND inv.status = ?`;
      params.push(status);
    }
    if (contractorId) {
      sql += ` AND inv.contractor_id = ?`;
      params.push(contractorId);
    }
    if (facilityId) {
      sql += ` AND wo.facility_id = ?`;
      params.push(facilityId);
    }
    if (search) {
      sql += ` AND (inv.invoice_number LIKE ? OR wo.tracking_number LIKE ? OR c.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT inv.*,
              wo.tracking_number as work_order_tracking,
              wo.title as work_order_title,
              wo.status as work_order_status,
              wo.category as work_order_category,
              c.name as contractor_name,
              c.registration_number as contractor_reg,
              c.email as contractor_email,
              c.phone as contractor_phone,
              c.address as contractor_address,
              f.name as facility_name,
              f.code as facility_code
       FROM invoices inv
       LEFT JOIN work_orders wo ON inv.work_order_id = wo.id
       LEFT JOIN contractors c ON inv.contractor_id = c.id
       LEFT JOIN facilities f ON wo.facility_id = f.id
       WHERE inv.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByWorkOrderId(workOrderId) {
    const { rows } = await db.query(
      `SELECT * FROM invoices WHERE work_order_id = ? LIMIT 1`,
      [workOrderId]
    );
    return rows[0] || null;
  }

  static async create({ id, invoice_number, work_order_id, contractor_id, amount, tax_amount = 0, total_amount, status = 'pending', due_date, notes = null, pdf_url = null }) {
    await db.query(
      `INSERT INTO invoices (id, invoice_number, work_order_id, contractor_id, amount, tax_amount, total_amount, status, due_date, notes, pdf_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, invoice_number, work_order_id, contractor_id, amount, tax_amount, total_amount, status, due_date, notes, pdf_url]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE invoices SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async getFinancialSummary() {
    const { rows } = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_billed,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) as total_approved
      FROM invoices
    `);
    return rows[0];
  }
}
