import { DashboardRepository } from '../repositories/dashboard.repository.js';

export class DashboardService {
  static async getSummary() {
    return await DashboardRepository.getSummary();
  }
}
