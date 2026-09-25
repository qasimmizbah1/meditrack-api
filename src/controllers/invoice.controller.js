import { InvoiceService } from '../services/invoice.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export class InvoiceController {
  static list = catchAsync(async (req, res) => {
    const data = await InvoiceService.listInvoices(req.query);
    return res.status(200).json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: data.invoices,
      meta: data.meta,
      extra: data.summary
    });
  });

  static getById = catchAsync(async (req, res) => {
    const invoice = await InvoiceService.getInvoiceById(req.params.id);
    return ApiResponse.success(res, invoice, 'Invoice retrieved successfully');
  });

  static create = catchAsync(async (req, res) => {
    const invoice = await InvoiceService.createInvoice(req.body, req.user);
    return ApiResponse.created(res, invoice, 'Invoice created successfully');
  });

  static updateStatus = catchAsync(async (req, res) => {
    const invoice = await InvoiceService.updateInvoiceStatus(req.params.id, req.body, req.user);
    return ApiResponse.success(res, invoice, `Invoice marked as ${req.body.status}`);
  });

  static getSummary = catchAsync(async (req, res) => {
    const summary = await InvoiceService.getFinancialSummary();
    return ApiResponse.success(res, summary, 'Financial summary retrieved successfully');
  });
}
