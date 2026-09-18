import { DatabaseSync } from 'node:sqlite';
import { cleanNumeric } from './crypto.js';

export interface FiscalClassificationResult {
  tipo: 'entrada' | 'saida';
  destinatarioCnpj: string;
  destinatarioNome: string;
  isConsumerSale: boolean;
}

export interface ReclassificationSummary {
  totalInvoicesScanned: number;
  totalReclassified: number;
  totalSanitizedDestinatario: number;
  totalInstallmentsUpdated: number;
  invertedNotesCount: number;
  companiesBreakdown: Array<{
    companyId: string;
    razaoSocial: string;
    cnpj: string;
    totalNotas: number;
    saidasCount: number;
    saidasValor: number;
    entradasCount: number;
    entradasValor: number;
    invertedCount: number;
  }>;
}

/**
 * Classificador determinístico de direção fiscal (Entrada vs Saída)
 * Implementa rigorosamente as 4 regras contábeis:
 * - Se tpNF === '0' (emissão própria de entrada para devolução/remessa) -> tipo = 'entrada'
 * - Se emitente_cnpj === company.cnpj e tpNF === '1' -> tipo = 'saida' (Venda / Faturamento da empresa)
 * - Se destinatario_cnpj === company.cnpj e tpNF === '1' -> tipo = 'entrada' (Compra / Mercadoria recebida de fornecedor)
 * - Eliminar qualquer lógica que classifique notas emitidas pela própria empresa como "entrada" (salvo tpNF === '0')
 * - Para NFC-e (modelo 65) e vendas a consumidor final: sanitizar destinatário como "Consumidor Final - Venda Balcão"
 */
export function isSameCompany(cnpj1?: string, cnpj2?: string): boolean {
  const c1 = cleanNumeric(cnpj1 || '');
  const c2 = cleanNumeric(cnpj2 || '');
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.length === 14 && c2.length === 14 && c1.substring(0, 8) === c2.substring(0, 8)) {
    return true;
  }
  return false;
}

export function classifyFiscalDirection(
  companyCnpj: string,
  emitenteCnpj: string,
  destinatarioCnpj?: string,
  tipoOperacao?: string | number,
  modelo?: string,
  destinatarioNome?: string
): FiscalClassificationResult {
  const compCnpj = cleanNumeric(companyCnpj);
  const emitCnpj = cleanNumeric(emitenteCnpj);
  const rawDestDoc = (destinatarioCnpj || '').trim();
  const cleanDestCnpj = cleanNumeric(rawDestDoc);
  const tpNF = (tipoOperacao !== undefined && tipoOperacao !== null)
    ? String(tipoOperacao).trim()
    : '1';

  const isSelfEmitted = isSameCompany(emitCnpj, compCnpj);
  const isSelfReceived = isSameCompany(cleanDestCnpj, compCnpj);
  const isNfce = String(modelo || '') === '65';

  // Sanitização de destinatário para notas de consumidor / NFC-e
  let effectiveDestCnpj = rawDestDoc;
  let effectiveDestNome = (destinatarioNome || '').trim();
  let isConsumerSale = false;

  // Se for NFC-e (modelo 65) ou se a empresa emitiu e o destinatário está vazio ou corrompido com o MESMO CNPJ exato da empresa:
  // Preserva transferências entre filiais (que possuem CNPJ diferente com mesma raiz de 8 dígitos)
  // Preserva clientes estrangeiros (idEstrangeiro) e nomes informados no cupom
  const isExactSameCnpj = Boolean(cleanDestCnpj && compCnpj && cleanDestCnpj === compCnpj);
  if (isSelfEmitted && (isNfce || !rawDestDoc || isExactSameCnpj)) {
    isConsumerSale = true;
    effectiveDestCnpj = isExactSameCnpj ? '' : effectiveDestCnpj;
    if (!effectiveDestNome || effectiveDestNome.toUpperCase().includes('CONSUMIDOR') || isExactSameCnpj) {
      effectiveDestNome = 'Consumidor Final - Venda Balcão';
    }
  }

  let tipo: 'entrada' | 'saida';

  // REGRA 3: Se tpNF === '0' (emissão própria de entrada para devolução/remessa) -> tipo = 'entrada'
  if (tpNF === '0') {
    tipo = 'entrada';
  }
  // REGRA 1: Se emitente_cnpj === company.cnpj e tpNF === '1' -> tipo = 'saida' (Venda / Faturamento da empresa)
  else if (isSelfEmitted) {
    tipo = 'saida';
  }
  // REGRA 2: Se destinatario_cnpj === company.cnpj e tpNF === '1' -> tipo = 'entrada' (Compra / Mercadoria recebida de fornecedor)
  else if (isSelfReceived) {
    tipo = 'entrada';
  }
  // REGRA 4: Se o emitente NÃO é a própria empresa, ela não pode ter faturamento próprio dessa nota.
  // Qualquer nota emitida por terceiro recebida pela empresa é estritamente ENTRADA (Compra/Insumo).
  else if (compCnpj && !isSelfEmitted) {
    tipo = 'entrada';
  }
  // Fallback seguro: caso compCnpj não tenha sido fornecido
  else {
    tipo = tpNF === '0' ? 'entrada' : 'saida';
  }

  return {
    tipo,
    destinatarioCnpj: effectiveDestCnpj,
    destinatarioNome: effectiveDestNome || (tipo === 'saida' && isNfce ? 'Consumidor Final - Venda Balcão' : ''),
    isConsumerSale
  };
}

