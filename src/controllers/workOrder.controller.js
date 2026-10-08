import { WorkOrderService } from '../services/workOrder.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getWorkOrders = catchAsync(async (req, res) => {
  const { workOrders, meta } = await WorkOrderService.getAllWorkOrders(req.query, req.user);
  return ApiResponse.success(res, workOrders, 'Work orders retrieved successfully', 200, meta);
});

export const getWorkOrderById = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.getWorkOrderById(req.params.id, req.user);
  return ApiResponse.success(res, workOrder, 'Work order details retrieved');
});

export const submitAssessment = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.submitAssessment(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Engineering assessment submitted successfully');
});

export const assignLeadAssessor = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.assignLeadAssessor(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Lead Assessor assigned successfully');
});

export const requestEngineer = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.requestEngineer(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Engineer requested successfully from Quantum Built');
});

export const handleEngineerRequest = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.handleEngineerRequest(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Engineer request processed successfully');
});

export const reviewEstimate = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.reviewEstimate(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Estimate review decision recorded successfully');
});

export const createWorkOrder = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.createWorkOrder(req.body, req.user, req.files);
  return ApiResponse.created(res, workOrder, 'Work order reported successfully');
});

export const updateWorkOrder = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.updateWorkOrder(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Work order updated successfully');
});

export const uploadWorkOrderPhotos = catchAsync(async (req, res) => {
  const photos = await WorkOrderService.uploadPhotos(
    req.params.id,
    req.user,
    req.files,
    req.body.stage,
    req.body.caption
  );
  return ApiResponse.created(res, photos, 'Photos uploaded successfully');
});

export const submitCriticalQuote = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.submitCriticalQuote(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Critical quote submitted successfully');
});

export const reviewCriticalQuote = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.reviewCriticalQuote(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Critical quote review processed successfully');
});

export const deleteWorkOrder = catchAsync(async (req, res) => {
  const result = await WorkOrderService.deleteWorkOrder(req.params.id, req.user);
  return ApiResponse.success(res, result, result.message);
});

export const clearAllWorkOrders = catchAsync(async (req, res) => {
  const result = await WorkOrderService.clearAllWorkOrders(req.user);
  return ApiResponse.success(res, result, result.message);
});

export const getContractorQuotations = catchAsync(async (req, res) => {
  const quotations = await WorkOrderService.getContractorQuotations(req.params.id);
  return ApiResponse.success(res, quotations, 'Contractor quotations retrieved');
});

export const inviteContractors = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.inviteContractors(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Contractor(s) invited successfully for quotation submission');
});

export const submitContractorQuotation = catchAsync(async (req, res) => {
  const quotation = await WorkOrderService.submitContractorQuotation(req.params.id, req.body, req.user);
  return ApiResponse.created(res, quotation, 'Contractor quotation submitted successfully');
});

export const recommendContractorQuotation = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.recommendContractorQuotation(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Contractor quotation recommended to Approver');
});

export const reviewContractorRecommendation = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.reviewContractorRecommendation(req.params.id, req.body, req.user);
  return ApiResponse.success(res, workOrder, 'Contractor quotation review processed successfully');
});



