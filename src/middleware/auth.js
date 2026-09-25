import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { UserRepository } from '../repositories/user.repository.js';

export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await UserRepository.findById(decoded.id);
    if (!user) {
      throw AppError.unauthorized('User associated with this token no longer exists');
    }

    if (user.status !== 'active') {
      throw AppError.forbidden('Your account is deactivated');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Restricts access to specified roles
 * @param  {...string} roles
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }
    next();
  };
};
