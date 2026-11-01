const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

const companies = db.prepare(`
  SELECT id, cnpj, razao_social, cert_filename, cert_password_enc, cert_valid_until,
         emite_nfse, inscricao_municipal, nfse_prefeitura_padrao, nfse_aliquota_padrao,
         item_servico_padrao, cnae_padrao, codigo_tributacao_municipio, nfse_provedor
  FROM companies
`).all();
console.log(`Exportando ${companies.length} empresas com configurações fiscais e certificados...`);

const nfseInvoices = db.prepare("SELECT * FROM invoices WHERE modelo = 'NFS-e'").all();
console.log(`Exportando ${nfseInvoices.length} notas de serviço (NFS-e)...`);

const bomTodoInvoices = db.prepare("SELECT * FROM invoices WHERE company_id = (SELECT id FROM companies WHERE cnpj = '11415194000102')").all();
console.log(`Exportando ${bomTodoInvoices.length} notas fiscais da Bom Todo...`);

const delta = {
  timestamp: new Date().toISOString(),
  companies,
  nfseInvoices,
  bomTodoInvoices
};

const deltaPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/scripts/sync_delta.json');
fs.writeFileSync(deltaPath, JSON.stringify(delta));
console.log(`Arquivo delta salvo em: ${deltaPath} (${(fs.statSync(deltaPath).size / 1024).toFixed(1)} KB)`);
