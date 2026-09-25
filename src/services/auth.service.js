import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export class AuthService {
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      facility_id: user.facility_id
    };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  }

  static generateRefreshToken(user) {
    const payload = { id: user.id };
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
  }

  static async login({ email, password }) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw AppError.forbidden('Your account is currently inactive. Please contact your system administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Exclude password hash from response
    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      token,
      refreshToken
    };
  }

  static async getCurrentUser(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  }
}
