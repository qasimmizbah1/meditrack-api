import db from '../database/db.js';

export class SettingsService {
  static async init() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default settings if not exists
    const defaults = {
      currency: 'ZAR',
      currency_symbol: 'R',
      system_name: 'MediTrack',
      organization_name: 'Apex Metro Health System'
    };

    for (const [key, value] of Object.entries(defaults)) {
      await db.query(
        `INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)`,
        [key, value]
      );
    }
  }

  static async getSettings() {
    await this.init();
    const { rows } = await db.query(`SELECT key, value FROM system_settings`);
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });
    return settings;
  }

  static async updateSettings(newSettings) {
    await this.init();
    for (const [key, value] of Object.entries(newSettings)) {
      if (value !== undefined && value !== null) {
        await db.query(
          `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          [key, String(value)]
        );
      }
    }
    return this.getSettings();
  }
}
