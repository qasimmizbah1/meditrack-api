import { SettingsService } from '../services/settings.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getSettings = catchAsync(async (req, res) => {
  const settings = await SettingsService.getSettings();
  return ApiResponse.success(res, settings, 'System settings retrieved successfully');
});

export const updateSettings = catchAsync(async (req, res) => {
  const settings = await SettingsService.updateSettings(req.body);
  return ApiResponse.success(res, settings, 'System settings updated successfully');
});
