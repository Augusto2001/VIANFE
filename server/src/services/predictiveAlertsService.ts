import { db } from '../database/db.js';
import { whatsappService } from './whatsappService.js';
import { generatePixEmvPayload } from './portalService.js';

export interface DueItem {
  id: string;
  item_type: 'tax_guide' | 'payable' | 'invoice_duplicate';
  description: string;
  category: string;
  amount: number;
  due_date: string;
  formatted_due_date: string;
  days_until_due: number;
  urgency_label: string;
  pix_code?: string;
  beneficiary?: string;
  cnpj?: string;
}

export interface UpcomingAlertsSummary {
  company_id: string;
  company_name: string;
  company_cnpj: string;
  phone: string;
  total_amount: number;
  items_count: number;
  items: DueItem[];
}

export const predictiveAlertsService = {
  async getUpcomingDueItems(companyId: string, daysAhead: number = 2): Promise<UpcomingAlertsSummary> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error('Empresa com ID ' + companyId + ' não encontrada.');
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + daysAhead);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    const items: DueItem[] = [];

    // 1. GUIAS E TRIBUTOS FISCAIS (accounting_provisions)
    try {
      const provisions = db.prepare(`
        SELECT * FROM accounting_provisions 
        WHERE company_id = ? 
          AND status = 'provisionado'
          AND data_lancamento >= ? 
          AND data_lancamento <= ?
        ORDER BY data_lancamento ASC
      `).all(companyId, todayStr, maxDateStr) as any[];

      for (const prov of provisions) {
        const dueDate = prov.data_lancamento;
        const daysUntilDue = Math.max(0, Math.ceil((new Date(dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24)));
        
        let urgency = '🟡 VENCE EM 48H';
        if (daysUntilDue === 0) urgency = '🚨 VENCE HOJE';
        else if (daysUntilDue === 1) urgency = '⚠️ VENCE AMANHÃ';

        const [y, m, d] = dueDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        const cleanCnpj = (company.cnpj || '').replace(/\D/g, '');
        const pixPayload = generatePixEmvPayload({
          pixKey: cleanCnpj || '00000000000',
          merchantName: company.razao_social || 'VIACONT CLIENTE',
          merchantCity: 'SALVADOR',
          amount: prov.valor,
          description: prov.historico || prov.tipo_provisao,
          txId: `GUIA${prov.id.substring(0, 10)}`
        });

        items.push({
          id: prov.id,
          item_type: 'tax_guide',
          description: prov.historico || `Guia de ${prov.tipo_provisao}`,
          category: prov.tipo_provisao,
          amount: Number(prov.valor) || 0,
          due_date: dueDate,
          formatted_due_date: formattedDate,
          days_until_due: daysUntilDue,
          urgency_label: urgency,
          pix_code: pixPayload,
          beneficiary: 'Receita Federal / SEFAZ',
          cnpj: company.cnpj
        });
      }
    } catch (e: any) {
      console.warn('Aviso ao consultar provisões:', e.message);
    }

    // 2. DUPLICATAS DE FORNECEDORES DE NOTAS FISCAIS DE ENTRADA (invoices)
    try {
      const invoices = db.prepare(`
        SELECT * FROM invoices 
        WHERE company_id = ? 
          AND tipo = 'entrada'
          AND (status IS NULL OR status != 'cancelada')
        ORDER BY data_emissao DESC
        LIMIT 100
      `).all(companyId) as any[];

      for (const inv of invoices) {
        let dups: any[] = [];
        if (inv.duplicatas_json) {
          try {
            dups = JSON.parse(inv.duplicatas_json);
          } catch (err) {}
        }

        if (Array.isArray(dups) && dups.length > 0) {
          for (let i = 0; i < dups.length; i++) {
            const d = dups[i];
            const vStr = d.dVenc || d.data_vencimento;
            if (vStr && vStr >= todayStr && vStr <= maxDateStr) {
              const daysUntilDue = Math.max(0, Math.ceil((new Date(vStr).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24)));
              
              let urgency = '🟡 VENCE EM 48H';
              if (daysUntilDue === 0) urgency = '🚨 VENCE HOJE';
              else if (daysUntilDue === 1) urgency = '⚠️ VENCE AMANHÃ';

              const parts = vStr.split('-');
              const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : vStr;

              items.push({
                id: `${inv.id}_dup_${i}`,
                item_type: 'invoice_duplicate',
                description: `Duplicata NF nº ${inv.numero || ''} - ${inv.emitente_nome || 'Fornecedor'}`,
                category: 'Fornecedores / Compras',
                amount: Number(d.vDup || d.valor || inv.valor_total) || 0,
                due_date: vStr,
                formatted_due_date: formattedDate,
                days_until_due: daysUntilDue,
                urgency_label: urgency,
                beneficiary: inv.emitente_nome,
                cnpj: inv.emitente_cnpj
              });
            }
          }
        } else if (inv.data_emissao) {
          const emDate = new Date(inv.data_emissao);
          emDate.setDate(emDate.getDate() + 30);
          const estDueDate = emDate.toISOString().split('T')[0];

          if (estDueDate >= todayStr && estDueDate <= maxDateStr) {
            const daysUntilDue = Math.max(0, Math.ceil((new Date(estDueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24)));
            let urgency = '🟡 VENCE EM 48H';
            if (daysUntilDue === 0) urgency = '🚨 VENCE HOJE';
            else if (daysUntilDue === 1) urgency = '⚠️ VENCE AMANHÃ';

            const [y, m, d] = estDueDate.split('-');
            const formattedDate = `${d}/${m}/${y}`;

            items.push({
              id: `${inv.id}_est`,
              item_type: 'payable',
              description: `Compra NF nº ${inv.numero || ''} - ${inv.emitente_nome || 'Fornecedor'}`,
              category: 'Fornecedores / Compras',
              amount: Number(inv.valor_total) || 0,
              due_date: estDueDate,
              formatted_due_date: formattedDate,
              days_until_due: daysUntilDue,
              urgency_label: urgency,
              beneficiary: inv.emitente_nome,
              cnpj: inv.emitente_cnpj
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('Aviso ao consultar notas fiscais de entrada:', e.message);
    }

    items.sort((a, b) => a.due_date.localeCompare(b.due_date));
    const totalAmount = items.reduce((acc, it) => acc + it.amount, 0);

    return {
      company_id: company.id,
      company_name: company.nome_fantasia || company.razao_social,
      company_cnpj: company.cnpj,
      phone: company.telefone || company.whatsapp || '5571999999999',
      total_amount: Math.round(totalAmount * 100) / 100,
      items_count: items.length,
      items
    };
  },

  formatWhatsAppMessage(summary: UpcomingAlertsSummary): string {
    const { company_name, total_amount, items } = summary;
    const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total_amount);

    let msg = `*Viviane:* Olá! 👋 Passando com o *Radar de Contas a Pagar* da *${company_name}* para as próximas 48 horas.\n\n`;

    if (items.length === 0) {
      msg += `✅ *Excelente notícia:* Não há contas ou guias tributárias a vencer nas próximas 48h!\n\n`;
      msg += `_Seu fluxo de caixa está 100% em dia._`;
      return msg;
    }

    msg += `📋 *COMPROMISSOS A VENCER (TOTAL: ${formattedTotal}):*\n\n`;

    items.forEach((it, idx) => {
      const valStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.amount);
      msg += `${idx + 1}. ${it.urgency_label}\n`;
      msg += `   📌 *${it.description}*\n`;
      msg += `   💰 Valor: *${valStr}* | Vencimento: *${it.formatted_due_date}*\n`;
      if (it.pix_code) {
        msg += `   🔑 PIX Copia-e-Cola: \`${it.pix_code}\`\n`;
      }
      msg += `\n`;
    });

    msg += `💡 _Dica Viacont: Pague com antecedência para evitar encargos. Se já realizou o pagamento, favor desconsiderar._\n`;
    msg += `🌐 _Acesse seu Portal do Cliente para relatórios completos._`;

    return msg;
  },

  async dispatchPredictiveAlert(companyId: string, manualPhone?: string, isManualTrigger: boolean = false): Promise<{ success: boolean; message: string; itemsSent: number }> {
    const summary = await this.getUpcomingDueItems(companyId, 2);
    
    if (summary.items.length === 0 && !isManualTrigger) {
      return {
        success: true,
        message: 'Nenhum vencimento nas próximas 48h. Disparo suprimido.',
        itemsSent: 0
      };
    }

    const targetPhone = manualPhone || summary.phone;
    if (!targetPhone) {
      throw new Error(`Nenhum telefone cadastrado para a empresa ${summary.company_name}.`);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (!isManualTrigger) {
      const pendingItems = summary.items.filter(item => {
        const alreadySent = db.prepare(`
          SELECT id FROM predictive_alerts_log 
          WHERE company_id = ? AND item_id = ? AND created_at LIKE ?
        `).get(companyId, item.id, `${todayStr}%`);
        return !alreadySent;
      });

      if (pendingItems.length === 0) {
        return {
          success: true,
          message: 'Todos os vencimentos de hoje já foram notificados anteriormente.',
          itemsSent: 0
        };
      }
    }

    const messageText = this.formatWhatsAppMessage(summary);

    const sendRes = await whatsappService.sendMessage({
      phone: targetPhone,
      message: messageText,
      companyName: summary.company_name
    }, isManualTrigger);

    const nowIso = new Date().toISOString();
    for (const item of summary.items) {
      try {
        db.prepare(`
          INSERT INTO predictive_alerts_log (
            id, company_id, item_type, item_id, phone, description, amount, due_date, status, message_preview, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          companyId,
          item.item_type,
          item.id,
          targetPhone,
          item.description,
          item.amount,
          item.due_date,
          sendRes.success ? 'sent' : 'failed',
          messageText.substring(0, 200),
          nowIso
        );
      } catch (logErr: any) {
        console.warn('Aviso ao registrar log de alerta preditivo:', logErr.message);
      }
    }

    return {
      success: sendRes.success,
      message: sendRes.message || 'Alerta preditivo disparado com sucesso!',
      itemsSent: summary.items.length
    };
  },

  async runDailyBatchAlerts(): Promise<{ processed: number; sent: number }> {
    console.log('🤖 [RADAR PREDITIVO WHATSAPP] Iniciando varredura diária de vencimentos em 48h...');

    const activeCompanies = db.prepare(`
      SELECT id, razao_social, nome_fantasia, cnpj, telefone, whatsapp 
      FROM companies 
      WHERE status = 'ativo'
    `).all() as any[];

    let processed = 0;
    let sent = 0;

    for (const comp of activeCompanies) {
      processed++;
      const phone = comp.whatsapp || comp.telefone;
      if (!phone) {
        continue;
      }

      try {
        const res = await this.dispatchPredictiveAlert(comp.id, phone, false);
        if (res.itemsSent > 0) {
          sent++;
          console.log(`✅ [RADAR PREDITIVO] Alerta enviado para ${comp.razao_social} (${res.itemsSent} itens a vencer).`);
        }
        await new Promise(r => setTimeout(r, 3000));
      } catch (err: any) {
        console.warn(`⚠️ [RADAR PREDITIVO] Erro ao processar ${comp.razao_social}:`, err.message);
      }
    }

    console.log(`🏁 [RADAR PREDITIVO WHATSAPP] Varredura finalizada. Processadas: ${processed}, Alertas enviados: ${sent}`);
    return { processed, sent };
  },

  getAlertsHistory(companyId: string, limit: number = 20): any[] {
    return db.prepare(`
      SELECT * FROM predictive_alerts_log 
      WHERE company_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(companyId, limit) as any[];
  }
};
