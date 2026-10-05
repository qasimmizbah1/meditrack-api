import db, { getDb } from '../database/db.js';

async function clearWorkOrders() {
  try {
    console.log('🧹 Clearing all test work orders and related records...');

    const rawDb = getDb();

    // Disable foreign keys temporarily to safely cascade delete
    rawDb.pragma('foreign_keys = OFF');

    const tablesToClear = [
      'invoices',
      'inspections',
      'work_order_photos',
      'status_events',
      'work_orders',
      'notifications'
    ];

    for (const table of tablesToClear) {
      try {
        rawDb.exec(`DELETE FROM ${table};`);
        console.log(`  ✓ Cleared table: ${table}`);
      } catch (err) {
        console.warn(`  ⚠ Table ${table} skipped: ${err.message}`);
      }
    }

    rawDb.pragma('foreign_keys = ON');

    console.log('\n✅ All old work orders, audit events, invoices, and inspections cleared successfully!');
    console.log('✨ Database is now fresh and ready for clean testing.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing work orders:', error);
    process.exit(1);
  }
}

clearWorkOrders();
