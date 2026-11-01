const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = fs.existsSync('/app/server/storage/data/fiscal_hub.db') 
  ? '/app/server/storage/data/fiscal_hub.db' 
  : '/app/storage/data/fiscal_hub.db';
const db = new DatabaseSync(dbPath);

const deltaPath = '/tmp/sync_delta.json';
if (!fs.existsSync(deltaPath)) {
  console.error('Arquivo /tmp/sync_delta.json não encontrado!');
  process.exit(1);
}

const delta = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
console.log(`Aplicando delta gerado em ${delta.timestamp}...`);

// 1. Atualizar empresas com certificados e parametrizações de NFS-e
const updateCompStmt = db.prepare(`
  UPDATE companies SET
    cert_filename = COALESCE(?, cert_filename),
    cert_password_enc = COALESCE(?, cert_password_enc),
    cert_valid_until = COALESCE(?, cert_valid_until),
    emite_nfse = COALESCE(?, emite_nfse),
    inscricao_municipal = COALESCE(?, inscricao_municipal),
    nfse_prefeitura_padrao = COALESCE(?, nfse_prefeitura_padrao),
    nfse_aliquota_padrao = COALESCE(?, nfse_aliquota_padrao),
    item_servico_padrao = COALESCE(?, item_servico_padrao),
    cnae_padrao = COALESCE(?, cnae_padrao),
    codigo_tributacao_municipio = COALESCE(?, codigo_tributacao_municipio),
    nfse_provedor = COALESCE(?, nfse_provedor),
    updated_at = datetime('now')
  WHERE id = ? OR replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?
`);

let compUpdated = 0;
for (const c of delta.companies) {
  const cleanCnpj = (c.cnpj || '').replace(/\D/g, '');
  updateCompStmt.run(
    c.cert_filename,
    c.cert_password_enc,
    c.cert_valid_until,
    c.emite_nfse,
    c.inscricao_municipal,
    c.nfse_prefeitura_padrao,
    c.nfse_aliquota_padrao,
    c.item_servico_padrao,
    c.cnae_padrao,
    c.codigo_tributacao_municipio,
    c.nfse_provedor,
    c.id,
    cleanCnpj
  );
  compUpdated++;
}
console.log(`✅ ${compUpdated} empresas atualizadas com configurações de NFS-e e certificados.`);

// 2. Inserir/Atualizar Invoices genéricas (Bom Todo & NFS-e)
const insertInvStmt = db.prepare(`
  INSERT INTO invoices (
    id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
    natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
    destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total,
    valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
    itens_json, xml_raw, gdrive_synced, created_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, datetime('now')
  )
  ON CONFLICT(chave_acesso) DO UPDATE SET
    company_id = excluded.company_id,
    modelo = excluded.modelo,
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

const compCheckStmt = db.prepare('SELECT id FROM companies WHERE id = ?');
const compByCnpjStmt = db.prepare("SELECT id FROM companies WHERE replace(replace(replace(replace(cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ? LIMIT 1");

const allInvoices = [
  ...(delta.bomTodoInvoices || delta.invoices || []),
  ...(delta.nfseInvoices || [])
];

let invInserted = 0;
let invSkipped = 0;

for (const inv of allInvoices) {
  let finalCompanyId = inv.company_id;
  const compRow = compCheckStmt.get(finalCompanyId);
  if (!compRow) {
    const cleanEmit = (inv.emitente_cnpj || '').replace(/\D/g, '');
    const cleanDest = (inv.destinatario_cnpj || '').replace(/\D/g, '');
    const found = compByCnpjStmt.get(cleanEmit) || compByCnpjStmt.get(cleanDest);
    if (found) {
      finalCompanyId = found.id;
    } else {
      invSkipped++;
      continue;
    }
  }

  insertInvStmt.run(
    inv.id, finalCompanyId, inv.chave_acesso, inv.numero, inv.serie, inv.modelo, inv.tipo, inv.status,
    inv.natureza_operacao, inv.data_emissao, inv.emitente_cnpj, inv.emitente_nome, inv.emitente_uf,
    inv.destinatario_cnpj, inv.destinatario_nome, inv.destinatario_uf, inv.valor_total,
    inv.valor_produtos, inv.valor_icms, inv.valor_pis, inv.valor_cofins, inv.valor_ipi,
    inv.itens_json, inv.xml_raw, inv.gdrive_synced
  );
  invInserted++;
}
console.log(`✅ ${invInserted} notas (NFS-e e Saídas 65) inseridas/atualizadas com sucesso (ignoradas sem empresa: ${invSkipped}).`);

const finalInvoices = db.prepare('SELECT count(*) as count, sum(valor_total) as total FROM invoices').get();
console.log(`Total Invoices VPS: ${finalInvoices.count} | Valor Total: R$ ${finalInvoices.total.toFixed(2)}`);

const nfseStats = db.prepare("SELECT count(*) as count, sum(valor_total) as total FROM invoices WHERE modelo = 'NFS-e'").get();
console.log(`Total NFS-e na VPS: ${nfseStats.count} | Valor NFS-e R$: ${Number(nfseStats.total || 0).toFixed(2)}`);
