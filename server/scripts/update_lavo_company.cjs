const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.resolve(__dirname, '../storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

console.log('--- ATUALIZANDO LAVO JIF LAVANDERIAS LTDA NO BANCO ---');
const res = db.prepare(`
  UPDATE companies SET
    emite_nfse = 1,
    inscricao_municipal = '3181601958',
    nfse_prefeitura_padrao = 'São Gonçalo dos Campos',
    cnae_padrao = '9601701',
    item_servico_padrao = '14.10',
    codigo_tributacao_municipio = '1410',
    nfse_aliquota_padrao = 5.0,
    nfse_provedor = 'prefeitura_direta'
  WHERE cnpj = '60248404000120'
`).run();

console.log('Linhas atualizadas:', res.changes);

const c = db.prepare("SELECT id, cnpj, razao_social, inscricao_municipal, emite_nfse, nfse_prefeitura_padrao FROM companies WHERE cnpj = '60248404000120'").get();
console.log('Dados atualizados da Lavo:', c);
