import { WorkCategoryRepository } from '../repositories/workCategory.repository.js';
import { AppError } from '../utils/AppError.js';

export class WorkCategoryService {
  static async getAllCategories() {
    return WorkCategoryRepository.findAll();
  }

  static async getCategoryById(id) {
    const category = await WorkCategoryRepository.findById(id);
    if (!category) {
      throw AppError.notFound(`Work Category with ID ${id} not found`);
    }
    return category;
  }

  static async createCategory(data) {
    if (!data.name || !data.name.trim()) {
      throw AppError.badRequest('Category name is required');
    }

    const existing = await WorkCategoryRepository.findByName(data.name);
    if (existing) {
      throw AppError.badRequest(`Category "${data.name.trim()}" already exists`);
    }

    return WorkCategoryRepository.create(data);
  }

  static async updateCategory(id, data) {
    const existing = await WorkCategoryRepository.findById(id);
    if (!existing) {
      throw AppError.notFound(`Work Category with ID ${id} not found`);
    }

    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await WorkCategoryRepository.findByName(data.name);
      if (duplicate && duplicate.id !== id) {
        throw AppError.badRequest(`Category "${data.name.trim()}" already exists`);
      }
    }

    return WorkCategoryRepository.update(id, data);
  }

  static async deleteCategory(id) {
    const existing = await WorkCategoryRepository.findById(id);
    if (!existing) {
      throw AppError.notFound(`Work Category with ID ${id} not found`);
    }

    return WorkCategoryRepository.delete(id);
  }
}
