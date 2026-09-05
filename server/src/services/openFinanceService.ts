
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookTransactionPayload {
  data?: string;
  valor?: number;
  tipo?: 'CREDITO' | 'DEBITO' | 'C' | 'D' | 'credit' | 'debit' | 'inflow' | 'outflow';
  descricao?: string;
  documento?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  raw?: any;
}

export const openFinanceService = {
  async processWebhookTransactions(companyId: string, payload: any): Promise<{ processed: number; duplicates: number; items: any[] }> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error('Empresa com ID ' + companyId + ' não encontrada.');
    }

    let rawTransactions: any[] = [];
    if (Array.isArray(payload)) {
      rawTransactions = payload;
    } else if (payload && Array.isArray(payload.transactions)) {
      rawTransactions = payload.transactions;
    } else if (payload && Array.isArray(payload.items)) {
      rawTransactions = payload.items;
    } else if (payload && typeof payload === 'object') {
      rawTransactions = [payload];
    }

    let processed = 0;
    let duplicates = 0;
    const insertedItems: any[] = [];

    let bankAccount = db.prepare('SELECT id FROM bank_accounts WHERE company_id = ? LIMIT 1').get(companyId) as any;
    let bankAccountId = bankAccount ? bankAccount.id : null;
    if (!bankAccountId) {
      bankAccountId = uuidv4();
      db.prepare(`
        INSERT INTO bank_accounts (id, company_id, banco_nome, banco_codigo, agencia, conta, tipo_conta, saldo_inicial, saldo_atual, created_at)
        VALUES (?, ?, 'Banco Digital (Open Finance)', '000', '0001', '00000-0', 'corrente', 0.0, 0.0, datetime('now'))
      `).run(bankAccountId, companyId);
    }

    const categories = db.prepare('SELECT * FROM financial_categories').all() as any[];

    const insertStmt = db.prepare(`
      INSERT INTO bank_transactions (
        id, company_id, bank_account_id, data, descricao_original, tipo, valor, documento, conciliado, categoria_id, observacoes_cliente, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))
    `);

    for (const item of rawTransactions) {
      try {
        let txDate = item.data || item.date || item.transactionDate || item.data_transacao;
        if (!txDate) {
          txDate = new Date().toISOString().split('T')[0];
        } else if (txDate.includes('T')) {
          txDate = txDate.split('T')[0];
        } else if (txDate.includes('/')) {
          const parts = txDate.split('/');
          if (parts.length === 3) {
            txDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }

        let rawVal = item.valor ?? item.amount ?? item.value ?? item.valor_liquido ?? 0;
        let valor = Math.abs(typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, '')) || 0);

        let rawTipo = String(item.tipo || item.type || item.operationType || (rawVal < 0 ? 'DEBITO' : 'CREDITO')).toUpperCase();
        let tipo = 'DEBITO';
        if (rawTipo.includes('CRED') || rawTipo === 'C' || rawTipo === 'INFLOW' || (rawVal > 0 && !item.tipo)) {
          tipo = 'CREDITO';
        }

        let descricao = item.descricao || item.description || item.memo || item.title || item.historico || 'Transação Open Finance';
        let documento = item.documento || item.id || item.transactionId || item.protocolo || null;

        if (valor === 0) continue;

        const existing = db.prepare(`
          SELECT id FROM bank_transactions 
          WHERE company_id = ? AND data = ? AND valor = ? AND tipo = ? AND descricao_original = ?
        `).get(companyId, txDate, valor, tipo, descricao);

        if (existing) {
          duplicates++;
          continue;
        }

        let matchedCatId: string | null = null;
        const descUpper = descricao.toUpperCase();
        for (const cat of categories) {
          const catNomeUpper = (cat.nome || '').toUpperCase();
          if (descUpper.includes(catNomeUpper) || (catNomeUpper.length > 4 && descUpper.includes(catNomeUpper.substring(0, 5)))) {
            matchedCatId = cat.id;
            break;
          }
        }

        if (!matchedCatId) {
          if (descUpper.includes('PIX RECEB') || descUpper.includes('RECEBIMENTO') || descUpper.includes('VENDA') || descUpper.includes('TED RECEB')) {
            const cat = categories.find(c => c.tipo === 'receita');
            if (cat) matchedCatId = cat.id;
          } else if (descUpper.includes('DAS') || descUpper.includes('SIMPLES NACIONAL') || descUpper.includes('IMPOSTO') || descUpper.includes('RECEITA FEDERAL')) {
            const cat = categories.find(c => c.tipo === 'imposto' || (c.nome || '').toUpperCase().includes('IMPOSTO'));
            if (cat) matchedCatId = cat.id;
          } else if (descUpper.includes('FOLHA') || descUpper.includes('SALARIO') || descUpper.includes('PAGTO FUNCIONARIO')) {
            const cat = categories.find(c => c.tipo === 'folha' || (c.nome || '').toUpperCase().includes('FOLHA'));
            if (cat) matchedCatId = cat.id;
          } else if (descUpper.includes('TARIFA') || descUpper.includes('IOF') || descUpper.includes('ENCARGOS')) {
            const cat = categories.find(c => (c.nome || '').toUpperCase().includes('TARIFA') || (c.nome || '').toUpperCase().includes('DESPESA'));
            if (cat) matchedCatId = cat.id;
          }
        }

        const newId = `trn_of_${uuidv4()}`;
        insertStmt.run(
          newId,
          companyId,
          bankAccountId,
          txDate,
          descricao,
          tipo,
          valor,
          documento,
          matchedCatId,
          'Importado via Open Finance Webhook'
        );

        insertedItems.push({
          id: newId,
          data: txDate,
          descricao,
          tipo,
          valor,
          categoria_id: matchedCatId
        });
        processed++;
      } catch (err: any) {
        console.warn('Erro ao processar item do webhook:', err.message);
      }
    }

    return { processed, duplicates, items: insertedItems };
  },

  async autoMapChartOfAccounts(companyId: string): Promise<{ mapped: number; totalCategories: number }> {
    const categories = db.prepare('SELECT * FROM financial_categories').all() as any[];
    const chartAccounts = db.prepare('SELECT * FROM dominio_chart_of_accounts WHERE company_id = ?').all(companyId) as any[];

    if (chartAccounts.length === 0) {
      throw new Error('Nenhum plano de contas cadastrado para esta empresa. Importe o plano de contas da Domínio Sistemas primeiro.');
    }

    let mapped = 0;

    const updateStmt = db.prepare(`
      UPDATE financial_categories 
      SET conta_debito_dominio = COALESCE(?, conta_debito_dominio),
          conta_credito_dominio = COALESCE(?, conta_credito_dominio)
      WHERE id = ?
    `);

    for (const cat of categories) {
      const catNome = (cat.nome || '').toLowerCase().trim();
      const catTipo = (cat.tipo || '').toLowerCase();

      let debitoConta: string | null = null;
      let creditoConta: string | null = null;

      for (const acc of chartAccounts) {
        const accNome = (acc.nome_conta || '').toLowerCase();
        const accCodigo = acc.codigo_conta || acc.classificacao;

        if (accNome.includes(catNome) || catNome.includes(accNome)) {
          if (catTipo === 'receita') {
            creditoConta = accCodigo;
          } else {
            debitoConta = accCodigo;
          }
        }

        if (accNome.includes('banco') || accNome.includes('caixa') || accNome.includes('movimento')) {
          if (catTipo === 'receita' && !debitoConta) {
            debitoConta = accCodigo;
          } else if (catTipo !== 'receita' && !creditoConta) {
            creditoConta = accCodigo;
          }
        }
      }

      if (!debitoConta || !creditoConta) {
        for (const acc of chartAccounts) {
          const accNome = (acc.nome_conta || '').toLowerCase();
          const accCodigo = acc.codigo_conta || acc.classificacao;

          if (catTipo === 'imposto' && (accNome.includes('imposto') || accNome.includes('simples') || accNome.includes('tributo'))) {
            debitoConta = debitoConta || accCodigo;
          } else if (catTipo === 'folha' && (accNome.includes('salario') || accNome.includes('ordenado') || accNome.includes('folha'))) {
            debitoConta = debitoConta || accCodigo;
          } else if (catTipo === 'despesa' && (accNome.includes('despesa') || accNome.includes('custo'))) {
            debitoConta = debitoConta || accCodigo;
          } else if (catTipo === 'receita' && (accNome.includes('receita') || accNome.includes('venda') || accNome.includes('prestacao'))) {
            creditoConta = creditoConta || accCodigo;
          }
        }
      }

      if (debitoConta || creditoConta) {
        updateStmt.run(debitoConta || cat.conta_debito_dominio, creditoConta || cat.conta_credito_dominio, cat.id);
        mapped++;
      }
    }

    return { mapped, totalCategories: categories.length };
  }
};
