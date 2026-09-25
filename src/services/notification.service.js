import crypto from 'crypto';
import { NotificationRepository } from '../repositories/notification.repository.js';

export class NotificationService {
  static async getUserNotifications(userId, query = {}) {
    const isRead = query.is_read !== undefined ? query.is_read === 'true' || query.is_read === '1' : undefined;
    const limit = parseInt(query.limit, 10) || 20;
    const page = parseInt(query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      NotificationRepository.findByUserId(userId, { isRead, limit, offset }),
      NotificationRepository.countUnreadByUserId(userId)
    ]);

    return {
      notifications,
      unreadCount: Number(unreadCount),
      meta: {
        page,
        limit
      }
    };
  }

  static async getUnreadCount(userId) {
    const unreadCount = await NotificationRepository.countUnreadByUserId(userId);
    return { unreadCount: Number(unreadCount) };
  }

  static async markAsRead(id, userId) {
    return await NotificationRepository.markAsRead(id, userId);
  }

  static async markAllAsRead(userId) {
    return await NotificationRepository.markAllAsRead(userId);
  }

  static async sendNotification({ userId, title, message, type = 'info', link = null }) {
    if (!userId) return null;
    const id = crypto.randomUUID();
    return await NotificationRepository.create({
      id,
      user_id: userId,
      title,
      message,
      type,
      link
    });
  }
}
