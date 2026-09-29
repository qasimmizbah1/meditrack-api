import db from '../database/db.js';
import crypto from 'crypto';

export class WorkCategoryRepository {
  static async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS work_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed standard healthcare operational categories if table is empty
    const { rows } = await db.query(`SELECT COUNT(*) as count FROM work_categories`);
    if (Number(rows[0]?.count || 0) === 0) {
      const defaultCategories = [
        { name: 'Biomedical Equipment', description: 'Diagnostic imaging, ventilators, and clinical life support' },
        { name: 'HVAC', description: 'Hospital cleanroom, laminar air flow, and ventilation' },
        { name: 'Electrical', description: 'High voltage emergency life support circuits and transfer switches' },
        { name: 'Plumbing', description: 'Dialysis water treatment and medical gas pipelines' },
        { name: 'Structural', description: 'Structural architectural repairs, doors, and protective painting' },
        { name: 'Sanitation', description: 'Clinical sterilization, waste management, and disinfection' }
      ];

      for (const cat of defaultCategories) {
        const id = `cat_${crypto.randomBytes(6).toString('hex')}`;
        await db.query(
          `INSERT INTO work_categories (id, name, description) VALUES (?, ?, ?)`,
          [id, cat.name, cat.description]
        );
      }
    }
  }

  static async findAll() {
    await this.init();
    const { rows } = await db.query(`SELECT * FROM work_categories ORDER BY name ASC`);
    return rows;
  }

  static async findById(id) {
    await this.init();
    const { rows } = await db.query(`SELECT * FROM work_categories WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  static async findByName(name) {
    await this.init();
    const { rows } = await db.query(`SELECT * FROM work_categories WHERE LOWER(name) = LOWER(?)`, [name.trim()]);
    return rows[0] || null;
  }

  static async create({ name, description }) {
    await this.init();
    const id = `cat_${crypto.randomBytes(6).toString('hex')}`;
    await db.query(
      `INSERT INTO work_categories (id, name, description) VALUES (?, ?, ?)`,
      [id, name.trim(), description ? description.trim() : null]
    );
    return this.findById(id);
  }

  static async update(id, { name, description }) {
    await this.init();
    await db.query(
      `UPDATE work_categories SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name.trim(), description ? description.trim() : null, id]
    );
    return this.findById(id);
  }

  static async delete(id) {
    await this.init();
    await db.query(`DELETE FROM work_categories WHERE id = ?`, [id]);
    return true;
  }
}
