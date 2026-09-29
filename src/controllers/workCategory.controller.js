import { WorkCategoryService } from '../services/workCategory.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getWorkCategories = catchAsync(async (req, res) => {
  const categories = await WorkCategoryService.getAllCategories();
  return ApiResponse.success(res, categories, 'Work categories retrieved successfully');
});

export const getWorkCategoryById = catchAsync(async (req, res) => {
  const category = await WorkCategoryService.getCategoryById(req.params.id);
  return ApiResponse.success(res, category, 'Work category retrieved');
});

export const createWorkCategory = catchAsync(async (req, res) => {
  const category = await WorkCategoryService.createCategory(req.body);
  return ApiResponse.created(res, category, 'Work category created successfully');
});

export const updateWorkCategory = catchAsync(async (req, res) => {
  const category = await WorkCategoryService.updateCategory(req.params.id, req.body);
  return ApiResponse.success(res, category, 'Work category updated successfully');
});

export const deleteWorkCategory = catchAsync(async (req, res) => {
  await WorkCategoryService.deleteCategory(req.params.id);
  return ApiResponse.success(res, null, 'Work category deleted successfully');
});
