import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { getDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    console.log('🔄 Checking database migrations...');

    // 1. Create migrations tracking table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read all .sql migration files in database/migrations/ directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // 3. Get already executed migrations
    const { rows: executedRows } = await db.query('SELECT filename FROM _migrations');
    const executedSet = new Set(executedRows.map((r) => r.filename));

    const rawDb = getDb();

    for (const file of files) {
      if (!executedSet.has(file)) {
        console.log(`⏳ Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Execute batch SQL script
        rawDb.exec(sql);

        // Record migration
        await db.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
        console.log(`✅ Applied migration: ${file}`);
      }
    }

    console.log('✨ All migrations are up to date.');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runMigrations();
