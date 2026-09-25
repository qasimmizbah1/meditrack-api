import db from '../database/db.js';

export class ContractorRepository {
  static async findAll({ search, complianceStatus, specialty, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT c.*,
             (SELECT COUNT(*) FROM contractor_documents cd WHERE cd.contractor_id = c.id) as document_count,
             (SELECT COUNT(*) FROM work_orders wo WHERE wo.assigned_to = c.id AND wo.status NOT IN ('completed', 'verified', 'closed')) as active_jobs_count
      FROM contractors c
      WHERE 1=1
    `;
    const params = [];

    if (complianceStatus) {
      sql += ` AND c.compliance_status = ?`;
      params.push(complianceStatus);
    }
    if (specialty) {
      sql += ` AND c.specialty LIKE ?`;
      params.push(`%${specialty}%`);
    }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.registration_number LIKE ? OR c.contact_person LIKE ? OR c.city LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY c.rating DESC, c.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    return rows;
  }

  static async countAll({ search, complianceStatus, specialty } = {}) {
    let sql = `SELECT COUNT(*) as total FROM contractors c WHERE 1=1`;
    const params = [];

    if (complianceStatus) {
      sql += ` AND c.compliance_status = ?`;
      params.push(complianceStatus);
    }
    if (specialty) {
      sql += ` AND c.specialty LIKE ?`;
      params.push(`%${specialty}%`);
    }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.registration_number LIKE ? OR c.contact_person LIKE ? OR c.city LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const { rows } = await db.query(sql, params);
    return rows[0]?.total || 0;
  }

  static async findById(id) {
    const { rows } = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM work_orders wo WHERE wo.assigned_to = c.id AND wo.status NOT IN ('completed', 'verified', 'closed', 'cancelled')) as active_jobs_count
       FROM contractors c 
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByRegistration(reg) {
    const { rows } = await db.query(
      `SELECT * FROM contractors WHERE UPPER(registration_number) = UPPER(?) LIMIT 1`,
      [reg]
    );
    return rows[0] || null;
  }

  static async create({ id, name, registration_number, specialty, contact_person, email, phone, address, city, state, compliance_status = 'compliant', rating = 5.0 }) {
    await db.query(
      `INSERT INTO contractors (id, name, registration_number, specialty, contact_person, email, phone, address, city, state, compliance_status, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, registration_number, specialty, contact_person, email, phone, address, city, state, compliance_status, rating]
    );
    return this.findById(id);
  }

  static async update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);

    const setClauses = keys.map((key) => `${key} = ?`).join(', ');
    const params = [...Object.values(fields), id];

    await db.query(
      `UPDATE contractors SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  static async addDocument({ id, contractor_id, title, document_type, file_url, expiry_date, status = 'valid' }) {
    await db.query(
      `INSERT INTO contractor_documents (id, contractor_id, title, document_type, file_url, expiry_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, contractor_id, title, document_type, file_url, expiry_date, status]
    );
    const { rows } = await db.query(`SELECT * FROM contractor_documents WHERE id = ?`, [id]);
    return rows[0];
  }

  static async getDocuments(contractorId) {
    const { rows } = await db.query(
      `SELECT * FROM contractor_documents 
       WHERE contractor_id = ? 
       ORDER BY expiry_date ASC`,
      [contractorId]
    );
    return rows;
  }

  static async getAssignedWorkOrders(contractorId) {
    const { rows } = await db.query(
      `SELECT wo.*, f.name as facility_name 
       FROM work_orders wo
       LEFT JOIN facilities f ON wo.facility_id = f.id
       WHERE wo.assigned_to = ? OR wo.contractor_id = ?
       ORDER BY wo.created_at DESC`,
      [contractorId, contractorId]
    );
    return rows;
  }
}
