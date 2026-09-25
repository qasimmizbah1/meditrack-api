import { z } from 'zod';
import { CONTRACTOR_COMPLIANCE_STATUS } from '../config/constants.js';

export const createContractorSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  registration_number: z.string().min(3, 'Registration number is required').toUpperCase(),
  specialty: z.string().min(2, 'Specialty is required'),
  contact_person: z.string().optional().nullable(),
  email: z.string().email('Invalid email address format'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  compliance_status: z.enum([
    CONTRACTOR_COMPLIANCE_STATUS.COMPLIANT,
    CONTRACTOR_COMPLIANCE_STATUS.WARNING,
    CONTRACTOR_COMPLIANCE_STATUS.NON_COMPLIANT
  ]).default(CONTRACTOR_COMPLIANCE_STATUS.COMPLIANT),
  rating: z.coerce.number().min(0).max(5).default(5.0)
});

export const updateContractorSchema = createContractorSchema.partial();

export const createDocumentSchema = z.object({
  title: z.string().min(2, 'Document title is required'),
  document_type: z.string().default('License'),
  expiry_date: z.string().min(4, 'Expiry date is required')
});
