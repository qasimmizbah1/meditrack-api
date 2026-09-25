import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';
import { query } from '../database/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    let dbStatus = 'healthy';
    let dbTime = null;
    try {
      const dbRes = await query(`SELECT datetime('now') as current_time`);
      dbTime = dbRes.rows[0]?.current_time;
    } catch (err) {
      dbStatus = `unhealthy: ${err.message}`;
    }

    return ApiResponse.success(res, {
      service: 'MediTrack API',
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        serverTime: dbTime
      }
    }, 'Health status checked successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
