import crypto from 'crypto';
import { InspectionRepository } from '../repositories/inspection.repository.js';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { WorkflowService } from './workflow.service.js';
import { AppError } from '../utils/AppError.js';
import { INSPECTION_STATUS, WORK_ORDER_STATUS } from '../config/constants.js';

export class InspectionService {
  static async getAllInspections(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const [inspections, total] = await Promise.all([
      InspectionRepository.findAll({
        result: query.result,
        inspectorId: query.inspector_id,
        facilityId: query.facility_id,
        search: query.search,
        limit,
        offset
      }),
      InspectionRepository.countAll({
        result: query.result,
        inspectorId: query.inspector_id,
        facilityId: query.facility_id,
        search: query.search
      })
    ]);

    return {
      inspections,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getInspectionById(id) {
    const inspection = await InspectionRepository.findById(id);
    if (!inspection) {
      throw AppError.notFound(`Inspection with ID ${id} not found`);
    }

    const photos = await InspectionRepository.getPhotos(id);
    return {
      ...inspection,
      photos
    };
  }

  static async createInspection(data, inspector, files = []) {
    const workOrder = await WorkOrderRepository.findById(data.work_order_id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${data.work_order_id} not found`);
    }

    // Work order must be completed (or in verification) to be inspected
    if (workOrder.status !== WORK_ORDER_STATUS.COMPLETED && workOrder.status !== WORK_ORDER_STATUS.VERIFIED) {
      throw AppError.badRequest(
        `Cannot inspect work order in '${workOrder.status}' status. Work order must be in 'completed' status.`
      );
    }

    const id = `insp_${crypto.randomBytes(6).toString('hex')}`;
    const inspection = await InspectionRepository.create({
      id,
      work_order_id: data.work_order_id,
      inspector_id: inspector.id,
      result: data.result,
      checklist_results: data.checklist_results || null,
      observations: data.observations,
      recommendations: data.recommendations || null
    });

    // Save attached inspection photos if any
    if (files && files.length > 0) {
      for (const file of files) {
        const photoId = `inpp_${crypto.randomBytes(6).toString('hex')}`;
        const photoUrl = `/uploads/inspections/${file.filename}`;
        await InspectionRepository.addPhoto({
          id: photoId,
          inspection_id: id,
          photo_url: photoUrl,
          caption: `Inspection ${data.result} evidence`
        });
      }
    }

    // Execute Status Workflow Transition with SHA-256 Audit Event
    if (data.result === INSPECTION_STATUS.PASS) {
      await WorkflowService.transitionStatus({
        workOrderId: data.work_order_id,
        targetStatus: WORK_ORDER_STATUS.VERIFIED,
        actor: inspector,
        notes: `Quality Inspection PASSED. Inspector: ${inspector.name}. Remarks: ${data.observations}`
      });
    } else {
      // If FAIL, transition work order back to IN_PROGRESS
      await WorkflowService.transitionStatus({
        workOrderId: data.work_order_id,
        targetStatus: WORK_ORDER_STATUS.IN_PROGRESS,
        actor: inspector,
        notes: `Quality Inspection FAILED - Returned for corrective maintenance. Remarks: ${data.observations}`
      });
    }

    return this.getInspectionById(id);
  }

  static async updateInspection(id, data) {
    const inspection = await InspectionRepository.findById(id);
    if (!inspection) {
      throw AppError.notFound(`Inspection with ID ${id} not found`);
    }

    return InspectionRepository.update(id, data);
  }
}
