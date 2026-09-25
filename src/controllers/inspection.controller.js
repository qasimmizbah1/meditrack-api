import { InspectionService } from '../services/inspection.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getInspections = catchAsync(async (req, res) => {
  const { inspections, meta } = await InspectionService.getAllInspections(req.query);
  return ApiResponse.success(res, inspections, 'Inspections retrieved successfully', 200, meta);
});

export const getInspectionById = catchAsync(async (req, res) => {
  const inspection = await InspectionService.getInspectionById(req.params.id);
  return ApiResponse.success(res, inspection, 'Inspection details retrieved');
});

export const createInspection = catchAsync(async (req, res) => {
  const inspection = await InspectionService.createInspection(req.body, req.user, req.files);
  return ApiResponse.created(res, inspection, `Inspection submitted with result: ${req.body.result}`);
});

export const updateInspection = catchAsync(async (req, res) => {
  const inspection = await InspectionService.updateInspection(req.params.id, req.body);
  return ApiResponse.success(res, inspection, 'Inspection updated successfully');
});
