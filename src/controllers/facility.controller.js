import { FacilityService } from '../services/facility.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getFacilities = catchAsync(async (req, res) => {
  const { facilities, meta } = await FacilityService.getAllFacilities(req.query);
  return ApiResponse.success(res, facilities, 'Facilities retrieved successfully', 200, meta);
});

export const getFacilityById = catchAsync(async (req, res) => {
  const facility = await FacilityService.getFacilityById(req.params.id);
  return ApiResponse.success(res, facility, 'Facility details retrieved');
});

export const createFacility = catchAsync(async (req, res) => {
  const facility = await FacilityService.createFacility(req.body);
  return ApiResponse.created(res, facility, 'Facility created successfully');
});

export const updateFacility = catchAsync(async (req, res) => {
  const facility = await FacilityService.updateFacility(req.params.id, req.body);
  return ApiResponse.success(res, facility, 'Facility updated successfully');
});

export const deleteFacility = catchAsync(async (req, res) => {
  await FacilityService.deleteFacility(req.params.id);
  return ApiResponse.success(res, null, 'Facility deleted successfully');
});
