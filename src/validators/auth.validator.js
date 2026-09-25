import { z } from 'zod';
import { ROLES } from '../config/constants.js';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum([
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.APPROVER,
    ROLES.CONTRACTOR,
    ROLES.INSPECTOR,
    ROLES.AUDITOR
  ]),
  phone: z.string().optional().nullable(),
  facility_id: z.string().optional().nullable()
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum([
    ROLES.ADMIN,
    ROLES.STAFF,
    ROLES.APPROVER,
    ROLES.CONTRACTOR,
    ROLES.INSPECTOR,
    ROLES.AUDITOR
  ]).optional(),
  phone: z.string().optional().nullable(),
  facility_id: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional()
});
