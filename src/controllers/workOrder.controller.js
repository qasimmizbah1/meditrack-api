import { WorkOrderService } from '../services/workOrder.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getWorkOrders = catchAsync(async (req, res) => {
  const { workOrders, meta } = await WorkOrderService.getAllWorkOrders(req.query, req.user);
  return ApiResponse.success(res, workOrders, 'Work orders retrieved successfully', 200, meta);
});

export const getWorkOrderById = catchAsync(async (req, res) => {
  const workOrder = await WorkOrderService.getWorkOrderById(req.params.id);
  return ApiResponse.success(res, workOrder, 'Work order details retrieved');
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
