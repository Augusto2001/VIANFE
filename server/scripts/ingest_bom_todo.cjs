const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const dbPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

const bomTodoCompany = db.prepare("SELECT * FROM companies WHERE cnpj = '11415194000102'").get();
if (!bomTodoCompany) {
  console.error('Empresa Bom Todo não encontrada no banco!');
  process.exit(1);
}

console.log('🏢 Empresa alvo:', bomTodoCompany.razao_social, bomTodoCompany.id);

function getTag(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '[^>]*>([^<]+)</' + tag + '>'));
  return m ? m[1] : '';
}

function walk(dir) {
  let res = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        res = res.concat(walk(p));
      } else if (p.toLowerCase().endsWith('.xml')) {
        res.push(p);
      }
    }
  } catch (e) {}
  return res;
}

const nfeDir = path.normalize('G:/Meu drive/CLIENTES VIACONT/CLIENTES ATIVOS/BOM TODO COMERCIO VAREJISTA EIRELI ME ( 4 ) (SN) ( 11 )/SETOR FISCAL/NFe');
const xmlFiles = walk(nfeDir);
console.log(`Encontrados ${xmlFiles.length} arquivos XML no Setor Fiscal da Bom Todo.`);

const insertInvoiceStmt = db.prepare(`
  INSERT INTO invoices (
    id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
    natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
    destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total,
    valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
    itens_json, xml_raw, gdrive_synced, created_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, 'autorizada',
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, 1, datetime('now')
  )
  ON CONFLICT(chave_acesso) DO UPDATE SET
    company_id = excluded.company_id,
    tipo = excluded.tipo,
    emitente_cnpj = excluded.emitente_cnpj,
    emitente_nome = excluded.emitente_nome,
    destinatario_cnpj = excluded.destinatario_cnpj,
    destinatario_nome = excluded.destinatario_nome,
    valor_total = excluded.valor_total,
    valor_produtos = excluded.valor_produtos,
    valor_icms = excluded.valor_icms,
    valor_pis = excluded.valor_pis,
    valor_cofins = excluded.valor_cofins,
    data_emissao = excluded.data_emissao,
    xml_raw = excluded.xml_raw
`);

const bomTodoCnpj = '11415194000102';
let insertedCount = 0;
let saidasCount = 0;
let entradasCount = 0;
let totalValor = 0;
const seenChaves = new Set();

for (const f of xmlFiles) {
  try {
    const rawXml = fs.readFileSync(f, 'utf8');
    if (!rawXml.includes('<nfeProc') && !rawXml.includes('<infNFe') && !rawXml.includes('<NFe')) continue;

    const chMatch = rawXml.match(/Id="NFe([0-9]{44})"/);
    const chaveAcesso = chMatch ? chMatch[1] : getTag(rawXml, 'chNFe');
    if (!chaveAcesso || chaveAcesso.length !== 44) continue;
    if (seenChaves.has(chaveAcesso)) continue;
    seenChaves.add(chaveAcesso);

    const emitMatch = rawXml.match(/<emit>([\s\S]*?)<\/emit>/);
    const destMatch = rawXml.match(/<dest>([\s\S]*?)<\/dest>/);
    const emitCnpj = emitMatch ? getTag(emitMatch[1], 'CNPJ') : '';
    const destCnpj = destMatch ? getTag(destMatch[1], 'CNPJ') : '';

    // Filtrar apenas notas em que a Bom Todo é emitente ou destinatário
    if (emitCnpj !== bomTodoCnpj && destCnpj !== bomTodoCnpj) {
      continue;
    }

    const isSaida = emitCnpj === bomTodoCnpj;
    const tipo = isSaida ? 'saida' : 'entrada';
    const modelo = getTag(rawXml, 'mod') || '55';
    const numero = getTag(rawXml, 'nNF') || '0';
    const serie = getTag(rawXml, 'serie') || '1';
    const natOp = getTag(rawXml, 'natOp') || (isSaida ? 'Venda de Mercadoria' : 'Compra de Mercadoria');
    const dEmi = getTag(rawXml, 'dhEmi') || getTag(rawXml, 'dEmi') || new Date().toISOString();

    const emitNome = emitMatch ? getTag(emitMatch[1], 'xNome') : 'BOM TODO COMERCIO VAREJISTA LTDA';
    const emitUf = emitMatch ? getTag(emitMatch[1], 'UF') : 'BA';

    const destNome = destMatch ? getTag(destMatch[1], 'xNome') : 'Consumidor Final';
    const destUf = destMatch ? getTag(destMatch[1], 'UF') : 'BA';

    const vNF = parseFloat(getTag(rawXml, 'vNF') || '0');
    const vProd = parseFloat(getTag(rawXml, 'vProd') || String(vNF));
    const vICMS = parseFloat(getTag(rawXml, 'vICMS') || '0');
    const vPIS = parseFloat(getTag(rawXml, 'vPIS') || '0');
    const vCOFINS = parseFloat(getTag(rawXml, 'vCOFINS') || '0');
    const vIPI = parseFloat(getTag(rawXml, 'vIPI') || '0');

    const invId = `inv_bomtodo_${chaveAcesso}`;

    insertInvoiceStmt.run(
      invId,
      bomTodoCompany.id,
      chaveAcesso,
      numero,
      serie,
      modelo,
      tipo,
      natOp,
      dEmi,
      emitCnpj,
      emitNome,
      emitUf,
      destCnpj,
      destNome,
      destUf,
      vNF,
      vProd,
      vICMS,
      vPIS,
      vCOFINS,
      vIPI,
      null,
      rawXml
    );

    insertedCount++;
    totalValor += vNF;
    if (isSaida) saidasCount++; else entradasCount++;
  } catch (err) {
    // skip corrupted
  }
}

console.log(`\n======================================================`);
console.log(`INGESTÃO DA BOM TODO CONCLUÍDA COM SUCESSO!`);
console.log(` - Total de notas persistidas no banco: ${insertedCount}`);
console.log(` - Saídas (Vendas): ${saidasCount}`);
console.log(` - Entradas (Compras): ${entradasCount}`);
console.log(` - Faturamento Total Mapeado: R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`======================================================`);
