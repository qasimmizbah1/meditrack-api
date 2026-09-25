import { ContractorService } from '../services/contractor.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getContractors = catchAsync(async (req, res) => {
  const { contractors, meta } = await ContractorService.getAllContractors(req.query);
  return ApiResponse.success(res, contractors, 'Contractors retrieved successfully', 200, meta);
});

export const getContractorById = catchAsync(async (req, res) => {
  const contractor = await ContractorService.getContractorById(req.params.id);
  return ApiResponse.success(res, contractor, 'Contractor profile retrieved');
});

export const createContractor = catchAsync(async (req, res) => {
  const contractor = await ContractorService.createContractor(req.body);
  return ApiResponse.created(res, contractor, 'Contractor registered successfully');
});

export const updateContractor = catchAsync(async (req, res) => {
  const contractor = await ContractorService.updateContractor(req.params.id, req.body);
  return ApiResponse.success(res, contractor, 'Contractor updated successfully');
});

export const uploadContractorDocument = catchAsync(async (req, res) => {
  const document = await ContractorService.uploadDocument(req.params.id, req.body, req.file);
  return ApiResponse.created(res, document, 'Compliance document uploaded successfully');
});
