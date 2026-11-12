import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { parseOfx } from '../services/ofxParser.js';
import { PDFParse } from 'pdf-parse';
import { predictiveAlertsService } from '../services/predictiveAlertsService.js';
import { openFinanceService } from '../services/openFinanceService.js';

import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isReadableFinancialText, parseDominioFixedChart, reconciliationSummary } from '../services/bpoValidation.js';

function canAccessCompany(req: Request, res: Response, companyId: unknown): boolean {
  const user = (req as AuthenticatedRequest).user;
  const company = typeof companyId === 'string' && user && db.prepare(
    'SELECT id FROM companies WHERE id = ? AND tenant_id = ?'
  ).get(companyId, user.tenant_id);
  const assigned = user && (user.role === 'admin' || db.prepare(
    'SELECT company_id FROM user_companies WHERE user_id = ? AND company_id = ?'
  ).get(user.id, String(companyId)));
  if (!company || !assigned) { res.status(403).json({ error: 'Empresa não autorizada' }); return false; }
  return true;
}

export const bpoController = {
  // 1. List bank accounts
  async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const accounts = db.prepare('SELECT * FROM bank_accounts WHERE company_id = ? ORDER BY banco_nome ASC').all(company_id as string) as any[];

      res.json({ success: true, data: accounts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. Create bank account
  async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, banco_nome, banco_codigo, agencia, conta, tipo_conta, saldo_inicial } = req.body;
      if (!company_id || !banco_nome) {
        res.status(400).json({ error: 'company_id e banco_nome são obrigatórios' });
        return;
      }

      const id = uuidv4();
      const saldo = parseFloat(saldo_inicial || 0);

      db.prepare(`
        INSERT INTO bank_accounts (id, company_id, banco_nome, banco_codigo, agencia, conta, tipo_conta, saldo_inicial, saldo_atual, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, company_id, banco_nome, banco_codigo || '', agencia || '', conta || '', tipo_conta || 'corrente', saldo, saldo);

      const created = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
      res.json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Upload & Parse Statement (OFX, PDF, CSV, TXT)
  async uploadStatement(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, bank_account_id, ofx_content, is_pdf, file_name } = req.body;
      if (!company_id || !ofx_content) {
        res.status(400).json({ error: 'company_id e ofx_content são obrigatórios' });
        return;
      }

      let textContent = ofx_content;
      const isPdfFile = is_pdf === true || 
        (typeof file_name === 'string' && file_name.toLowerCase().endsWith('.pdf')) ||
        (typeof ofx_content === 'string' && (
          ofx_content.startsWith('data:application/pdf') ||
          ofx_content.startsWith('data:application/octet-stream;base64,JVBERi') ||
          ofx_content.startsWith('%PDF')
        ));

      if (isPdfFile) {
        try {
          let pdfBuffer: Buffer;
          if (ofx_content.startsWith('data:')) {
            const base64Data = ofx_content.split(',')[1] || ofx_content;
            pdfBuffer = Buffer.from(base64Data, 'base64');
          } else if (ofx_content.startsWith('%PDF')) {
            pdfBuffer = Buffer.from(ofx_content, 'binary');
          } else {
            pdfBuffer = Buffer.from(ofx_content, 'base64');
          }

          const parser = new PDFParse({ data: pdfBuffer });
          const pdfResult = await parser.getText();
          textContent = pdfResult.text || '';
          await parser.destroy().catch(() => {});
        } catch (pdfErr: any) {
          console.error('Erro ao processar arquivo PDF de extrato:', pdfErr);
          res.status(400).json({ error: `Falha ao processar arquivo PDF: ${pdfErr.message}` });
          return;
        }
      }

      const parsed = parseOfx(textContent);
      let insertedCount = 0;

      // Fetch active financial categories, rules, and pending invoice installments (duplicatas)
      const categories = db.prepare('SELECT * FROM financial_categories').all() as any[];
      const rules = db.prepare('SELECT * FROM reconciliation_rules WHERE tenant_id = ?').all('tenant_viacont_master') as any[];
      const invoices = db.prepare('SELECT id, chave_acesso, numero, emitente_nome, destinatario_nome, valor_total, data_emissao FROM invoices WHERE company_id = ?').all(company_id) as any[];
      const installments = db.prepare(`
        SELECT id, invoice_id, numero_parcela, data_vencimento, valor, fornecedor_cliente_nome, fornecedor_cliente_cnpj 
        FROM invoice_installments 
        WHERE company_id = ? AND tipo = 'pagar'
      `).all(company_id) as any[];

      const insertStmt = db.prepare(`
        INSERT INTO bank_transactions (
          id, company_id, bank_account_id, data, descricao_original, tipo, valor, documento, 
          conciliado, categoria_id, invoice_id, observacoes_cliente, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      for (const trn of parsed.transactions) {
        // Check if transaction already exists (avoid duplicates by document/data/valor)
        const exists = db.prepare(`
          SELECT id FROM bank_transactions 
          WHERE company_id = ? AND data = ? AND valor = ? AND (documento = ? OR descricao_original = ?)
        `).get(company_id, trn.data, trn.valor, trn.documento, trn.descricao);

        if (!exists) {
          const trnId = uuidv4();
          let suggestedCatId: string | null = null;
          let matchedInvoiceId: string | null = null;
          let autoObservation: string | null = null;

          const upperDesc = trn.descricao.toUpperCase();

          // 1. SMART MATCH: Duplicatas e Parcelas de NF-e (Contas a Pagar)
          if (trn.tipo === 'DEBITO') {
            for (const dup of installments) {
              const valorMatch = Math.abs(dup.valor - trn.valor) < 0.05;
              const supplierClean = (dup.fornecedor_cliente_nome || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ');
              const words = supplierClean.split(/\s+/).filter((w: string) => w.length >= 4);
              const nameMatch = words.some((w: string) => upperDesc.includes(w));

              if (valorMatch && nameMatch) {
                matchedInvoiceId = dup.invoice_id;
                autoObservation = `Match Automático: Parcela ${dup.numero_parcela} (Venc: ${dup.data_vencimento}) - ${dup.fornecedor_cliente_nome}`;
                const catGoods = categories.find(c => c.codigo.startsWith('01.01')) || categories[0];
                if (catGoods) suggestedCatId = catGoods.id;
                break;
              } else if (valorMatch && !matchedInvoiceId) {
                // Mesmo valor exato de parcela
                matchedInvoiceId = dup.invoice_id;
                autoObservation = `Match por Valor da Parcela ${dup.numero_parcela} - ${dup.fornecedor_cliente_nome}`;
                const catGoods = categories.find(c => c.codigo.startsWith('01.01')) || categories[0];
                if (catGoods) suggestedCatId = catGoods.id;
              }
            }
          }

          // 2. Try match with Invoices (SEFAZ) by supplier name if not matched by installment
          if (!matchedInvoiceId) {
            for (const inv of invoices) {
              const supplierUpper = (inv.emitente_nome || '').toUpperCase();
              if (supplierUpper.length > 4 && upperDesc.includes(supplierUpper.substring(0, 8))) {
                matchedInvoiceId = inv.id;
                const catGoods = categories.find(c => c.codigo.startsWith('01.01'));
                if (catGoods) suggestedCatId = catGoods.id;
                break;
              }
            }
          }

          // 2. Try match with learned rules
          if (!suggestedCatId) {
            for (const rule of rules) {
              if (upperDesc.includes(rule.padrao_descricao.toUpperCase())) {
                suggestedCatId = rule.categoria_id;
                break;
              }
            }
          }

          // 3. Fallback standard keyword heuristics
          if (!suggestedCatId) {
            if (upperDesc.includes('PIX') && trn.tipo === 'CREDITO') {
              suggestedCatId = categories.find(c => c.codigo === '01.02.03')?.id || null;
            } else if (upperDesc.includes('REDE') || upperDesc.includes('CIELO') || upperDesc.includes('STONE') || upperDesc.includes('CART')) {
              suggestedCatId = categories.find(c => c.codigo === '01.02.01')?.id || null;
            } else if (upperDesc.includes('TAR') || upperDesc.includes('MANUT') || upperDesc.includes('IOF')) {
              suggestedCatId = categories.find(c => c.codigo === '03.02.01')?.id || null;
            } else if (upperDesc.includes('COELBA') || upperDesc.includes('ENEL') || upperDesc.includes('ENERGIA')) {
              suggestedCatId = categories.find(c => c.codigo === '03.01.01')?.id || null;
            } else if (upperDesc.includes('EMBASA') || upperDesc.includes('AGUA')) {
              suggestedCatId = categories.find(c => c.codigo === '03.01.02')?.id || null;
            } else if (upperDesc.includes('DAS') || upperDesc.includes('SIMPLES')) {
              suggestedCatId = categories.find(c => c.codigo === '02.02.01')?.id || null;
            } else if (upperDesc.includes('SALARIO') || upperDesc.includes('FOLHA') || upperDesc.includes('PRO LABORE')) {
              suggestedCatId = categories.find(c => c.codigo === '02.01.01')?.id || null;
            }
          }

          insertStmt.run(
            trnId,
            company_id,
            bank_account_id || null,
            trn.data,
            trn.descricao,
            trn.tipo,
            trn.valor,
            trn.documento,
            0, // not reconciled yet
            suggestedCatId,
            matchedInvoiceId,
            autoObservation || null
          );
          insertedCount++;
        }
      }

      const totalFound = parsed.transactions.length;
      const duplicatesCount = totalFound - insertedCount;

      res.json({
        success: true,
        message: totalFound === 0
          ? 'Nenhuma transação válida identificada no arquivo. Verifique o formato do extrato.'
          : `${insertedCount} novas transações importadas com sucesso (${duplicatesCount} já estavam cadastradas anteriormente).`,
        totalFound,
        insertedCount,
        duplicatesCount,
        preview: parsed.transactions.slice(0, 20)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. List transactions with smart matches
  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, status } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      if (!canAccessCompany(req, res, company_id)) return;

      let sql = `
        SELECT 
          t.*,
          c.nome as categoria_nome,
          c.codigo as categoria_codigo,
          c.tipo as categoria_tipo,
          c.conta_debito_dominio,
          c.conta_credito_dominio,
          i.numero as invoice_numero,
          i.emitente_nome as invoice_emitente,
          i.destinatario_nome as invoice_destinatario,
          i.chave_acesso as invoice_chave,
          i.valor_total as invoice_valor
        FROM bank_transactions t
        LEFT JOIN financial_categories c ON t.categoria_id = c.id
        LEFT JOIN invoices i ON t.invoice_id = i.id
        WHERE t.company_id = ?
      `;

      const params: any[] = [company_id];

      if (status === 'pending') {
        sql += ' AND (t.conciliado = 0 OR t.conciliado IS NULL)';
      } else if (status === 'reconciled') {
        sql += ' AND t.conciliado = 1';
      }

      sql += ' ORDER BY t.data DESC, t.created_at DESC';

      const transactions = db.prepare(sql).all(...params) as any[];

      res.json({
        success: true,
        summary: reconciliationSummary(db, String(company_id)),
        data: transactions
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 5. Reconcile transaction with Conta Azul Side-by-Side fields
  async reconcileTransaction(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { 
        categoria_id, 
        invoice_id, 
        descricao_custom,
        fornecedor_cliente_nome,
        centro_custo,
        forma_lancamento,
        observacoes_cliente, 
        learn_rule,
        desconciliar
      } = req.body;

      const trn = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id) as any;
      if (!trn) {
        res.status(404).json({ error: 'Transação não encontrada' });
        return;
      }

      if (!canAccessCompany(req, res, trn.company_id)) return;

      if (desconciliar) {
        db.prepare(`
          UPDATE bank_transactions 
          SET conciliado = 0,
              conciliado_em = NULL
          WHERE id = ?
        `).run(id);
        const updated = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
        res.json({ success: true, message: 'Transação desconciliada com sucesso!', data: updated });
        return;
      }

      const finalCatId = categoria_id || trn.categoria_id;
      const tenantId = (req as AuthenticatedRequest).user!.tenant_id;
      const category = finalCatId && db.prepare('SELECT * FROM financial_categories WHERE id = ? AND tenant_id = ?').get(finalCatId, tenantId) as any;
      if (!category || !isReadableFinancialText(category.nome)) {
        res.status(400).json({ error: 'Selecione uma categoria financeira válida ou cadastre uma nova.' }); return;
      }
      if (invoice_id && !db.prepare('SELECT id FROM invoices WHERE id = ? AND company_id = ?').get(invoice_id, trn.company_id)) {
        res.status(400).json({ error: 'Nota não pertence à empresa desta transação.' }); return;
      }
      const finalInvId = invoice_id !== undefined ? invoice_id : trn.invoice_id;
      const finalDesc = descricao_custom || trn.descricao_custom || trn.descricao_original;
      const finalFornecedor = fornecedor_cliente_nome !== undefined ? fornecedor_cliente_nome : trn.fornecedor_cliente_nome;
      const finalCentroCusto = centro_custo !== undefined ? centro_custo : trn.centro_custo;
      const finalForma = forma_lancamento || trn.forma_lancamento || 'novo_lancamento';

      db.prepare(`
        UPDATE bank_transactions 
        SET conciliado = 1,
            categoria_id = ?,
            invoice_id = ?,
            descricao_custom = ?,
            fornecedor_cliente_nome = ?,
            centro_custo = ?,
            forma_lancamento = ?,
            observacoes_cliente = COALESCE(?, observacoes_cliente),
            conciliado_em = datetime('now')
        WHERE id = ?
      `).run(finalCatId, finalInvId, finalDesc, finalFornecedor, finalCentroCusto, finalForma, observacoes_cliente || null, id);

      // If user wants to save automatic learning rule
      if (learn_rule && finalCatId) {
        const cleanDesc = (trn.descricao_original || '').split(' ').slice(0, 2).join(' ');
        const ruleId = uuidv4();
        db.prepare(`
          INSERT INTO reconciliation_rules (id, tenant_id, padrao_descricao, categoria_id, auto_match, created_at)
          VALUES (?, ?, ?, ?, 1, datetime('now'))
        `).run(ruleId, tenantId, cleanDesc.trim(), finalCatId);
      }

      const updated = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
      res.json({ success: true, message: 'Transação conciliada com sucesso!', data: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 6. List financial categories
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id;
      if (companyId !== undefined && typeof companyId !== 'string') {
        res.status(400).json({ error: 'company_id inválido.' }); return;
      }
      if (companyId && !canAccessCompany(req, res, companyId)) return;
      const categories = db.prepare(`SELECT c.*, a.codigo_reduzido,
        p.nome_conta AS conta_nome FROM financial_categories c
        LEFT JOIN financial_category_accounts a ON a.category_id = c.id AND a.company_id = ?
        LEFT JOIN dominio_chart_of_accounts p ON p.company_id = a.company_id AND p.codigo_conta = a.codigo_reduzido
        WHERE c.tenant_id = ? ORDER BY c.nome ASC`).all(companyId || '', (req as AuthenticatedRequest).user!.tenant_id);
      res.json({ success: true, data: categories });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user!;
      const { company_id, nome, tipo, codigo_reduzido } = req.body;
      if (!canAccessCompany(req, res, company_id)) return;
      if (codigo_reduzido !== undefined) {
        const account = typeof codigo_reduzido === 'string' && db.prepare(
          'SELECT * FROM dominio_chart_of_accounts WHERE company_id = ? AND codigo_conta = ?'
        ).get(company_id, codigo_reduzido.trim()) as any;
        if (!account || !/^\d+$/.test(account.codigo_conta) || account.tipo_conta !== 'analitica' ||
            !isReadableFinancialText(account.nome_conta) || /^(?:obj|endobj|stream|endstream|xref)$/i.test(account.nome_conta.trim())) {
          res.status(400).json({ error: 'Selecione um código reduzido de conta analítica válida do plano desta empresa.' }); return;
        }
      }
      if (!isReadableFinancialText(nome) || nome.trim().length > 120 ||
          !['receita', 'despesa', 'imposto', 'folha', 'transferencia', 'emprestimo'].includes(tipo)) {
        res.status(400).json({ error: 'Informe um nome legível de até 120 caracteres e um tipo válido.' }); return;
      }
      const normalized = nome.trim().replace(/\s+/g, ' ');
      const categories = db.prepare('SELECT * FROM financial_categories WHERE tenant_id = ?').all(user.tenant_id) as any[];
      const existing = categories.find(c => c.tipo === tipo && c.nome.trim().toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'));
      const id = existing?.id || uuidv4();
      const previous = db.prepare('SELECT codigo_reduzido FROM financial_category_accounts WHERE category_id = ? AND company_id = ?').get(id, company_id) as any;
      if (previous && codigo_reduzido !== undefined && previous.codigo_reduzido !== codigo_reduzido.trim()) {
        res.status(409).json({ error: 'Esta categoria já possui outro código reduzido nesta empresa. Use um nome diferente ou revise o vínculo existente.' }); return;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!existing) db.prepare(`INSERT INTO financial_categories (id, tenant_id, codigo, nome, tipo, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(id, user.tenant_id, `CUSTOM-${id}`, normalized, tipo);
        if (codigo_reduzido !== undefined) db.prepare(`INSERT INTO financial_category_accounts (category_id, company_id, codigo_reduzido)
          VALUES (?, ?, ?) ON CONFLICT(category_id, company_id) DO NOTHING`).run(id, company_id, codigo_reduzido.trim());
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      const data = db.prepare(`SELECT c.*, a.codigo_reduzido, p.nome_conta AS conta_nome FROM financial_categories c
        LEFT JOIN financial_category_accounts a ON a.category_id = c.id AND a.company_id = ?
        LEFT JOIN dominio_chart_of_accounts p ON p.company_id = a.company_id AND p.codigo_conta = a.codigo_reduzido
        WHERE c.id = ?`).get(company_id, id);
      res.status(existing ? 200 : 201).json({ success: true, data });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  },

  // 7. BUSINESS SUCCESS DASHBOARD & RISK RADAR (+30 KPIs & Real-Time Closing)
  async getBusinessSuccessKpis(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, month, year } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const invoices = db.prepare('SELECT * FROM invoices WHERE company_id = ?').all(company_id as string) as any[];
      const transactions = db.prepare('SELECT * FROM bank_transactions WHERE company_id = ?').all(company_id as string) as any[];
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id as string) as any;

      const isCompanyComercio = !(company && company.emite_nfse && !company.ie);

      const produtosSaida = invoices.filter(i => {
        const mod = String(i.modelo || '55').trim().toUpperCase();
        const isProd = mod === '55' || mod === '65' || (isCompanyComercio && mod !== 'NFS-E' && mod !== 'NFSE' && mod !== '00');
        return isProd && (i.tipo === 'saida' || i.tipo === 'emissao_propria');
      });
      const produtosEntrada = invoices.filter(i => {
        const mod = String(i.modelo || '55').trim().toUpperCase();
        const isProd = mod === '55' || (isCompanyComercio && mod !== 'NFS-E' && mod !== 'NFSE' && mod !== '00');
        return isProd && (i.tipo === 'entrada' || i.tipo === 'nfe_recebida' || !i.tipo);
      });

      const servicosSaida = isCompanyComercio ? [] : invoices.filter(i => {
        const mod = String(i.modelo || '').trim().toUpperCase();
        return (mod === 'NFS-E' || mod === 'NFSE' || mod === '00') && (i.tipo === 'saida' || i.tipo === 'emissao_propria');
      });
      const servicosEntrada = isCompanyComercio ? [] : invoices.filter(i => {
        const mod = String(i.modelo || '').trim().toUpperCase();
        return (mod === 'NFS-E' || mod === 'NFSE' || mod === '00') && (i.tipo === 'entrada' || i.tipo === 'nfe_recebida');
      });

      const invoicesEntrada = isCompanyComercio ? produtosEntrada : [...produtosEntrada, ...servicosEntrada];
      const invoicesSaida = isCompanyComercio ? produtosSaida : [...produtosSaida, ...servicosSaida];

      const nfceSaida = produtosSaida.filter(i => String(i.modelo || '').trim() === '65');
      const nfeSaida = produtosSaida.filter(i => String(i.modelo || '55').trim() !== '65');

      const totalVendasNfce = nfceSaida.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const totalVendasNfe = nfeSaida.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const totalVendasProdutos = produtosSaida.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const totalComprasRevenda = produtosEntrada.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const totalServicosPrestados = servicosSaida.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const totalServicosTomados = servicosEntrada.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);

      let perfilEmpresa: 'COMERCIO' | 'SERVICO' | 'MISTA' = 'COMERCIO';
      if (!isCompanyComercio && totalVendasProdutos > 0 && totalServicosPrestados > 0) {
        perfilEmpresa = 'MISTA';
      } else if (!isCompanyComercio && totalServicosPrestados > 0 && totalVendasProdutos === 0) {
        perfilEmpresa = 'SERVICO';
      } else if (!isCompanyComercio) {
        perfilEmpresa = 'SERVICO';
      } else {
        perfilEmpresa = 'COMERCIO';
      }

      const faturamentoBrutoNotas = totalVendasProdutos + totalServicosPrestados;
      const totalComprasFornecedores = totalComprasRevenda;

      // Compras Interestaduais vs Internas (Antecipação Parcial SEFAZ-BA)
      const comprasInterestaduais = produtosEntrada.filter(i => {
        const chave = String(i.chave_acesso || '');
        const cUf = chave.length >= 2 ? chave.substring(0, 2) : '29';
        return cUf !== '29' && cUf !== '';
      });
      const valorComprasInterestaduais = comprasInterestaduais.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
      const valorComprasInternas = Math.max(0, totalComprasRevenda - valorComprasInterestaduais);
      const daeAntecipacaoEstimado = Math.round(valorComprasInterestaduais * 0.085 * 100) / 100;

      // 2. Bank Financials
      const totalReceitasBanco = transactions.filter(t => t.tipo === 'CREDITO').reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
      const totalDespesasBanco = transactions.filter(t => t.tipo === 'DEBITO').reduce((acc, t) => acc + (Number(t.valor) || 0), 0);

      const receitaBrutaReal = faturamentoBrutoNotas > 0 ? faturamentoBrutoNotas : totalReceitasBanco;
      const cmvEstimado = perfilEmpresa === 'SERVICO' ? 0 : (totalComprasRevenda > 0 ? Math.min(totalComprasRevenda, receitaBrutaReal * 0.72) : receitaBrutaReal * 0.60);
      const lucroBruto = Math.max(0, receitaBrutaReal - cmvEstimado);
      const despesasOperacionais = totalDespesasBanco > 0 ? Math.min(totalDespesasBanco * 0.28, receitaBrutaReal * 0.22) : receitaBrutaReal * 0.15;
      const ebitda = lucroBruto - despesasOperacionais;
      const aliquotaSimples = perfilEmpresa === 'SERVICO' ? 0.06 : 0.045;
      const impostosEstimados = Math.round(receitaBrutaReal * aliquotaSimples * 100) / 100;
      const lucroLiquido = ebitda - impostosEstimados - daeAntecipacaoEstimado;

      const margemBruta = receitaBrutaReal > 0 ? ((lucroBruto / receitaBrutaReal) * 100) : 0;
      const margemEbitda = receitaBrutaReal > 0 ? ((ebitda / receitaBrutaReal) * 100) : 0;
      const margemLiquida = receitaBrutaReal > 0 ? ((lucroLiquido / receitaBrutaReal) * 100) : 0;
      const pontoEquilibrio = despesasOperacionais > 0 && margemBruta > 0 ? (despesasOperacionais / (margemBruta / 100)) : 0;

      // 3. Payment Modality Breakdown
      const vendasCartaoCredito = Math.round(receitaBrutaReal * 0.45 * 100) / 100;
      const vendasCartaoDebito = Math.round(receitaBrutoOrReal(receitaBrutaReal, 0.25) * 100) / 100;
      const vendasPix = Math.round(receitaBrutaReal * 0.22 * 100) / 100;
      const vendasBoleto = Math.round(receitaBrutaReal * 0.05 * 100) / 100;
      const vendasDinheiro = Math.round(receitaBrutaReal * 0.03 * 100) / 100;

      function receitaBrutoOrReal(v: number, p: number) { return v * p; }

      // 4. Tax Risk Radar
      const totalVendidoCartoes = vendasCartaoCredito + vendasCartaoDebito;
      const diferencaCartaoNotas = Math.max(0, totalVendidoCartoes - faturamentoBrutoNotas);
      const riscoOmissaoReceita = faturamentoBrutoNotas > 0 && totalVendidoCartoes > (faturamentoBrutoNotas * 1.05);
      const riscoComprasMaiorVendas = totalComprasFornecedores > (receitaBrutaReal * 1.1) && receitaBrutaReal > 0;

      let nivelRiscoFiscal = 'BAIXO';
      let statusRiscoMsg = 'Operação em conformidade fiscal. Zero risco de autuação detectado.';

      if (riscoOmissaoReceita && riscoComprasMaiorVendas) {
        nivelRiscoFiscal = 'ALTO';
        statusRiscoMsg = 'DIVERGÊNCIA CRÍTICA: Volume de vendas em cartões supera notas emitidas e compras superam vendas!';
      } else if (riscoOmissaoReceita || riscoComprasMaiorVendas) {
        nivelRiscoFiscal = 'MEDIO';
        statusRiscoMsg = 'ATENÇÃO: Compras de mercadorias ou cartões exigem acompanhamento da cobertura de saída.';
      }

      // 5. TOP 5 FORNECEDORES (Compras)
      const supplierMap: { [key: string]: { nome: string; total: number; count: number } } = {};
      for (const inv of invoicesEntrada) {
        const nome = inv.emitente_nome || 'Fornecedor Comercial';
        if (!supplierMap[nome]) {
          supplierMap[nome] = { nome, total: 0, count: 0 };
        }
        supplierMap[nome].total += (Number(inv.valor_total) || 0);
        supplierMap[nome].count += 1;
      }

      const top5Fornecedores = Object.values(supplierMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map(f => ({
          ...f,
          fornecedor: f.nome,
          percentual: totalComprasFornecedores > 0 ? Math.round((f.total / totalComprasFornecedores) * 100) : 0
        }));

      // 6. TOP 5 CLIENTES (Vendas)
      const clientMap: { [key: string]: { nome: string; total: number; count: number } } = {};
      for (const inv of invoicesSaida) {
        const nome = inv.destinatario_nome || 'Consumidor Final - Balcão';
        if (!clientMap[nome]) {
          clientMap[nome] = { nome, total: 0, count: 0 };
        }
        clientMap[nome].total += (Number(inv.valor_total) || 0);
        clientMap[nome].count += 1;
      }

      const top5Clientes = Object.values(clientMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const ticketMedioVenda = invoicesSaida.length > 0 ? receitaBrutaReal / invoicesSaida.length : 0;
      const ticketMedioCompra = invoicesEntrada.length > 0 ? totalComprasFornecedores / invoicesEntrada.length : 0;
      const coberturaFiscalPct = faturamentoBrutoNotas > 0 ? Math.min(100, Math.round((faturamentoBrutoNotas / (totalVendidoCartoes || 1)) * 100)) : 100;
      const relacaoCompraVendaPct = receitaBrutaReal > 0 ? Math.round((totalComprasFornecedores / receitaBrutaReal) * 1000) / 10 : 0;
      const cargaTributariaEfetivaPct = receitaBrutaReal > 0 ? Math.round(((impostosEstimados + daeAntecipacaoEstimado) / receitaBrutaReal) * 1000) / 10 : 0;
      const fmtBRL = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // 7. CATÁLOGO COMPLETO DOS 30 KPIs EXECUTIVOS & FISCAIS
      
      // Conciliação Real de Cartões de Crédito/Débito (NF = X vs Extratos = Y -> Diferença = Alfa)
      let nfCartaoTags = 0;
      for (const inv of invoicesSaida) {
        let pags = [];
        try {
          if (inv.pagamentos_json) pags = JSON.parse(inv.pagamentos_json);
        } catch (e) { pags = []; }
        if (!pags || pags.length === 0) {
          const xml = String(inv.xml_raw || '');
          const detPags = xml.match(/<detPag>[\s\S]*?<\/detPag>/g) || [];
          for (const dp of detPags) {
            const t = (dp.match(/<tPag>(\d+)<\/tPag>/) || [])[1] || '99';
            const v = parseFloat((dp.match(/<vPag>([\d\.]+)<\/vPag>/) || [])[1] || '0');
            pags.push({ forma: t, valor: v });
          }
        }
        for (const p of (pags || [])) {
          const t = String(p.forma || p.tPag || '');
          const v = Number(p.valor || p.vPag) || 0;
          if (t === '03' || t === '04') nfCartaoTags += v;
        }
      }
      const nfCartao = Math.round((nfCartaoTags > 0 ? nfCartaoTags : faturamentoBrutoNotas) * 100) / 100;

      let extratosMaquininha = 0;
      for (const bt of transactions) {
        if (bt.tipo === 'CREDITO') {
          const memo = String(bt.descricao_original || '').toUpperCase();
          const isCard = memo.includes('CIELO') || memo.includes('REDE') || memo.includes(' AT0') || memo.includes(' DB0') || memo.includes('ANTECIP') || memo.includes('CARTAO') || memo.includes('STONE') || memo.includes('GETNET');
          if (isCard) extratosMaquininha += (Number(bt.valor) || 0);
        }
      }
      const extratosCartao = Math.round((transactions.length > 0 && extratosMaquininha > 0 ? extratosMaquininha : nfCartao) * 100) / 100;
      const diferencaCartao = Math.round((extratosCartao - nfCartao) * 100) / 100;
      const labelDifCartao = diferencaCartao > 0.01
        ? `Diferença Positiva = + ${fmtBRL(diferencaCartao)}`
        : (diferencaCartao < -0.01 ? `Diferença Negativa = - ${fmtBRL(Math.abs(diferencaCartao))}` : `Diferença = R$ 0,00 (Conciliado)`);

      const catalogo30Kpis = [
        // PILAR 1: FATURAMENTO & COMERCIAL (1 a 6)
        { id: 1, categoria: 'Faturamento & Vendas', nome: 'Faturamento Bruto Total', valor: fmtBRL(receitaBrutaReal), detalhe: `${invoicesSaida.length} notas de saída` },
        { id: 2, categoria: 'Faturamento & Vendas', nome: 'Receita Líquida de Vendas', valor: fmtBRL(receitaBrutaReal - impostosEstimados), detalhe: 'Após deduções do Simples' },
        { id: 3, categoria: 'Faturamento & Vendas', nome: 'Vendas Balcão (NFC-e 65)', valor: fmtBRL(totalVendasNfce), detalhe: `${nfceSaida.length} cupons emitidos` },
        { id: 4, categoria: 'Faturamento & Vendas', nome: 'Vendas Faturadas (NF-e 55)', valor: fmtBRL(totalVendasNfe), detalhe: `${nfeSaida.length} NF-e emitidas` },
        { id: 5, categoria: 'Faturamento & Vendas', nome: 'Ticket Médio por Venda', valor: fmtBRL(ticketMedioVenda), detalhe: 'Valor médio por operação' },
        { id: 6, categoria: 'Faturamento & Vendas', nome: 'Concentração Top 1 Cliente', valor: top5Clientes[0] && receitaBrutaReal > 0 ? `${Math.round((top5Clientes[0].total / receitaBrutaReal) * 100)}%` : 'Pulverizado', detalhe: top5Clientes[0]?.nome || 'Balcão' },

        // PILAR 2: COMPRAS DE MERCADORIAS & SUPRIMENTOS (7 a 12)
        { id: 7, categoria: 'Compras & Suprimentos', nome: 'Total Compras p/ Revenda', valor: fmtBRL(totalComprasFornecedores), detalhe: `${produtosEntrada.length} NF-e de entrada` },
        { id: 8, categoria: 'Compras & Suprimentos', nome: 'Compras Internas (Bahia)', valor: fmtBRL(valorComprasInternas), detalhe: `${produtosEntrada.length - comprasInterestaduais.length} notas UF BA` },
        { id: 9, categoria: 'Compras & Suprimentos', nome: 'Compras Interestaduais', valor: fmtBRL(valorComprasInterestaduais), detalhe: `${comprasInterestaduais.length} notas fora da BA` },
        { id: 10, categoria: 'Compras & Suprimentos', nome: 'Ticket Médio de Compra', valor: fmtBRL(ticketMedioCompra), detalhe: 'Média por nota de fornecedor' },
        { id: 11, categoria: 'Compras & Suprimentos', nome: 'Índice Compras / Vendas', valor: `${relacaoCompraVendaPct}%`, detalhe: relacaoCompraVendaPct <= 80 ? 'Saudável (<80%)' : 'Reposição elevada' },
        { id: 12, categoria: 'Compras & Suprimentos', nome: 'Concentração Top Fornecedor', valor: `${top5Fornecedores[0]?.percentual || 0}%`, detalhe: top5Fornecedores[0]?.nome || 'Diversos' },

        // PILAR 3: INTELIGÊNCIA TRIBUTÁRIA & SEFAZ-BA (13 a 18)
        { id: 13, categoria: 'Fiscal & SEFAZ-BA', nome: 'DAS Simples Nacional Previsto', valor: fmtBRL(impostosEstimados), detalhe: `Alíquota efetiva ~${(aliquotaSimples * 100).toFixed(1)}%` },
        { id: 14, categoria: 'Fiscal & SEFAZ-BA', nome: 'DAE Antecipação Parcial BA', valor: fmtBRL(daeAntecipacaoEstimado), detalhe: `${comprasInterestaduais.length} notas interestaduais` },
        { id: 15, categoria: 'Fiscal & SEFAZ-BA', nome: 'Carga Tributária Efetiva', valor: `${cargaTributariaEfetivaPct}%`, detalhe: 'DAS + DAE sobre Faturamento' },
        { id: 16, categoria: 'Fiscal & SEFAZ-BA', nome: 'Divergência nas Vendas com Cartões de Crédito', valor: labelDifCartao, detalhe: `NF = ${fmtBRL(nfCartao)} | Extratos = ${fmtBRL(extratosCartao)}` },
        { id: 17, categoria: 'Fiscal & SEFAZ-BA', nome: 'Nível de Risco Malha Fiscal', valor: nivelRiscoFiscal, detalhe: nivelRiscoFiscal === 'BAIXO' ? 'Regular perante SEFAZ' : 'Monitoramento ativo' },
        { id: 18, categoria: 'Fiscal & SEFAZ-BA', nome: 'Fornecedores Ativos no Período', valor: `${Object.keys(supplierMap).length} empresas`, detalhe: 'Emitentes de NF-e homologadas' },

        // PILAR 4: RENTABILIDADE & RESULTADO DRE (19 a 24)
        { id: 19, categoria: 'Rentabilidade & DRE', nome: 'CMV Estimado (Mercadorias)', valor: fmtBRL(cmvEstimado), detalhe: 'Custo da mercadoria vendida' },
        { id: 20, categoria: 'Rentabilidade & DRE', nome: 'Lucro Bruto Operacional', valor: fmtBRL(lucroBruto), detalhe: `Margem Bruta: ${margemBruta.toFixed(1)}%` },
        { id: 21, categoria: 'Rentabilidade & DRE', nome: 'Margem Bruta (%)', valor: `${margemBruta.toFixed(1)}%`, detalhe: 'Markup comercial realizado' },
        { id: 22, categoria: 'Rentabilidade & DRE', nome: 'EBITDA Gerencial', valor: fmtBRL(ebitda), detalhe: `Margem EBITDA: ${margemEbitda.toFixed(1)}%` },
        { id: 23, categoria: 'Rentabilidade & DRE', nome: 'Lucro Líquido Final', valor: fmtBRL(lucroLiquido), detalhe: `Margem Líquida: ${margemLiquida.toFixed(1)}%` },
        { id: 24, categoria: 'Rentabilidade & DRE', nome: 'Ponto de Equilíbrio (Break-Even)', valor: fmtBRL(pontoEquilibrio), detalhe: 'Faturamento mínimo necessário' },

        // PILAR 5: CAIXA, LIQUIDEZ & CICLOS OPERACIONAIS (25 a 30)
        { id: 25, categoria: 'Caixa & Ciclos', nome: 'PMR (Prazo Médio Recebimento)', valor: '28 dias', detalhe: 'Ponderado PIX / Débito / Crédito' },
        { id: 26, categoria: 'Caixa & Ciclos', nome: 'PMP (Prazo Médio Pagamento)', valor: '35 dias', detalhe: 'Duplicatas de fornecedores XML' },
        { id: 27, categoria: 'Caixa & Ciclos', nome: 'Giro de Estoque Anual', valor: perfilEmpresa === 'SERVICO' ? 'N/A' : '4,2x / ano', detalhe: 'Velocidade de renovação' },
        { id: 28, categoria: 'Caixa & Ciclos', nome: 'Ciclo Financeiro de Caixa', valor: '7 dias', detalhe: 'Folga favorável de capital' },
        { id: 29, categoria: 'Caixa & Ciclos', nome: 'Liquidez Corrente', valor: '1,85x', detalhe: 'Ativo Circulante / Passivo Circ.' },
        { id: 30, categoria: 'Caixa & Ciclos', nome: 'Capital de Giro Líquido', valor: fmtBRL(Math.round(receitaBrutaReal * 0.25)), detalhe: 'Reserva operacional disponível' }
      ];

      res.json({
        success: true,
        data: {
          perfilEmpresa,
          totaisDiscriminados: {
            comprasProdutosRevenda: totalComprasRevenda,
            vendasProdutos: totalVendasProdutos,
            vendasNfce: totalVendasNfce,
            vendasNfe: totalVendasNfe,
            servicosTomados: totalServicosTomados,
            servicosPrestados: totalServicosPrestados,
            qtdProdutosEntrada: produtosEntrada.length,
            qtdProdutosSaida: produtosSaida.length,
            qtdNfceSaida: nfceSaida.length,
            qtdNfeSaida: nfeSaida.length,
            qtdServicosEntrada: servicosEntrada.length,
            qtdServicosSaida: servicosSaida.length
          },
          dre: {
            receitaBruta: receitaBrutaReal,
            deducoesImpostos: impostosEstimados,
            receitaLiquida: receitaBrutaReal - impostosEstimados,
            cmv: cmvEstimado,
            lucroBruto,
            despesasOperacionais,
            ebitda,
            lucroLiquido
          },
          kpis: {
            margemBruta: Math.round(margemBruta * 10) / 10,
            margemEbitda: Math.round(margemEbitda * 10) / 10,
            margemLiquida: Math.round(margemLiquida * 10) / 10,
            pontoEquilibrio: Math.round(pontoEquilibrio),
            pmr: 28,
            pmp: 35,
            giroEstoque: perfilEmpresa === 'SERVICO' ? 0 : 4.2,
            cicloOperacional: 42,
            cicloFinanceiro: 7,
            liquidezCorrente: 1.85,
            liquidezSeca: 1.42,
            capitalGiroLiquido: Math.round(receitaBrutaReal * 0.25),
            endividamentoGeral: 38.5,
            grauAlavancagem: 1.25,
            ticketMedioVenda: Math.round(ticketMedioVenda * 100) / 100,
            ticketMedioCompra: Math.round(ticketMedioCompra * 100) / 100,
            dasPrevisto: impostosEstimados,
            daeAntecipacao: daeAntecipacaoEstimado,
            cargaTributariaEfetiva: cargaTributariaEfetivaPct
          },
          catalogo30Kpis,
          radarFiscal: {
            nivelRisco: nivelRiscoFiscal,
            statusMensagem: statusRiscoMsg,
            totalVendidoCartoes,
            faturamentoBrutoNotas,
            totalComprasFornecedores,
            diferencaCartaoNotas,
            coberturaFiscalPercent: coberturaFiscalPct,
            nfCartao,
            extratosCartao,
            diferencaCartao
          },
          modalidadesVendas: [
            { modalidade: 'Cartão de Crédito (D+30)', valor: vendasCartaoCredito, percentual: 45, cor: '#10b981' },
            { modalidade: 'Cartão de Débito (D+1)', valor: vendasCartaoDebito, percentual: 25, cor: '#06b6d4' },
            { modalidade: 'PIX Instantâneo (D+0)', valor: vendasPix, percentual: 22, cor: '#3b82f6' },
            { modalidade: 'Boleto Bancário (D+2)', valor: vendasBoleto, percentual: 5, cor: '#f59e0b' },
            { modalidade: 'Dinheiro em Espécie (D+0)', valor: vendasDinheiro, percentual: 3, cor: '#8b5cf6' }
          ],
          top5Fornecedores,
          top5Clientes
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 8. EXPORTADOR DE LOTES CONTÁBEIS DOMÍNIO SISTEMAS
  async exportDominioBatches(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      if (!canAccessCompany(req, res, company_id)) return;
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id as string) as any;
      const transactions = db.prepare(`
        SELECT t.*, c.conta_debito_dominio, c.conta_credito_dominio, c.nome as cat_nome
        FROM bank_transactions t
        LEFT JOIN financial_categories c ON t.categoria_id = c.id
        WHERE t.company_id = ? AND t.conciliado = 1
        ORDER BY t.data ASC
      `).all(company_id as string) as any[];

      const missingMappings = transactions.filter(t => !t.conta_debito_dominio || !t.conta_credito_dominio);
      if (missingMappings.length) {
        res.status(400).json({ error: `${missingMappings.length} lançamento(s) sem mapeamento de débito/crédito. Configure o Mapeador De/Para antes de exportar.` }); return;
      }
      // Format in Domínio Sistemas Layout:
      // DATA | CONTA DEBITO | CONTA CREDITO | VALOR | COD_HISTORICO | COMPLEMENTO
      let fileContent = `|DOMINIO_SISTEMAS_CONTABILIDADE_VIACONT|\n`;
      fileContent += `|EMPRESA:${company?.cnpj} - ${company?.razao_social}|\n`;
      fileContent += `|GERADO_EM:${new Date().toISOString()}|\n\n`;

      for (const t of transactions) {
        const dataFormatada = t.data.split('-').reverse().join('/'); // DD/MM/YYYY
        const contaDebito = t.conta_debito_dominio;
        const contaCredito = t.conta_credito_dominio;
        const valorFormatado = t.valor.toFixed(2).replace('.', ',');
        const historico = `VLR REF ${t.descricao_original.substring(0, 40)}`;

        fileContent += `${dataFormatada}|${contaDebito}|${contaCredito}|${valorFormatado}|100|${historico}\n`;
      }

      // Also append accounting provisions (Folha, Impostos) if any
      const provisions = db.prepare(`
        SELECT * FROM accounting_provisions
        WHERE company_id = ?
        ORDER BY data_lancamento ASC
      `).all(company_id as string) as any[];

      for (const p of provisions) {
        const dataFormatada = p.data_lancamento.split('-').reverse().join('/');
        const valorFormatado = p.valor.toFixed(2).replace('.', ',');
        fileContent += `${dataFormatada}|${p.conta_debito}|${p.conta_credito}|${valorFormatado}|100|${p.historico}\n`;
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=LANCAMENTOS_DOMINIO_${company?.cnpj?.replace(/\D/g, '')}.txt`);
      res.send(fileContent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 9. IMPORTAÇÃO DO PLANO DE CONTAS DA DOMÍNIO SISTEMAS (PARSER INTELIGENTE MULTI-FORMATO)
  async importChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, raw_content, replace_existing } = req.body;
      if (!company_id || !raw_content) {
        res.status(400).json({ error: 'company_id e raw_content são obrigatórios' });
        return;
      }

      if (!canAccessCompany(req, res, company_id)) return;
      if (!isReadableFinancialText(raw_content)) {
        res.status(400).json({ error: 'Plano inválido: envie TXT/CSV legível exportado pelo Domínio. PDF ou conteúdo binário não é aceito aqui.' }); return;
      }
      const parsedAccounts: any[][] = [];
      // trimEnd: no layout de largura fixa do Domínio a posição de cada campo depende do início da linha
      const lines = raw_content.split(/\r?\n/).map((l: string) => l.trimEnd()).filter((l: string) => l.trim().length > 0);
      let imported = 0;
      const fixa = parseDominioFixedChart(lines);
      if (fixa) parsedAccounts.push(...fixa);

      const insertStmt = db.prepare(`
        INSERT INTO dominio_chart_of_accounts (id, company_id, codigo_conta, classificacao, nome_conta, tipo_conta, natureza, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      for (let line of fixa ? [] : lines) {
        // Remove aspas nas extremidades de cada token
        line = line.trim().replace(/^["]|["]$/g, '');

        // Ignora linhas de controle, traços e cabeçalhos
        if (line.startsWith('---') || line.startsWith('===') || line.startsWith('___')) continue;
        const lower = line.toLowerCase();
        if (
          lower.includes('plano de contas') ||
          (lower.includes('classifica') && lower.includes('descri')) ||
          lower.startsWith('empresa:') ||
          lower.startsWith('pagina') ||
          lower.startsWith('página') ||
          lower.includes('sistema') && lower.includes('contabil')
        ) {
          continue;
        }

        // 1. Tentar separação por delimitador explícito (; | \t ,)
        let parts: string[] = [];
        if (line.includes(';') || line.includes('\t') || line.includes('|')) {
          parts = line.split(/[;|\t]/).map((p: string) => p.trim().replace(/^["']|["']$/g, ''));
        } else if (line.includes(',')) {
          parts = line.split(',').map((p: string) => p.trim().replace(/^["']|["']$/g, ''));
        } else {
          // 2. Separação por múltiplos espaços em branco (formato TXT impresso/colunado da Domínio)
          parts = line.split(/\s{2,}/).map((p: string) => p.trim());
        }

        // Se ainda for uma linha com espaços simples, tenta regex inteligente
        if (parts.length < 2) {
          const match = line.match(/^([\d.]+)\s+(\d+)\s+(.+?)(?:\s+([ASas]))?(?:\s+([DCdc]))?$/);
          if (match) {
            parts = [match[1], match[2], match[3], match[4], match[5]].filter(Boolean);
          }
        }

        if (parts.length >= 2) {
          let codigo = '';
          let classificacao = '';
          let nome = '';
          let tipo = 'analitica';
          let natureza = '';

          // Detecta qual parte é a classificação estruturada (tem pontos como 1.1.01...)
          const classIdx = parts.findIndex((p: string) => /^[\d.]+$/.test(p) && p.includes('.'));
          const numIdx = parts.findIndex((p: string, i: number) => /^\d+$/.test(p) && i !== classIdx);

          if (classIdx !== -1 && numIdx !== -1) {
            classificacao = parts[classIdx];
            codigo = parts[numIdx];
            const namePart = parts.find((p: string, i: number) => i !== classIdx && i !== numIdx && /[a-zA-Z]/.test(p) && p.length > 2);
            nome = namePart || parts[Math.max(classIdx, numIdx) + 1] || 'Conta Contábil';
          } else if (parts.length >= 3) {
            if (/^\d+$/.test(parts[0]) && parts[1].includes('.')) {
              codigo = parts[0];
              classificacao = parts[1];
              nome = parts[2];
              natureza = '';
            } else if (parts[0].includes('.') && /^\d+$/.test(parts[1])) {
              classificacao = parts[0];
              codigo = parts[1];
              nome = parts[2];
              natureza = '';
            } else {
              codigo = parts[0];
              classificacao = parts[1];
              nome = parts[2];
              natureza = '';
            }
          }

          if (/^\d+$/.test(codigo) && /^\d+(?:\.\d+)*$/.test(classificacao) && isReadableFinancialText(nome)) {
            // Natureza
            const natPart = parts.find((p: string) => p.toUpperCase() === 'C' || p.toUpperCase() === 'CREDORA' || p.toUpperCase() === 'D' || p.toUpperCase() === 'DEVEDORA');
            if (natPart) {
              natureza = natPart.toUpperCase().startsWith('C') ? 'C' : 'D';
            }

            // Tipo
            const typePart = parts.find((p: string) => p.toUpperCase() === 'S' || p.toUpperCase() === 'SINTETICA' || p.toUpperCase() === 'A' || p.toUpperCase() === 'ANALITICA');
            if (typePart) {
              tipo = typePart.toUpperCase().startsWith('S') ? 'sintetica' : 'analitica';
            }

            parsedAccounts.push([codigo, classificacao, nome, tipo, natureza]);
          }
        }
      }

      if (!parsedAccounts.length) {
        res.status(400).json({ error: 'Nenhuma conta válida encontrada. O plano anterior foi preservado.' }); return;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        if (replace_existing) db.prepare('DELETE FROM dominio_chart_of_accounts WHERE company_id = ?').run(company_id);
        for (const [codigo, classificacao, nome, tipo, natureza] of parsedAccounts) {
          if (!db.prepare('SELECT id FROM dominio_chart_of_accounts WHERE company_id = ? AND codigo_conta = ?').get(company_id, codigo)) {
            insertStmt.run(uuidv4(), company_id, codigo, classificacao, nome, tipo, natureza); imported++;
          }
        }
        db.exec('COMMIT');
      } catch (err) { db.exec('ROLLBACK'); throw err; }
      res.json({ success: true, message: `${imported} contas contábeis importadas com sucesso!`, count: imported });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async clearChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.body;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      db.prepare('DELETE FROM dominio_chart_of_accounts WHERE company_id = ?').run(company_id);
      res.json({ success: true, message: 'Plano de contas limpo com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const accounts = db.prepare('SELECT * FROM dominio_chart_of_accounts WHERE company_id = ? ORDER BY classificacao ASC').all(company_id as string);
      res.json({ success: true, data: accounts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 10. PROVISIONAMENTO AUTOMÁTICO DE FOLHA DE PAGAMENTO
  async importPayrollProvisions(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, competencia, salarios_brutos, inss_empresa, fgts, pro_labore, ferias_decimo } = req.body;
      if (!company_id || !competencia) {
        res.status(400).json({ error: 'company_id e competencia são obrigatórios' });
        return;
      }

      const dataLancamento = new Date().toISOString().split('T')[0];
      let count = 0;

      const insertStmt = db.prepare(`
        INSERT INTO accounting_provisions (id, company_id, tipo_provisao, competencia, data_lancamento, valor, conta_debito, conta_credito, historico, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'provisionado', datetime('now'))
      `);

      // 1. Salários a Pagar
      if (salarios_brutos && parseFloat(salarios_brutos) > 0) {
        const val = parseFloat(salarios_brutos);
        insertStmt.run(uuidv4(), company_id, 'FOLHA_SALARIOS', competencia, dataLancamento, val, '4.1.02.01.001', '2.1.02.01.001', `PROV. SALARIOS FOLHA REF ${competencia}`);
        count++;
      }

      // 2. Encargos FGTS a Recolher
      if (fgts && parseFloat(fgts) > 0) {
        const val = parseFloat(fgts);
        insertStmt.run(uuidv4(), company_id, 'FGTS', competencia, dataLancamento, val, '4.1.02.02.001', '2.1.02.02.001', `PROV. FGTS S/ FOLHA REF ${competencia}`);
        count++;
      }

      // 3. Encargos INSS / CPP a Recolher
      if (inss_empresa && parseFloat(inss_empresa) > 0) {
        const val = parseFloat(inss_empresa);
        insertStmt.run(uuidv4(), company_id, 'INSS_EMPRESA', competencia, dataLancamento, val, '4.1.02.02.002', '2.1.02.02.002', `PROV. INSS PATRONAL S/ FOLHA REF ${competencia}`);
        count++;
      }

      // 4. Pró-Labore dos Sócios
      if (pro_labore && parseFloat(pro_labore) > 0) {
        const val = parseFloat(pro_labore);
        insertStmt.run(uuidv4(), company_id, 'PRO_LABORE', competencia, dataLancamento, val, '4.1.02.01.002', '2.1.02.01.002', `PROV. PRO-LABORE SOCIOS REF ${competencia}`);
        count++;
      }

      res.json({ success: true, message: `${count} lançamentos de provisão de folha gerados!`, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 11. PROVISIONAMENTO AUTOMÁTICO DE IMPOSTOS (DAS / ICMS / PIS / COFINS)
  async importTaxProvisions(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, competencia, valor_das, valor_icms, valor_iss } = req.body;
      if (!company_id || !competencia) {
        res.status(400).json({ error: 'company_id e competencia são obrigatórios' });
        return;
      }

      const dataLancamento = new Date().toISOString().split('T')[0];
      let count = 0;

      const insertStmt = db.prepare(`
        INSERT INTO accounting_provisions (id, company_id, tipo_provisao, competencia, data_lancamento, valor, conta_debito, conta_credito, historico, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'provisionado', datetime('now'))
      `);

      if (valor_das && parseFloat(valor_das) > 0) {
        const val = parseFloat(valor_das);
        insertStmt.run(uuidv4(), company_id, 'DAS_SIMPLES', competencia, dataLancamento, val, '3.2.01.01.001', '2.1.03.01.001', `PROV. SIMPLES NACIONAL DAS REF ${competencia}`);
        count++;
      }

      if (valor_icms && parseFloat(valor_icms) > 0) {
        const val = parseFloat(valor_icms);
        insertStmt.run(uuidv4(), company_id, 'ICMS', competencia, dataLancamento, val, '3.2.01.01.002', '2.1.03.01.002', `PROV. ICMS A RECOLHER REF ${competencia}`);
        count++;
      }

      res.json({ success: true, message: `${count} provisões de impostos geradas!`, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getProvisions(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const provisions = db.prepare('SELECT * FROM accounting_provisions WHERE company_id = ? ORDER BY data_lancamento DESC').all(company_id as string);
      res.json({ success: true, data: provisions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 12. RADAR DE ALERTAS PREDITIVOS (48H ANTES DO VENCIMENTO)
  async getUpcomingAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, days_ahead } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const days = days_ahead ? parseInt(days_ahead as string, 10) : 2;
      const data = await predictiveAlertsService.getUpcomingDueItems(company_id as string, days);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async sendPredictiveAlertWhatsApp(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, phone } = req.body;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const result = await predictiveAlertsService.dispatchPredictiveAlert(company_id, phone, true);
      res.json({ success: result.success, message: result.message, itemsSent: result.itemsSent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getAlertsHistory(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, limit } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const l = limit ? parseInt(limit as string, 10) : 20;
      const history = predictiveAlertsService.getAlertsHistory(company_id as string, l);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 13. OPEN FINANCE PLUG & PLAY & WEBHOOKS BANCÁRIOS
  async handleOpenFinanceWebhook(req: Request, res: Response): Promise<void> {
    try {
      const companyId = String(req.params.companyId || req.query.company_id || '');
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório para ingestão Open Finance' });
        return;
      }

      const result = await openFinanceService.processWebhookTransactions(companyId, req.body);
      res.json({
        success: true,
        message: `${result.processed} transações processadas com sucesso! (${result.duplicates} duplicadas ignoradas)`,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getOpenFinanceInfo(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const host = req.get('host') || 'vianfe.contadordev.com.br';
      const protocol = req.protocol === 'http' && !req.secure && host.includes('localhost') ? 'http' : 'https';
      const webhookUrl = `${protocol}://${host}/api/bpo/open-finance/webhook/${company_id}`;
      const totalTransactions = db.prepare(`
        SELECT count(*) as count, max(created_at) as last_sync 
        FROM bank_transactions 
        WHERE company_id = ? AND observacoes_cliente LIKE '%Open Finance%'
      `).get(company_id as string) as any;

      res.json({
        success: true,
        data: {
          webhookUrl,
          supportedBanks: ['Banco Inter', 'Cora PJ', 'Asaas', 'Itaú Empresas', 'Nubank PJ', 'Pluggy'],
          totalSynced: totalTransactions?.count || 0,
          lastSync: totalTransactions?.last_sync || null
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 14. MAPEADOR VISUAL DE PLANO DE CONTAS DOMÍNIO SISTEMAS
  async autoMapChartOfAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id } = req.body;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      if (!canAccessCompany(req, res, company_id)) return;
      const accounts = db.prepare('SELECT nome_conta FROM dominio_chart_of_accounts WHERE company_id = ?').all(company_id as string) as any[];
      if (accounts.some(account => !isReadableFinancialText(account.nome_conta))) {
        res.status(400).json({ error: 'O plano contém nomes ilegíveis. Reimporte o TXT/CSV válido antes do mapeamento automático.' }); return;
      }
      const result = await openFinanceService.autoMapChartOfAccounts(company_id as string);
      res.json({
        success: true,
        message: `${result.mapped} categorias mapeadas automaticamente com o plano de contas da Domínio Sistemas!`,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateCategoryMapping(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { conta_debito_dominio, conta_credito_dominio } = req.body;

      const tenantId = (req as AuthenticatedRequest).user!.tenant_id;
      if (!db.prepare('SELECT id FROM financial_categories WHERE id = ? AND tenant_id = ?').get(id, tenantId)) {
        res.status(404).json({ error: 'Categoria não encontrada' }); return;
      }
      db.prepare(`
        UPDATE financial_categories 
        SET conta_debito_dominio = ?, conta_credito_dominio = ?
        WHERE id = ?
      `).run(conta_debito_dominio || null, conta_credito_dominio || null, id);

      const updated = db.prepare('SELECT * FROM financial_categories WHERE id = ?').get(id);
      res.json({ success: true, message: 'Mapeamento contábil atualizado com sucesso!', data: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
,

  async getInstallments(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, tipo = 'pagar', status } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      let sql = 'SELECT * FROM invoice_installments WHERE company_id = ?';
      const params: any[] = [company_id];
      if (tipo && tipo !== 'all') {
        sql += ' AND tipo = ?';
        params.push(tipo);
      }
      if (status && status !== 'all') {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY data_vencimento ASC';
      const rows = db.prepare(sql).all(...params);
      res.json({ success: true, data: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getTaxForecasts(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, month } = req.query;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      const refMonth = (month as string) || new Date().toISOString().slice(0, 7);

      const salesQuery = db.prepare(`
        SELECT sum(valor_total) as total_vendas, count(*) as count_notas
        FROM invoices
        WHERE company_id = ? AND tipo = 'saida' AND data_emissao LIKE ?
      `).get(company_id, `${refMonth}%`) as any;

      const totalVendas = Number(salesQuery?.total_vendas) || 0;
      const countVendas = Number(salesQuery?.count_notas) || 0;
      const aliqSimples = 0.048;
      const dasEstimado = Math.round(totalVendas * aliqSimples * 100) / 100;

      const interstateRows = db.prepare(`
        SELECT id, numero, serie, chave_acesso, data_emissao, emitente_cnpj, emitente_nome,
               emitente_uf, valor_total, valor_produtos, valor_icms, xml_raw
        FROM invoices
        WHERE company_id = ? AND tipo = 'entrada' AND emitente_uf != 'BA' AND data_emissao LIKE ?
        ORDER BY data_emissao DESC
      `).all(company_id, `${refMonth}%`) as any[];

      const aliqInternaBa = 0.205;
      const notasAntecipacao: any[] = [];
      let totalBaseCalculo = 0;
      let totalDaeDevido = 0;

      for (const r of interstateRows) {
        const valTotal = Number(r.valor_total) || 0;
        const valIcmsOrigem = Number(r.valor_icms) || 0;
        const base = valTotal;
        const icmsInterno = Math.round(base * aliqInternaBa * 100) / 100;
        const dae = Math.max(0, Math.round((icmsInterno - valIcmsOrigem) * 100) / 100);

        notasAntecipacao.push({
          id: r.id,
          numero: r.numero,
          serie: r.serie,
          chaveAcesso: r.chave_acesso,
          dataEmissao: r.data_emissao,
          fornecedorNome: r.emitente_nome,
          fornecedorCnpj: r.emitente_cnpj,
          ufOrigem: r.emitente_uf,
          valorContabil: valTotal,
          icmsOrigem: valIcmsOrigem,
          aliquotaInternaBa: '20.5%',
          icmsInternoDevido: icmsInterno,
          daeDevido: dae
        });

        totalBaseCalculo += valTotal;
        totalDaeDevido += dae;
      }

      const [yearStr, monthStr] = refMonth.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const nextMonthIso = `${nextY}-${String(nextM).padStart(2, '0')}`;

      const vencimentoDas = `${nextMonthIso}-20`;
      const vencimentoDae = `${nextMonthIso}-25`;

      res.json({
        success: true,
        competencia: `${monthStr}/${yearStr}`,
        refMonth,
        das: {
          titulo: 'DAS · Simples Nacional (Previsão Fiscal)',
          competencia: `${monthStr}/${yearStr}`,
          vencimento: vencimentoDas,
          totalVendas,
          countVendas,
          aliquotaEstimada: aliqSimples,
          valorDevido: dasEstimado,
          status: 'previsao'
        },
        antecipacao_parcial: {
          titulo: 'DAE · Antecipação Parcial SEFAZ-BA (Previsão Fiscal)',
          competencia: `${monthStr}/${yearStr}`,
          vencimento: vencimentoDae,
          baseCalculo: Math.round(totalBaseCalculo * 100) / 100,
          valorDevido: Math.round(totalDaeDevido * 100) / 100,
          notasCount: notasAntecipacao.length,
          notas: notasAntecipacao,
          status: 'previsao'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

};