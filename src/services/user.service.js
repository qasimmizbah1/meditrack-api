import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { UserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';

export class UserService {
  static async createUser(data) {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict('A user with this email address already exists');
    }

    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = await bcrypt.hash(data.password, 10);
    const roleId = `role_${data.role.toLowerCase()}`;

    const user = await UserRepository.create({
      id,
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      roleId,
      phone: data.phone || null,
      facilityId: data.facility_id || null,
      status: 'active'
    });

    return user;
  }

  static async getUsers(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserRepository.findAll({
        role: query.role,
        status: query.status,
        search: query.search,
        limit,
        offset
      }),
      UserRepository.countAll({
        role: query.role,
        status: query.status,
        search: query.search
      })
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getUserById(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw AppError.notFound(`User with ID ${id} not found`);
    }
    return user;
  }

  static async updateUser(id, updateData) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw AppError.notFound(`User with ID ${id} not found`);
    }

    const payload = {};
    if (updateData.name) payload.name = updateData.name;
    if (updateData.role) {
      payload.role = updateData.role;
      payload.role_id = `role_${updateData.role.toLowerCase()}`;
    }
    if (updateData.phone !== undefined) payload.phone = updateData.phone;
    if (updateData.facility_id !== undefined) payload.facility_id = updateData.facility_id;
    if (updateData.status) payload.status = updateData.status;

    return UserRepository.update(id, payload);
  }

  static async deleteUser(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw AppError.notFound(`User with ID ${id} not found`);
    }
    return UserRepository.delete(id);
  }
}
