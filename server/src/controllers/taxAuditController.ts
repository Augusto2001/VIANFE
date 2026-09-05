import { Request, Response } from 'express';
import { taxAuditorService } from '../services/taxAuditorService.js';

export const taxAuditController = {
  /**
   * GET /api/tax-audit/summary?company_id=...
   */
  async getAuditSummary(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ success: false, message: 'company_id é obrigatório' });
        return;
      }

      const auditData = await taxAuditorService.auditCompanyInvoices(company_id as string);
      res.json(auditData);
    } catch (err: any) {
      console.error('Tax audit error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
