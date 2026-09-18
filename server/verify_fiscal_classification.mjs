import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

function cleanNumeric(str) {
  return (str || '').replace(/\D/g, '');
}

const DB_PATHS = [
  path.resolve('server/storage/data/fiscal_hub.db'),
  path.resolve('storage/data/fiscal_hub.db'),
  path.resolve('server/database.sqlite'),
  path.resolve('database.sqlite'),
];

console.log('================================================================');
console.log('🔍 VERIFICAÇÃO AUTOMATIZADA: DIREÇÃO FISCAL (ENTRADA VS SAÍDA)');
console.log('================================================================');

let totalDatabasesAudited = 0;
let globalInvertedCount = 0;

for (const dbPath of DB_PATHS) {
  if (!fs.existsSync(dbPath)) continue;

  console.log(`\n📂 Verificando Banco de Dados: ${dbPath}`);
  let db;
  try {
    db = new DatabaseSync(dbPath);
  } catch (err) {
    console.warn(`Não foi possível abrir ${dbPath}:`, err.message);
    continue;
  }

  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'").get();
  if (!tableCheck) {
    console.log('Tabela invoices não encontrada neste banco.');
    continue;
  }

  totalDatabasesAudited++;

  const companies = db.prepare('SELECT id, cnpj, razao_social, nome_fantasia FROM companies').all();
  const companyByCnpj = new Map();
  for (const c of companies) {
    companyByCnpj.set(cleanNumeric(c.cnpj), c);
  }

  // 0. Compatibilidade de schema
  try {
    db.exec(`
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
    `);
  } catch (_) {}

  // 1. Executar Reclassificação Automática
  const invoices = db.prepare(`
    SELECT id, company_id, chave_acesso, numero, serie, modelo, tipo,
           emitente_cnpj, emitente_nome, destinatario_cnpj, destinatario_nome,
           valor_total, xml_raw
    FROM invoices
  `).all();

  const updateStmt = db.prepare(`
    UPDATE invoices SET
      tipo = ?,
      destinatario_cnpj = ?,
      destinatario_nome = ?,
      company_id = ?
    WHERE id = ?
  `);

  const updateInstStmt = db.prepare(`
    UPDATE invoice_installments SET
      tipo = ?,
      company_id = ?,
      fornecedor_cliente_nome = ?,
      fornecedor_cliente_cnpj = ?
    WHERE invoice_id = ?
  `);

  let reclassified = 0;
  let sanitized = 0;
  let installmentsSynced = 0;

  for (const inv of invoices) {
    const cleanEmit = cleanNumeric(inv.emitente_cnpj);
    const cleanDest = cleanNumeric(inv.destinatario_cnpj);

    const isSameComp = (c1, c2) => {
      if (!c1 || !c2) return false;
      if (c1 === c2) return true;
      if (c1.length === 14 && c2.length === 14 && c1.substring(0, 8) === c2.substring(0, 8)) return true;
      return false;
    };

    // 1. Manter a empresa proprietária vinculada em company_id se for parte legítima
    let comp = companies.find(c => c.id === inv.company_id);
    const isCurrentParty = comp && (
      isSameComp(cleanNumeric(comp.cnpj), cleanEmit) ||
      isSameComp(cleanNumeric(comp.cnpj), cleanDest)
    );

    if (!isCurrentParty) {
      if (cleanEmit && companyByCnpj.has(cleanEmit)) {
        comp = companyByCnpj.get(cleanEmit);
      } else if (cleanDest && companyByCnpj.has(cleanDest)) {
        comp = companyByCnpj.get(cleanDest);
      }
    }

    const compCnpj = comp ? cleanNumeric(comp.cnpj) : cleanEmit;

    const isSelf = isSameComp(cleanEmit, compCnpj);
    const isSelfRec = isSameComp(cleanDest, compCnpj);
    const isNfce = String(inv.modelo || '') === '65';

    let tpNF = '1';
    let realDestCnpj = cleanDest;
    let realDestNome = (inv.destinatario_nome || '').trim();

    if (inv.xml_raw) {
      const tpNfMatch = inv.xml_raw.match(/<tpNF>([01])<\/tpNF>/);
      if (tpNfMatch) tpNF = tpNfMatch[1];

      const destBlockMatch = inv.xml_raw.match(/<dest>([\s\S]*?)<\/dest>/);
      if (destBlockMatch) {
        const destXml = destBlockMatch[1];
        const cnpjM = destXml.match(/<CNPJ>(\d+)<\/CNPJ>/);
        const cpfM = destXml.match(/<CPF>(\d+)<\/CPF>/);
        const idEstrangeiroM = destXml.match(/<idEstrangeiro>([^<]+)<\/idEstrangeiro>/);
        const nomeM = destXml.match(/<xNome>([^<]+)<\/xNome>/);

        if (cnpjM) realDestCnpj = cnpjM[1];
        else if (cpfM) realDestCnpj = cpfM[1];
        else if (idEstrangeiroM) realDestCnpj = idEstrangeiroM[1].trim();
        else realDestCnpj = '';

        if (nomeM) {
          realDestNome = nomeM[1].trim();
        } else if (isNfce || (!realDestNome && !realDestCnpj)) {
          realDestNome = 'Consumidor Final - Venda Balcão';
        }
      } else if (isNfce) {
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

    // Sanitização de NFC-e / Consumidor Final (preserva filiais com CNPJs distintos)
    const isExactSame = Boolean(realDestCnpj && compCnpj && realDestCnpj === compCnpj);
    if (isSelf && (isNfce || !realDestCnpj || isExactSame)) {
      realDestCnpj = isExactSame ? '' : realDestCnpj;
      if (!realDestNome || realDestNome.toUpperCase().includes('CONSUMIDOR') || isExactSame) {
        realDestNome = 'Consumidor Final - Venda Balcão';
      }
    }

    // Classificador determinístico
    let targetTipo = 'entrada';
    if (tpNF === '0') {
      targetTipo = 'entrada';
    } else if (isSelf) {
      targetTipo = 'saida';
    } else if (isSelfRec) {
      targetTipo = 'entrada';
    } else if (compCnpj && !isSelf) {
      targetTipo = 'entrada';
    } else {
      targetTipo = tpNF === '0' ? 'entrada' : 'saida';
    }

    const changedTipo = inv.tipo !== targetTipo;
    const changedDest = inv.destinatario_cnpj !== realDestCnpj || inv.destinatario_nome !== realDestNome;
    const changedComp = comp && inv.company_id !== comp.id;

    if (changedTipo || changedDest || changedComp) {
      updateStmt.run(targetTipo, realDestCnpj, realDestNome, comp ? comp.id : inv.company_id, inv.id);
      if (changedTipo) {
        reclassified++;
      }
      if (changedDest) {
        sanitized++;
      }
    }

    // Sincronizar duplicatas
    const targetInstTipo = targetTipo === 'entrada' ? 'pagar' : 'receber';
    const targetPartyNome = targetTipo === 'entrada' ? (inv.emitente_nome || '') : realDestNome;
    const targetPartyCnpj = targetTipo === 'entrada' ? (inv.emitente_cnpj || '') : realDestCnpj;
    const targetCompId = comp ? comp.id : inv.company_id;

    updateInstStmt.run(targetInstTipo, targetCompId, targetPartyNome, targetPartyCnpj, inv.id);
    installmentsSynced++;
  }

  console.log(`✓ Saneamento executado: ${reclassified} notas corrigidas, ${sanitized} destinatários NFC-e limpos, ${installmentsSynced} parcelas sincronizadas.`);

  // 2. Auditoria e Validação Rigorosa por Empresa
  console.log('\n--- RESULTADOS DA AUDITORIA POR EMPRESA ---');

  for (const c of companies) {
    const compCnpjClean = cleanNumeric(c.cnpj);
    const compInvoices = db.prepare('SELECT * FROM invoices WHERE company_id = ?').all(c.id);

    let saidasCount = 0;
    let saidasValor = 0;
    let entradasCount = 0;
    let entradasValor = 0;
    let invertedThisComp = 0;

    const isSameComp = (c1, c2) => {
      if (!c1 || !c2) return false;
      if (c1 === c2) return true;
      if (c1.length === 14 && c2.length === 14 && c1.substring(0, 8) === c2.substring(0, 8)) return true;
      return false;
    };

    for (const inv of compInvoices) {
      const emitClean = cleanNumeric(inv.emitente_cnpj);
      const destClean = cleanNumeric(inv.destinatario_cnpj);
      let tpNF = '1';
      if (inv.xml_raw) {
        const m = inv.xml_raw.match(/<tpNF>([01])<\/tpNF>/);
        if (m) tpNF = m[1];
      }

      // Critério de Inversão:
      // Se a empresa emitiu (emitente === company) com tpNF=1 e está como 'entrada' -> ERRO
      if (isSameComp(emitClean, compCnpjClean) && tpNF === '1' && inv.tipo === 'entrada') {
        invertedThisComp++;
        console.error(`❌ INVERSÃO DETECTADA: Nota ${inv.numero} emitida por ${inv.emitente_nome} marcada como ENTRADA!`);
      }
      // Se a empresa emitiu com tpNF=0 e está como 'saida' -> ERRO
      if (isSameComp(emitClean, compCnpjClean) && tpNF === '0' && inv.tipo === 'saida') {
        invertedThisComp++;
        console.error(`❌ INVERSÃO DETECTADA: Nota de devolução/remessa própria ${inv.numero} emitida com tpNF=0 marcada como SAÍDA!`);
      }
      // Se a empresa recebeu (destinatário === company) ou emitida por terceiro e está como 'saida' -> ERRO
      if (!isSameComp(emitClean, compCnpjClean) && inv.tipo === 'saida') {
        invertedThisComp++;
        console.error(`❌ INVERSÃO DETECTADA: Nota ${inv.numero} recebida de ${inv.emitente_nome} marcada como SAÍDA!`);
      }

      if (inv.tipo === 'saida') {
        saidasCount++;
        saidasValor += Number(inv.valor_total || 0);
      } else {
        entradasCount++;
        entradasValor += Number(inv.valor_total || 0);
      }
    }

    // Auditoria de parcelas (invoice_installments)
    const compInstallments = db.prepare('SELECT id, invoice_id, tipo FROM invoice_installments WHERE company_id = ?').all(c.id);
    let invertedInstThisComp = 0;
    const invMap = new Map(compInvoices.map(i => [i.id, i]));
    for (const inst of compInstallments) {
      const parentInv = invMap.get(inst.invoice_id);
      if (parentInv) {
        const expectedInstTipo = parentInv.tipo === 'entrada' ? 'pagar' : 'receber';
        if (inst.tipo !== expectedInstTipo) {
          invertedInstThisComp++;
          console.error(`❌ PARCELA INVERTIDA: Parcela ${inst.id} da nota ${parentInv.numero} está como ${inst.tipo} mas a nota é ${parentInv.tipo}!`);
        }
      }
    }

    globalInvertedCount += (invertedThisComp + invertedInstThisComp);

    console.log(`Empresa: [${c.razao_social}] (CNPJ: ${c.cnpj})`);
    console.log(`  ├─ Total de Notas: ${compInvoices.length}`);
    console.log(`  ├─ Saídas (Vendas / Faturamento): ${saidasCount} notas (R$ ${saidasValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    console.log(`  ├─ Entradas (Compras / Insumos): ${entradasCount} notas (R$ ${entradasValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
    console.log(`  ├─ Notas Invertidas: ${invertedThisComp === 0 ? '0 (CORRETO ✓)' : `${invertedThisComp} (ERRO ✗)`}`);
    console.log(`  └─ Parcelas Invertidas: ${invertedInstThisComp === 0 ? '0 (CORRETO ✓)' : `${invertedInstThisComp} (ERRO ✗)`}`);
  }
}

console.log('\n================================================================');
console.log(`RESUMO GERAL:`);
console.log(`Bancos auditados: ${totalDatabasesAudited}`);
console.log(`Total de notas/parcelas com direção invertida: ${globalInvertedCount}`);
if (globalInvertedCount === 0) {
  console.log('STATUS: APROVADO COM SUCESSO! 100% DAS NOTAS E PARCELAS CLASSIFICADAS CORRETAMENTE.');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error(`STATUS: FALHA! Encontradas ${globalInvertedCount} notas/parcelas invertidas.`);
  console.log('================================================================');
  process.exit(1);
}
