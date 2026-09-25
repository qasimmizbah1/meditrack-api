import { UserService } from '../services/user.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const getUsers = catchAsync(async (req, res) => {
  const { users, meta } = await UserService.getUsers(req.query);
  return ApiResponse.success(res, users, 'Users retrieved successfully', 200, meta);
});

export const getUserById = catchAsync(async (req, res) => {
  const user = await UserService.getUserById(req.params.id);
  return ApiResponse.success(res, user, 'User details retrieved');
});

export const createUser = catchAsync(async (req, res) => {
  const user = await UserService.createUser(req.body);
  return ApiResponse.created(res, user, 'User created successfully');
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await UserService.updateUser(req.params.id, req.body);
  return ApiResponse.success(res, user, 'User updated successfully');
});

export const deleteUser = catchAsync(async (req, res) => {
  await UserService.deleteUser(req.params.id);
  return ApiResponse.success(res, null, 'User deleted successfully');
});
