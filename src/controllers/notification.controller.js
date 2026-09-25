import { NotificationService } from '../services/notification.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export class NotificationController {
  static list = catchAsync(async (req, res) => {
    const data = await NotificationService.getUserNotifications(req.user.id, req.query);
    return res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: data.notifications,
      meta: data.meta,
      unreadCount: data.unreadCount
    });
  });

  static getUnreadCount = catchAsync(async (req, res) => {
    const data = await NotificationService.getUnreadCount(req.user.id);
    return ApiResponse.success(res, data, 'Unread count retrieved');
  });

  static markAsRead = catchAsync(async (req, res) => {
    const notif = await NotificationService.markAsRead(req.params.id, req.user.id);
    return ApiResponse.success(res, notif, 'Notification marked as read');
  });

  static markAllAsRead = catchAsync(async (req, res) => {
    await NotificationService.markAllAsRead(req.user.id);
    return ApiResponse.success(res, { success: true }, 'All notifications marked as read');
  });
}
