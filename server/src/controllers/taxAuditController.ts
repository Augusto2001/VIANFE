import { Request, Response } from 'express';
import { taxAuditorService } from '../services/taxAuditorService.js';
import { cardAuditService } from '../services/cardAuditService.js';

export const taxAuditController = {
  /**
   * GET /api/tax-audit/summary?company_id=...
   */
  async getAuditSummary(req: Request, res: Response): Promise<void> {
    try {
      const companyId = typeof req.query.company_id === 'string' ? req.query.company_id.trim() : String(req.query.company_id ?? '').trim();
      if (!companyId) {
        res.status(400).json({ success: false, message: 'company_id é obrigatório' });
        return;
      }

      const auditData = await taxAuditorService.auditCompanyInvoices(companyId);
      res.json(auditData);
    } catch (err: any) {
      console.error('Tax audit error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /api/tax-audit/cards-modalities?company_id=...
   */
  async getCardAndModalityAudit(req: Request, res: Response): Promise<void> {
    try {
      const companyId = typeof req.query.company_id === 'string' ? req.query.company_id.trim() : String(req.query.company_id ?? '').trim();
      if (!companyId) {
        res.status(400).json({ success: false, message: 'company_id é obrigatório' });
        return;
      }

      const result = cardAuditService.getCompanyCardAndModalityAudit(companyId);
      res.json(result);
    } catch (err: any) {
      console.error('Card & Modality audit error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};
