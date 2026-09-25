import db from '../database/db.js';

export class DashboardRepository {
  static async getSummary() {
    // 1. Work Orders by status
    const { rows: woStatusRows } = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM work_orders 
      GROUP BY status
    `);

    const statusCounts = {
      reported: 0,
      approved: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      verified: 0,
      closed: 0,
      total: 0
    };

    woStatusRows.forEach((r) => {
      if (statusCounts[r.status] !== undefined) {
        statusCounts[r.status] = Number(r.count);
      }
      statusCounts.total += Number(r.count);
    });

    // 2. Work Orders by priority
    const { rows: woPriorityRows } = await db.query(`
      SELECT priority, COUNT(*) as count 
      FROM work_orders 
      GROUP BY priority
    `);

    const priorityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    woPriorityRows.forEach((r) => {
      if (priorityCounts[r.priority] !== undefined) {
        priorityCounts[r.priority] = Number(r.count);
      }
    });

    // 3. Facility stats & workload
    const { rows: facilityRows } = await db.query(`
      SELECT f.id, f.name, f.code, f.status, f.type,
             COUNT(wo.id) as total_work_orders,
             SUM(CASE WHEN wo.status NOT IN ('verified', 'closed') THEN 1 ELSE 0 END) as active_work_orders
      FROM facilities f
      LEFT JOIN work_orders wo ON f.id = wo.facility_id
      GROUP BY f.id
      ORDER BY active_work_orders DESC
    `);

    // 4. Contractor Compliance
    const { rows: contractorRows } = await db.query(`
      SELECT compliance_status, COUNT(*) as count
      FROM contractors
      GROUP BY compliance_status
    `);

    const contractorStats = {
      compliant: 0,
      expiring_soon: 0,
      non_compliant: 0,
      total: 0
    };

    contractorRows.forEach((r) => {
      if (contractorStats[r.compliance_status] !== undefined) {
        contractorStats[r.compliance_status] = Number(r.count);
      }
      contractorStats.total += Number(r.count);
    });

    // 5. Invoices Summary
    const { rows: invoiceRows } = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_billed,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) as total_approved,
        COUNT(*) as total_invoices
      FROM invoices
    `);

    // 6. Recent Audit / Status Events
    const { rows: recentEvents } = await db.query(`
      SELECT se.*, wo.tracking_number as work_order_tracking, wo.title as work_order_title, u.name as actor_name
      FROM status_events se
      LEFT JOIN work_orders wo ON se.work_order_id = wo.id
      LEFT JOIN users u ON se.actor_id = u.id
      ORDER BY se.created_at DESC
      LIMIT 6
    `);

    return {
      workOrders: {
        byStatus: statusCounts,
        byPriority: priorityCounts
      },
      facilities: {
        total: facilityRows.length,
        items: facilityRows.map((f) => ({
          id: f.id,
          name: f.name,
          code: f.code,
          type: f.type,
          status: f.status,
          totalWorkOrders: Number(f.total_work_orders || 0),
          activeWorkOrders: Number(f.active_work_orders || 0)
        }))
      },
      contractors: contractorStats,
      invoices: {
        totalBilled: Number(invoiceRows[0]?.total_billed || 0),
        totalPaid: Number(invoiceRows[0]?.total_paid || 0),
        totalPending: Number(invoiceRows[0]?.total_pending || 0),
        totalApproved: Number(invoiceRows[0]?.total_approved || 0),
        count: Number(invoiceRows[0]?.total_invoices || 0)
      },
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        workOrderId: e.work_order_id,
        workOrderTracking: e.work_order_tracking || 'WO-EVENT',
        workOrderTitle: e.work_order_title || 'Maintenance Event',
        status: e.status,
        toStatus: e.status,
        actorName: e.actor_name || 'System Operator',
        notes: e.notes,
        createdAt: e.created_at,
        eventHash: e.current_hash || ''
      }))
    };
  }
}
