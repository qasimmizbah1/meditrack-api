import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation Error';
    errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
  }

  // Handle PostgreSQL Specific Errors
  if (err.code) {
    if (err.code === '23505') {
      // Unique violation
      statusCode = 409;
      message = 'Resource already exists (duplicate entry)';
      errors = { detail: err.detail };
    } else if (err.code === '23503') {
      // Foreign key violation
      statusCode = 400;
      message = 'Invalid reference identifier (foreign key violation)';
      errors = { detail: err.detail };
    } else if (err.code === '22P02') {
      // Invalid text representation (e.g. invalid UUID)
      statusCode = 400;
      message = 'Invalid data format or ID representation';
    }
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please authenticate again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please log in again.';
  }

  const response = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack })
  };

  if (statusCode === 500 && env.NODE_ENV === 'development') {
    console.error('💥 Unhandled Exception:', err);
  }

  return res.status(statusCode).json(response);
};