/**
 * Garante compatibilidade estrutural de schema e tabelas em qualquer base SQLite
 * (suportando tanto server/storage/data/fiscal_hub.db quanto server/database.sqlite).
 */
export function ensureDatabaseSchema(database: DatabaseSync): void {
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS invoice_installments (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        numero_fatura TEXT,
        numero_parcela TEXT NOT NULL,
        data_vencimento TEXT NOT NULL,
        valor REAL NOT NULL,
        status TEXT DEFAULT 'pendente',
        forma_pagamento TEXT,
        fornecedor_cliente_nome TEXT,
        fornecedor_cliente_cnpj TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_installments_company ON invoice_installments(company_id, data_vencimento);
      CREATE INDEX IF NOT EXISTS idx_installments_invoice ON invoice_installments(invoice_id);
    `);
  } catch (_) {}

  // Adicionar colunas ausentes em invoices se for base legada
  try {
    const invCols = (database.prepare("PRAGMA table_info('invoices')").all() as any[]).map(c => c.name);
    const neededInvCols = [
      'fatura_json', 'duplicatas_json', 'pagamentos_json', 'transporte_json',
      'info_adicional', 'xml_raw', 'xml_file_path', 'pdf_file_path',
      'gdrive_synced', 'gdrive_file_id', 'gdrive_synced_at'
    ];
    for (const col of neededInvCols) {
      if (!invCols.includes(col)) {
        try { database.exec(`ALTER TABLE invoices ADD COLUMN ${col} TEXT;`); } catch (_) {}
      }
    }
  } catch (_) {}

  // Adicionar colunas ausentes em companies se for base legada
  try {
    const compCols = (database.prepare("PRAGMA table_info('companies')").all() as any[]).map(c => c.name);
    if (!compCols.includes('nome_fantasia')) {
      try { database.exec("ALTER TABLE companies ADD COLUMN nome_fantasia TEXT;"); } catch (_) {}
    }
    if (!compCols.includes('tenant_id')) {
      try { database.exec("ALTER TABLE companies ADD COLUMN tenant_id TEXT DEFAULT 'tenant_viacont_master';"); } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Executa a varredura completa e reclassificação de todo o banco de dados SQLite.
 * Corrige o campo tipo ('entrada' vs 'saida') de todas as notas fiscais de todas as empresas,
 * limpa dados de destinatário de NFC-e/Consumidor e atualiza as duplicatas/parcelas financeiras.
 */
export function reclassifyAndSanitizeDatabase(database: DatabaseSync): ReclassificationSummary {
  console.log('🔄 [Reclassificação Fiscal] Iniciando auditoria e saneamento de notas fiscais...');

  // 0. Assegurar compatibilidade de schema
  ensureDatabaseSchema(database);

  const companies = database.prepare('SELECT id, cnpj, razao_social, nome_fantasia FROM companies').all() as any[];
  const companyById = new Map<string, any>();
  const companyByCnpj = new Map<string, any>();

  for (const c of companies) {
    companyById.set(c.id, c);
    const clean = cleanNumeric(c.cnpj);
    if (clean) {
      companyByCnpj.set(clean, c);
    }
  }

  const invoices = database.prepare(`
    SELECT id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
           natureza_operacao, data_emissao, emitente_cnpj, emitente_nome,
           destinatario_cnpj, destinatario_nome, valor_total, xml_raw, duplicatas_json
    FROM invoices
  `).all() as any[];

  const updateInvoiceStmt = database.prepare(`
    UPDATE invoices SET
      tipo = ?,
      destinatario_cnpj = ?,
      destinatario_nome = ?,
      company_id = ?
    WHERE id = ?
  `);

  const updateInstallmentSyncStmt = database.prepare(`
    UPDATE invoice_installments SET
      tipo = ?,
      company_id = ?,
      fornecedor_cliente_nome = ?,
      fornecedor_cliente_cnpj = ?
    WHERE invoice_id = ? AND (
      tipo != ? OR
      company_id != ? OR
      fornecedor_cliente_nome != ? OR
      fornecedor_cliente_cnpj != ?
    )
  `);

  const insertMissingInstallmentStmt = database.prepare(`
    INSERT INTO invoice_installments (
      id, invoice_id, company_id, tipo, numero_fatura, numero_parcela,
      data_vencimento, valor, status, forma_pagamento, fornecedor_cliente_nome,
      fornecedor_cliente_cnpj, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 'Duplicata', ?, ?, ?)
  `);

  const countInstStmt = database.prepare(`
    SELECT COUNT(*) as count FROM invoice_installments WHERE invoice_id = ?
  `);

  let totalReclassified = 0;
  let totalSanitizedDestinatario = 0;
  let totalInstallmentsUpdated = 0;
  const now = new Date().toISOString();

  for (const inv of invoices) {
    // 1. Determinar a empresa proprietária da nota vinculada ao registro
    let targetCompany = companyById.get(inv.company_id);

    // Verificar se a empresa atualmente associada é de fato parte legítima do documento fiscal
    const cleanEmit = cleanNumeric(inv.emitente_cnpj);
    const cleanDest = cleanNumeric(inv.destinatario_cnpj);
    const isCurrentParty = targetCompany && (
      isSameCompany(targetCompany.cnpj, cleanEmit) ||
      isSameCompany(targetCompany.cnpj, cleanDest)
    );

    // Se a empresa associada não for parte legítima (ou for nula),
    // reatribui para a empresa legítima cadastrada (emitente ou destinatária)
    if (!isCurrentParty) {
      if (cleanEmit && companyByCnpj.has(cleanEmit)) {
        targetCompany = companyByCnpj.get(cleanEmit);
      } else if (cleanDest && companyByCnpj.has(cleanDest)) {
        targetCompany = companyByCnpj.get(cleanDest);
      }
    }

    if (!targetCompany) {
      targetCompany = { id: inv.company_id, cnpj: inv.emitente_cnpj || '', razao_social: inv.emitente_nome || 'Empresa' };
    }

    // 2. Extrair dados reais do XML se disponível (NF-e, NFC-e, CT-e, NFS-e)
    let tpNF = '1';
    let realDestCnpj = inv.destinatario_cnpj || '';
    let realDestNome = inv.destinatario_nome || '';

    if (inv.xml_raw) {
      const tpNfMatch = inv.xml_raw.match(/<tpNF>([01])<\/tpNF>/);
      if (tpNfMatch) {
        tpNF = tpNfMatch[1];
      }

      // 2.1 NF-e / NFC-e: nó <dest>
      const destBlockMatch = inv.xml_raw.match(/<dest>([\s\S]*?)<\/dest>/);
      if (destBlockMatch) {
        const destXml = destBlockMatch[1];
        const cnpjM = destXml.match(/<CNPJ>(\d+)<\/CNPJ>/);
        const cpfM = destXml.match(/<CPF>(\d+)<\/CPF>/);
        const idEstrangeiroM = destXml.match(/<idEstrangeiro>([^<]+)<\/idEstrangeiro>/);
        const nomeM = destXml.match(/<xNome>([^<]+)<\/xNome>/);

        if (cnpjM) {
          realDestCnpj = cnpjM[1];
        } else if (cpfM) {
          realDestCnpj = cpfM[1];
        } else if (idEstrangeiroM) {
          realDestCnpj = idEstrangeiroM[1].trim();
        } else {
          realDestCnpj = '';
        }

        if (nomeM) {
          realDestNome = nomeM[1].trim();
        } else if (inv.modelo === '65' || (!realDestNome && !realDestCnpj)) {
          realDestNome = 'Consumidor Final - Venda Balcão';
        }
      } else if (inv.modelo === '65') {
        realDestCnpj = '';
        if (!realDestNome) realDestNome = 'Consumidor Final - Venda Balcão';
      }

      // 2.2 NFS-e: nó <Tomador> / <TomadorServico> / <IdentificacaoTomador>
      if (!realDestCnpj && (inv.modelo === 'NFS-e' || inv.xml_raw.includes('<Nfse') || inv.xml_raw.includes('<CompNfse'))) {
        const tomadorMatch = inv.xml_raw.match(/<(?:TomadorServico|Tomador|IdentificacaoTomador)>([\s\S]*?)<\/(?:TomadorServico|Tomador|IdentificacaoTomador)>/);
        if (tomadorMatch) {
          const tomXml = tomadorMatch[1];
          const cnpjM = tomXml.match(/<Cnpj>(\d+)<\/Cnpj>/i);
          const cpfM = tomXml.match(/<Cpf>(\d+)<\/Cpf>/i);
          const nomeM = tomXml.match(/<(?:RazaoSocial|xNome|NomeFantasia)>([^<]+)<\//i);
          if (cnpjM) realDestCnpj = cnpjM[1];
          else if (cpfM) realDestCnpj = cpfM[1];
          if (nomeM) realDestNome = nomeM[1].trim();
        }
      }

      // 2.3 CT-e: nó <dest>, <rem>, <toma4>
      if (!realDestCnpj && (inv.modelo === '57' || inv.xml_raw.includes('<infCte'))) {
        const toma4M = inv.xml_raw.match(/<toma4>([\s\S]*?)<\/toma4>/);
        const remM = inv.xml_raw.match(/<rem>([\s\S]*?)<\/rem>/);
        if (toma4M) {
          const cM = toma4M[1].match(/<(?:CNPJ|CPF)>(\d+)<\//);
          const nM = toma4M[1].match(/<xNome>([^<]+)<\//);
          if (cM) realDestCnpj = cM[1];
          if (nM) realDestNome = nM[1].trim();
        } else if (remM) {
          const cM = remM[1].match(/<(?:CNPJ|CPF)>(\d+)<\//);
          const nM = remM[1].match(/<xNome>([^<]+)<\//);
          if (cM) realDestCnpj = cM[1];
          if (nM) realDestNome = nM[1].trim();
        }
      }
    }

    // 3. Aplicar classificador determinístico
    const result = classifyFiscalDirection(
      targetCompany.cnpj,
      inv.emitente_cnpj,
      realDestCnpj,
      tpNF,
      inv.modelo,
      realDestNome
    );

    const tipoChanged = inv.tipo !== result.tipo;
    const destCnpjChanged = inv.destinatario_cnpj !== result.destinatarioCnpj;
    const destNomeChanged = inv.destinatario_nome !== result.destinatarioNome;
    const companyChanged = inv.company_id !== targetCompany.id;

    if (tipoChanged || destCnpjChanged || destNomeChanged || companyChanged) {
      updateInvoiceStmt.run(
        result.tipo,
        result.destinatarioCnpj,
        result.destinatarioNome,
        targetCompany.id,
        inv.id
      );

      if (tipoChanged) {
        totalReclassified++;
      }
      if (destCnpjChanged || destNomeChanged) {
        totalSanitizedDestinatario++;
      }
    }

    // 4. Sincronização estrita do módulo financeiro (invoice_installments)
    const targetInstTipo = result.tipo === 'entrada' ? 'pagar' : 'receber';
    const targetPartyNome = result.tipo === 'entrada' ? (inv.emitente_nome || '') : result.destinatarioNome;
    const targetPartyCnpj = result.tipo === 'entrada' ? (inv.emitente_cnpj || '') : result.destinatarioCnpj;

    // 4.1 Atualizar duplicatas existentes que estejam com qualquer divergência de tipo, empresa ou partes
    const syncRes = updateInstallmentSyncStmt.run(
      targetInstTipo,
      targetCompany.id,
      targetPartyNome,
      targetPartyCnpj,
      inv.id,
      targetInstTipo,
      targetCompany.id,
      targetPartyNome,
      targetPartyCnpj
    ) as any;

    if (syncRes && syncRes.changes > 0) {
      totalInstallmentsUpdated += syncRes.changes;
    }

    // 4.2 Para notas que não possuam duplicatas criadas, gerar registro financeiro se houver valor
    try {
      const instCheck = countInstStmt.get(inv.id) as { count: number } | undefined;
      if (!instCheck || instCheck.count === 0) {
        let createdAny = false;
        if (inv.duplicatas_json) {
          try {
            const dups = JSON.parse(inv.duplicatas_json);
            if (Array.isArray(dups) && dups.length > 0) {
              for (let i = 0; i < dups.length; i++) {
                const d = dups[i];
                insertMissingInstallmentStmt.run(
                  `inst_${inv.id}_${i + 1}`,
                  inv.id,
                  targetCompany.id,
                  targetInstTipo,
                  inv.numero,
                  d.numero || String(i + 1),
                  d.vencimento || (inv.data_emissao ? inv.data_emissao.split('T')[0] : now.split('T')[0]),
                  Number(d.valor || 0),
                  targetPartyNome,
                  targetPartyCnpj,
                  now
                );
                totalInstallmentsUpdated++;
                createdAny = true;
              }
            }
          } catch (_) {}
        }

        // Se não possuía duplicatas detalhadas mas possui valor positivo em nota de compra/insumo
        if (!createdAny && Number(inv.valor_total || 0) > 0 && result.tipo === 'entrada') {
          insertMissingInstallmentStmt.run(
            `inst_${inv.id}_001`,
            inv.id,
            targetCompany.id,
            'pagar',
            inv.numero,
            '001',
            inv.data_emissao ? inv.data_emissao.split('T')[0] : now.split('T')[0],
            Number(inv.valor_total || 0),
            targetPartyNome,
            targetPartyCnpj,
            now
          );
          totalInstallmentsUpdated++;
        }
      }
    } catch (_) {}
  }

  // 4. Verificação pós-reclassificação e apuração dos totais
  const companiesBreakdown: ReclassificationSummary['companiesBreakdown'] = [];
  let totalInvertedFound = 0;

  for (const c of companies) {
    const compCnpjClean = cleanNumeric(c.cnpj);
    const compInvoices = database.prepare(`
      SELECT id, tipo, emitente_cnpj, destinatario_cnpj, valor_total, xml_raw
      FROM invoices
      WHERE company_id = ?
    `).all(c.id) as any[];

    let saidasCount = 0;
    let saidasValor = 0;
    let entradasCount = 0;
    let entradasValor = 0;
    let invertedCount = 0;

    for (const inv of compInvoices) {
      const invEmitClean = cleanNumeric(inv.emitente_cnpj);
      const invDestClean = cleanNumeric(inv.destinatario_cnpj);
      let tpNF = '1';
      if (inv.xml_raw) {
        const m = inv.xml_raw.match(/<tpNF>([01])<\/tpNF>/);
        if (m) tpNF = m[1];
      }

      // Verificação de inversão:
      // Se a empresa é emitente e tpNF é 1, NUNCA pode ser entrada (Venda da empresa)
      if (isSameCompany(invEmitClean, compCnpjClean) && tpNF === '1' && inv.tipo === 'entrada') {
        invertedCount++;
      }
      // Se a empresa é emitente e tpNF é 0, NUNCA pode ser saída (Devolução/Remessa de entrada própria)
      if (isSameCompany(invEmitClean, compCnpjClean) && tpNF === '0' && inv.tipo === 'saida') {
        invertedCount++;
      }
      // Se a empresa NÃO é emitente (nota recebida de fornecedor terceiro) e tipo é saída, NUNCA pode ser saída (seria falso faturamento)
      if (!isSameCompany(invEmitClean, compCnpjClean) && inv.tipo === 'saida') {
        invertedCount++;
      }

      if (inv.tipo === 'saida') {
        saidasCount++;
        saidasValor += Number(inv.valor_total || 0);
      } else {
        entradasCount++;
        entradasValor += Number(inv.valor_total || 0);
      }
    }

    totalInvertedFound += invertedCount;
    companiesBreakdown.push({
      companyId: c.id,
      razaoSocial: c.razao_social,
      cnpj: c.cnpj,
      totalNotas: compInvoices.length,
      saidasCount,
      saidasValor,
      entradasCount,
      entradasValor,
      invertedCount
    });

    console.log(`📊 [${c.razao_social.substring(0, 35)}] Total: ${compInvoices.length} | Saídas (Vendas): ${saidasCount} (R$ ${saidasValor.toFixed(2)}) | Entradas (Compras): ${entradasCount} (R$ ${entradasValor.toFixed(2)}) | Invertidas: ${invertedCount}`);
  }

  console.log(`✅ [Reclassificação Fiscal Concluída]`);
  console.log(`   └─ Notas analisadas: ${invoices.length}`);
  console.log(`   └─ Notas reclassificadas (tipo alterado): ${totalReclassified}`);
  console.log(`   └─ Destinatários NFC-e/Consumidor saneados: ${totalSanitizedDestinatario}`);
  console.log(`   └─ Parcelas financeiras sincronizadas: ${totalInstallmentsUpdated}`);
  console.log(`   └─ Notas invertidas restantes: ${totalInvertedFound} (Meta: 0)`);

  return {
    totalInvoicesScanned: invoices.length,
    totalReclassified,
    totalSanitizedDestinatario,
    totalInstallmentsUpdated,
    invertedNotesCount: totalInvertedFound,
    companiesBreakdown
  };
}
