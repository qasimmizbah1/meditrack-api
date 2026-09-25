import { DashboardService } from '../services/dashboard.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export class DashboardController {
  static getSummary = catchAsync(async (req, res) => {
    const summary = await DashboardService.getSummary();
    return ApiResponse.success(res, summary, 'Dashboard summary retrieved successfully');
  });
}
