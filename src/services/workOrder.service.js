import crypto from 'crypto';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { FacilityRepository } from '../repositories/facility.repository.js';
import { WorkflowService } from './workflow.service.js';
import { AppError } from '../utils/AppError.js';
import { WORK_ORDER_STATUS } from '../config/constants.js';

export class WorkOrderService {
  static async getAllWorkOrders(query, currentUser) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const filter = {
      facilityId: query.facility_id || undefined,
      status: query.status,
      priority: query.priority,
      category: query.category,
      search: query.search,
      limit,
      offset
    };

    const [workOrders, total] = await Promise.all([
      WorkOrderRepository.findAll(filter),
      WorkOrderRepository.countAll(filter)
    ]);

    return {
      workOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getWorkOrderById(id) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    const photos = await WorkOrderRepository.getPhotos(id);
    return {
      ...workOrder,
      photos
    };
  }

  static async createWorkOrder(data, currentUser, files = []) {
    const facility = await FacilityRepository.findById(data.facility_id);
    if (!facility) {
      throw AppError.badRequest(`Facility with ID ${data.facility_id} does not exist`);
    }

    const id = `wo_${crypto.randomBytes(8).toString('hex')}`;
    const trackingNumber = await WorkOrderRepository.generateNextTrackingNumber();

    const workOrder = await WorkOrderRepository.create({
      id,
      tracking_number: trackingNumber,
      title: data.title,
      description: data.description,
      facility_id: data.facility_id,
      location_details: data.location_details || null,
      category: data.category || 'Biomedical Equipment',
      priority: data.priority || 'medium',
      status: WORK_ORDER_STATUS.REPORTED,
      reported_by: currentUser.id,
      estimated_cost: data.estimated_cost || 0,
      due_date: data.due_date || null
    });

    // Record Genesis Cryptographic Status Event
    await WorkflowService.recordGenesisEvent(
      id,
      currentUser.id,
      `Work order created at ${facility.name} (${facility.code})`
    );

    // Save attached initial photos if provided via Multer
    if (files && files.length > 0) {
      for (const file of files) {
        const photoId = `wop_${crypto.randomBytes(6).toString('hex')}`;
        const relativeUrl = `/uploads/work-orders/${file.filename}`;
        await WorkOrderRepository.addPhoto({
          id: photoId,
          work_order_id: id,
          photo_url: relativeUrl,
          caption: 'Initial inspection photo',
          stage: 'initial',
          uploaded_by: currentUser.id
        });
      }
    }

    return this.getWorkOrderById(id);
  }

  static async updateWorkOrder(id, updateData, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    return WorkOrderRepository.update(id, updateData);
  }

  static async uploadPhotos(id, currentUser, files, stage = 'in_progress', caption = '') {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    if (!files || files.length === 0) {
      throw AppError.badRequest('No image files uploaded');
    }

    const savedPhotos = [];
    for (const file of files) {
      const photoId = `wop_${crypto.randomBytes(6).toString('hex')}`;
      const relativeUrl = `/uploads/work-orders/${file.filename}`;
      const photo = await WorkOrderRepository.addPhoto({
        id: photoId,
        work_order_id: id,
        photo_url: relativeUrl,
        caption: caption || 'Work order progress photo',
        stage,
        uploaded_by: currentUser.id
      });
      savedPhotos.push(photo);
    }

    return savedPhotos;
  }
}
