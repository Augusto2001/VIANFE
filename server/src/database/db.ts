import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const DATA_DIR = path.join(STORAGE_DIR, 'data');
const CERTS_DIR = path.join(STORAGE_DIR, 'certs');
const XMLS_DIR = path.join(STORAGE_DIR, 'xmls');
const PDFS_DIR = path.join(STORAGE_DIR, 'pdfs');

// Ensure storage directories exist
[STORAGE_DIR, DATA_DIR, CERTS_DIR, XMLS_DIR, PDFS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const DB_PATH = path.join(DATA_DIR, 'fiscal_hub.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & pragmas
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  // Ignore pragma errors
}

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      cnpj TEXT UNIQUE NOT NULL,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      ie TEXT,
      uf TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      status TEXT DEFAULT 'ativo',
      cert_filename TEXT,
      cert_password_enc TEXT,
      cert_valid_until TEXT,
      sefaz_ambiente TEXT DEFAULT 'producao',
      last_nsu TEXT DEFAULT '0',
      last_sync_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      chave_acesso TEXT UNIQUE NOT NULL,
      numero TEXT NOT NULL,
      serie TEXT NOT NULL,
      modelo TEXT DEFAULT '55',
      tipo TEXT NOT NULL,
      status TEXT DEFAULT 'autorizada',
      natureza_operacao TEXT,
      data_emissao TEXT NOT NULL,
      data_saida_entrada TEXT,
      emitente_cnpj TEXT NOT NULL,
      emitente_nome TEXT NOT NULL,
      emitente_uf TEXT,
      destinatario_cnpj TEXT NOT NULL,
      destinatario_nome TEXT NOT NULL,
      destinatario_uf TEXT,
      valor_total REAL NOT NULL DEFAULT 0.0,
      valor_produtos REAL DEFAULT 0.0,
      valor_icms REAL DEFAULT 0.0,
      valor_pis REAL DEFAULT 0.0,
      valor_cofins REAL DEFAULT 0.0,
      valor_ipi REAL DEFAULT 0.0,
      itens_json TEXT,
      xml_raw TEXT,
      xml_file_path TEXT,
      pdf_file_path TEXT,
      gdrive_synced INTEGER DEFAULT 0,
      gdrive_file_id TEXT,
      gdrive_synced_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON invoices(company_id, data_emissao);
    CREATE INDEX IF NOT EXISTS idx_invoices_chave ON invoices(chave_acesso);
    CREATE INDEX IF NOT EXISTS idx_invoices_tipo ON invoices(company_id, tipo);

    CREATE TABLE IF NOT EXISTS gdrive_configs (
      id TEXT PRIMARY KEY,
      company_id TEXT UNIQUE NOT NULL,
      folder_id TEXT,
      folder_name TEXT,
      folder_path TEXT,
      sync_frequency TEXT DEFAULT 'daily',
      is_active INTEGER DEFAULT 1,
      last_sync_at TEXT,
      last_sync_status TEXT,
      last_sync_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      service_type TEXT NOT NULL,
      status TEXT NOT NULL,
      invoices_found INTEGER DEFAULT 0,
      invoices_downloaded INTEGER DEFAULT 0,
      gdrive_uploaded INTEGER DEFAULT 0,
      message TEXT,
      details_json TEXT,
      executed_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sync_logs_company ON sync_logs(company_id, executed_at);

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  console.log('✓ SQLite Database tables and indexes initialized successfully.');
}

export { STORAGE_DIR, CERTS_DIR, XMLS_DIR, PDFS_DIR, DATA_DIR };
