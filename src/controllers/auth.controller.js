import { AuthService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await AuthService.login({ email, password });
  return ApiResponse.success(res, result, 'Login successful');
});

export const logout = catchAsync(async (req, res) => {
  // In stateless JWT, client deletes token. Endpoint acknowledges logout.
  return ApiResponse.success(res, null, 'Logged out successfully');
});

export const me = catchAsync(async (req, res) => {
  const user = await AuthService.getCurrentUser(req.user.id);
  return ApiResponse.success(res, user, 'Current user profile retrieved');
});
