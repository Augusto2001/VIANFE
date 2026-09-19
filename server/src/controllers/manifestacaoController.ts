import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';

export const manifestacaoController = {
  /**
   * POST /api/portal/manifest
   * Submit Manifestação do Destinatário event
   */
  async submitManifestation(_req: Request, res: Response) {
    // Do not record authorization without signed transmission and a real SEFAZ response.
    return res.status(503).json({
      success: false,
      message: 'Manifestação manual indisponível: integração de envio e confirmação SEFAZ ainda não validada. Nenhum evento foi enviado ou registrado como autorizado.'
    });
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
