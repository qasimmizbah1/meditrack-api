import crypto from 'crypto';
import { ContractorRepository } from '../repositories/contractor.repository.js';
import { AppError } from '../utils/AppError.js';

export class ContractorService {
  static async getAllContractors(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const [contractors, total] = await Promise.all([
      ContractorRepository.findAll({
        search: query.search,
        complianceStatus: query.compliance_status,
        specialty: query.specialty,
        limit,
        offset
      }),
      ContractorRepository.countAll({
        search: query.search,
        complianceStatus: query.compliance_status,
        specialty: query.specialty
      })
    ]);

    return {
      contractors,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getContractorById(id) {
    const contractor = await ContractorRepository.findById(id);
    if (!contractor) {
      throw AppError.notFound(`Contractor with ID ${id} not found`);
    }

    const [documents, activeWorkOrders] = await Promise.all([
      ContractorRepository.getDocuments(id),
      ContractorRepository.getAssignedWorkOrders(id)
    ]);

    return {
      ...contractor,
      documents,
      work_orders: activeWorkOrders
    };
  }

  static async createContractor(data) {
    const existing = await ContractorRepository.findByRegistration(data.registration_number);
    if (existing) {
      throw AppError.conflict(`Contractor with registration '${data.registration_number}' already exists`);
    }

    const id = `cont_${crypto.randomBytes(6).toString('hex')}`;
    return ContractorRepository.create({
      id,
      name: data.name,
      registration_number: data.registration_number.toUpperCase(),
      specialty: data.specialty,
      contact_person: data.contact_person || null,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      compliance_status: data.compliance_status || 'compliant',
      rating: data.rating || 5.0
    });
  }

  static async updateContractor(id, data) {
    const contractor = await ContractorRepository.findById(id);
    if (!contractor) {
      throw AppError.notFound(`Contractor with ID ${id} not found`);
    }

    return ContractorRepository.update(id, data);
  }

  static async uploadDocument(contractorId, docData, file) {
    const contractor = await ContractorRepository.findById(contractorId);
    if (!contractor) {
      throw AppError.notFound(`Contractor with ID ${contractorId} not found`);
    }

    if (!file) {
      throw AppError.badRequest('Document file is required (PDF, PNG, JPG)');
    }

    const docId = `doc_${crypto.randomBytes(6).toString('hex')}`;
    const fileUrl = `/uploads/contractors/${file.filename}`;

    const expiryDate = new Date(docData.expiry_date);
    const now = new Date();
    let status = 'valid';
    if (expiryDate < now) {
      status = 'expired';
    } else if (expiryDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
      status = 'expiring_soon';
    }

    const doc = await ContractorRepository.addDocument({
      id: docId,
      contractor_id: contractorId,
      title: docData.title,
      document_type: docData.document_type || 'License',
      file_url: fileUrl,
      expiry_date: docData.expiry_date,
      status
    });

    // Automatically recalculate contractor overall compliance status
    const allDocs = await ContractorRepository.getDocuments(contractorId);
    const hasExpired = allDocs.some((d) => d.status === 'expired' || new Date(d.expiry_date) < new Date());
    const hasExpiringSoon = allDocs.some((d) => d.status === 'expiring_soon');

    let overallCompliance = 'compliant';
    if (hasExpired) {
      overallCompliance = 'non_compliant';
    } else if (hasExpiringSoon) {
      overallCompliance = 'warning';
    }

    await ContractorRepository.update(contractorId, { compliance_status: overallCompliance });

    return doc;
  }
}
