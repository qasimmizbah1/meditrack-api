import { AppError } from '../utils/AppError.js';

/**
 * Validates req.body, req.query, or req.params against a Zod schema
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} source
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(AppError.unprocessable('Validation Error', formattedErrors));
    }
    // Replace with parsed & coerced data
    req[source] = result.data;
    next();
  };
};
