import { z } from 'zod';

export const createFacilitySchema = z.object({
  name: z.string().min(2, 'Facility name must be at least 2 characters'),
  code: z.string().min(2, 'Facility code is required (e.g., FAC-01)').toUpperCase(),
  type: z.string().default('Hospital'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email('Invalid contact email format').optional().nullable(),
  contact_phone: z.string().optional().nullable(),
  total_beds: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active')
});

export const updateFacilitySchema = createFacilitySchema.partial();
