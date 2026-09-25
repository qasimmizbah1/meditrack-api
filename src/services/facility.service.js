import crypto from 'crypto';
import { FacilityRepository } from '../repositories/facility.repository.js';
import { AppError } from '../utils/AppError.js';

export class FacilityService {
  static async getAllFacilities(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const [facilities, total] = await Promise.all([
      FacilityRepository.findAll({
        search: query.search,
        status: query.status,
        city: query.city,
        limit,
        offset
      }),
      FacilityRepository.countAll({
        search: query.search,
        status: query.status,
        city: query.city
      })
    ]);

    return {
      facilities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getFacilityById(id) {
    const facility = await FacilityRepository.findById(id);
    if (!facility) {
      throw AppError.notFound(`Facility with ID ${id} not found`);
    }
    return facility;
  }

  static async createFacility(data) {
    const existingCode = await FacilityRepository.findByCode(data.code);
    if (existingCode) {
      throw AppError.conflict(`Facility with code '${data.code}' already exists`);
    }

    const id = `fac_${crypto.randomBytes(6).toString('hex')}`;
    const facility = await FacilityRepository.create({
      id,
      name: data.name,
      code: data.code.toUpperCase(),
      type: data.type || 'Hospital',
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      contact_name: data.contact_name || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      total_beds: data.total_beds || 0,
      status: data.status || 'active'
    });

    return facility;
  }

  static async updateFacility(id, updateData) {
    const facility = await FacilityRepository.findById(id);
    if (!facility) {
      throw AppError.notFound(`Facility with ID ${id} not found`);
    }

    if (updateData.code && updateData.code.toUpperCase() !== facility.code) {
      const existing = await FacilityRepository.findByCode(updateData.code);
      if (existing) {
        throw AppError.conflict(`Facility code '${updateData.code}' is already used by another facility`);
      }
      updateData.code = updateData.code.toUpperCase();
    }

    return FacilityRepository.update(id, updateData);
  }

  static async deleteFacility(id) {
    const facility = await FacilityRepository.findById(id);
    if (!facility) {
      throw AppError.notFound(`Facility with ID ${id} not found`);
    }
    return FacilityRepository.delete(id);
  }
}
