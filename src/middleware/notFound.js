import { AppError } from '../utils/AppError.js';

export const notFound = (req, res, next) => {
  next(AppError.notFound(`Cannot find route ${req.method} ${req.originalUrl}`));
};
