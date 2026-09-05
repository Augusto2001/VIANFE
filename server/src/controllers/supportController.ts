import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { whatsappService } from '../services/whatsappService.js';

export const supportController = {
  /**
   * Create Support Ticket & Notify Master on WhatsApp
   */
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const { solicitante_nome, solicitante_phone, company_id, company_name, tipo_demanda, mensagem_erro } = req.body;

      if (!solicitante_nome || !solicitante_phone || !mensagem_erro) {
        res.status(400).json({ error: 'Nome, WhatsApp e Descrição são obrigatórios.' });
        return;
      }

      const id = uuidv4();
      const nowIso = new Date().toISOString();
      const ticketNum = Math.floor(1000 + Math.random() * 9000);

      db.prepare(`
        INSERT INTO support_tickets (
          id, tenant_id, company_id, company_name, solicitante_nome, 
          solicitante_phone, tipo_demanda, mensagem_erro, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)
      `).run(
        id,
        'tenant_viacont_master',
        company_id || null,
        company_name || 'Geral / Não Informada',
        solicitante_nome.trim(),
        solicitante_phone.trim(),
        tipo_demanda || 'erro_sistema',
        mensagem_erro.trim(),
        nowIso
      );

      // Notify Master via WhatsApp ZapCont (Immediate notification)
      const zapMsg = `🚨 *NOVO TICKET DE SUPORTE - VIANFE VIACONT*\n\n` +
        `🎫 *Protocolo:* #${ticketNum}\n` +
        `👤 *Solicitante:* ${solicitante_nome}\n` +
        `📱 *WhatsApp:* ${solicitante_phone}\n` +
        `🏢 *Empresa:* ${company_name || 'Geral'}\n` +
        `🏷️ *Tipo:* ${tipo_demanda === 'erro_sistema' ? 'Erro de Sistema' : tipo_demanda === 'duvida_fiscal' ? 'Dúvida Fiscal' : 'Demanda / Recurso'}\n\n` +
        `📝 *Descrição do Problema:*\n${mensagem_erro}\n\n` +
        `🌐 *Painel:* https://vianfe.contadordev.com.br`;

      // Trigger safe send to master
      whatsappService.sendMessage({
        phone: '5575991090333', // Default Master WhatsApp
        message: zapMsg,
        companyName: company_name || 'Viacont Master'
      }, true).catch(() => {});

      res.status(201).json({
        success: true,
        message: `Chamado #${ticketNum} aberto com sucesso! Nossa equipe foi notificada no WhatsApp.`,
        data: { id, protocol: ticketNum }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * List all Support Tickets
   */
  async getTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50').all();
      res.json({ success: true, data: tickets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Resolve Ticket
   */
  async resolveTicket(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { solucao } = req.body;

      if (!solucao) {
        res.status(400).json({ error: 'Solução é obrigatória para finalizar o chamado.' });
        return;
      }

      const nowIso = new Date().toISOString();
      db.prepare(`
        UPDATE support_tickets SET
          status = 'resolvido',
          solucao = ?,
          resolved_at = ?
        WHERE id = ?
      `).run(solucao.trim(), nowIso, id);

      // Fetch ticket to notify user on WhatsApp if possible
      const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as any;
      if (ticket && ticket.solicitante_phone) {
        const resolutionMsg = `✅ *CHAMADO VIANFE RESOLVIDO*\n\n` +
          `Olá *${ticket.solicitante_nome}*,\n` +
          `Seu chamado de suporte referente a *${ticket.company_name}* foi resolvido!\n\n` +
          `💡 *Solução Aplicada:*\n${solucao}\n\n` +
          `Acesse o sistema para verificar: https://vianfe.contadordev.com.br`;

        whatsappService.sendMessage({
          phone: ticket.solicitante_phone,
          message: resolutionMsg,
          companyName: ticket.company_name
        }, true).catch(() => {});
      }

      res.json({ success: true, message: 'Ticket resolvido com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};
