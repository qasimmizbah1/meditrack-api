import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure database directory exists
const dbFilePath = path.resolve(__dirname, '../../', env.SQLITE_PATH);
const dbDir = path.dirname(dbFilePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database instance
const db = new Database(dbFilePath);

// Enable WAL mode for high concurrency and performance, plus foreign key constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`📦 SQLite Database connected: ${dbFilePath}`);

/**
 * Executes a SELECT or action SQL query.
 * Automatically adapts Postgres/MySQL parameter formats ($1, $2 or ?) to standard parameters.
 * @param {string} text - SQL Query string
 * @param {Array} [params] - Query parameter array
 * @returns {Promise<{ rows: Array, rowCount: number, lastInsertRowid?: number }>}
 */
export const query = async (text, params = []) => {
  // Convert $1, $2, $3... placeholders to ? for SQLite compatibility if needed
  let normalizedSql = text.replace(/\$(\d+)/g, '?');

  const trimmed = normalizedSql.trim();
  const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)/i.test(trimmed);

  try {
    const stmt = db.prepare(normalizedSql);

    if (isSelect) {
      const rows = stmt.all(...params);
      return {
        rows,
        rowCount: rows.length
      };
    } else {
      const info = stmt.run(...params);
      return {
        rows: [],
        rowCount: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid)
      };
    }
  } catch (error) {
    console.error('❌ Database Query Error:', error.message, '\nSQL:', text, '\nParams:', params);
    throw error;
  }
};

/**
 * Helper to run multiple statements or transactions
 */
export const transaction = (fn) => db.transaction(fn);

export const getDb = () => db;

export default {
  query,
  transaction,
  getDb
};
