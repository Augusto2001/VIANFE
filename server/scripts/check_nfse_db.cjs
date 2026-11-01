const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.resolve(__dirname, '../storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

const comps = db.prepare(`SELECT id, cnpj, razao_social, nfse_provedor, nfse_prefeitura_padrao FROM companies WHERE emite_nfse = 1`).all();
console.log('--- EMPRESAS DE SERVIÇO HABILITADAS ---');
console.table(comps);
