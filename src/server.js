import app from './app.js';
import { env } from './config/env.js';
import pool from './database/db.js';
import { runMigrations } from './database/migrate.js';
import { seedDatabase } from './database/seed.js';

const PORT = env.PORT || 5000;

async function bootstrap() {
  try {
    // 1. Auto-apply migrations on startup
    await runMigrations();

    // 2. If database is completely empty (no users table or 0 users), seed baseline data
    const { rows: userCountRows } = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = Number(userCountRows[0]?.count || 0);
    if (userCount === 0) {
      console.log('🌱 No users detected in database, auto-seeding baseline data...');
      await seedDatabase();
    }
  } catch (err) {
    console.error('⚠️ Database auto-migration / seed check error:', err);
  }

  const server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 MediTrack API Server running on port ${PORT}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`=========================================`);
  });

  // Graceful shutdown handlers
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await pool.end();
        console.log('PostgreSQL pool closed.');
      } catch (err) {
        console.error('Error closing PostgreSQL pool:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
