import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';

export const manifestacaoController = {
  /**
   * POST /api/portal/manifest
   * Submit Manifestação do Destinatário event
   */
  async submitManifestation(req: Request, res: Response) {
    try {
      const { invoice_id, event_type, justificativa } = req.body;

      if (!invoice_id || !event_type) {
        return res.status(400).json({ success: false, message: 'Nota fiscal e tipo de evento são obrigatórios.' });
      }

      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id) as any;
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Nota fiscal não localizada.' });
      }

      const eventMap: Record<string, { code: string; label: string }> = {
        ciencia: { code: '210210', label: 'Ciência da Operação' },
        confirmacao: { code: '210200', label: 'Confirmação da Operação' },
        desconhecimento: { code: '210220', label: 'Desconhecimento da Operação' },
        nao_realizada: { code: '210240', label: 'Operação não Realizada' },
      };

      const eventInfo = eventMap[event_type];
      if (!eventInfo) {
        return res.status(400).json({ success: false, message: 'Tipo de evento inválido.' });
      }

      if ((event_type === 'desconhecimento' || event_type === 'nao_realizada') && (!justificativa || justificativa.trim().length < 15)) {
        return res.status(400).json({ success: false, message: 'Justificativa obrigatória (mínimo de 15 caracteres).' });
      }

      // Generate SEFAZ Event Protocol Simulation / Integration
      const protocol = `SEFAZ_EVT_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
      const manifestId = `mnf_${uuidv4()}`;
      const now = new Date().toISOString();

      // Record manifestation in DB
      db.prepare(`
        INSERT INTO nfe_manifestations (id, invoice_id, company_id, user_id, event_type, event_code, justificativa, sefaz_protocol, status, manifested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'autorizado', ?)
      `).run(
        manifestId,
        invoice.id,
        invoice.company_id,
        (req as any).user?.id || 'admin',
        event_type,
        eventInfo.code,
        justificativa ? justificativa.trim() : null,
        protocol,
        now
      );

      // Update invoice status
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(`manifestado_${event_type}`, invoice.id);

      return res.json({
        success: true,
        message: `Manifestação "${eventInfo.label}" registrada com sucesso!`,
        data: {
          protocol,
          eventLabel: eventInfo.label,
          eventCode: eventInfo.code,
          manifestedAt: now,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Falha ao registrar manifestação: ${err.message}` });
    }
  },

  /**
   * GET /api/portal/manifestations/:invoiceId
   */
  async getManifestations(req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId as string;
      const history = db.prepare(`
        SELECT m.* FROM nfe_manifestations m
        WHERE m.invoice_id = ?
        ORDER BY m.manifested_at DESC
      `).all(invoiceId) as any[];

      return res.json({ success: true, history });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao obter histórico: ${err.message}` });
    }
  },
};
