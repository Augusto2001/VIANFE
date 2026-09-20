import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { runJlComercioFullIngestion, JL_COMPANY_ID } from '../services/jlComercioIngestionService.js';
import { reclassifyAndSanitizeDatabase } from '../utils/fiscalClassifier.js';

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
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
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
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
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

    -- Multi-Office SaaS Tenants Table (Escritórios Contábeis)
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT,
      plan TEXT DEFAULT 'pro',
      status TEXT DEFAULT 'ativo',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Multi-tenant Auth Tables for Accounting Offices & Client Companies
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'client', -- 'admin' (Accounting Office) vs 'client' (Company Client)
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_companies (
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      PRIMARY KEY (user_id, company_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nfe_manifestations (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL, -- 'ciencia', 'confirmacao', 'desconhecimento', 'nao_realizada'
      event_code TEXT NOT NULL, -- '210210', '210200', '210220', '210240'
      justificativa TEXT,
      sefaz_protocol TEXT,
      sefaz_nsu TEXT,
      status TEXT DEFAULT 'autorizado',
      manifested_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- BPO FINANCEIRO: Contas Bancárias
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      banco_nome TEXT NOT NULL, -- 'Itaú', 'Bradesco', 'Banco do Brasil', 'Santander', 'Inter', 'Nubank', 'Sicoob', etc.
      banco_codigo TEXT,
      agencia TEXT,
      conta TEXT,
      tipo_conta TEXT DEFAULT 'corrente', -- 'corrente', 'poupanca', 'investimento'
      saldo_inicial REAL DEFAULT 0.0,
      saldo_atual REAL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- BPO FINANCEIRO: Categorias & Plano de Contas Domínio
    CREATE TABLE IF NOT EXISTS financial_categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      codigo TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'receita', 'despesa', 'imposto', 'folha', 'transferencia'
      conta_debito_dominio TEXT,
      conta_credito_dominio TEXT,
      created_at TEXT NOT NULL
    );

    -- BPO FINANCEIRO: Transações Bancárias & Conciliação Lado a Lado
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      bank_account_id TEXT,
      data TEXT NOT NULL,
      descricao_original TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'CREDITO' ou 'DEBITO'
      valor REAL NOT NULL,
      documento TEXT,
      conciliado INTEGER DEFAULT 0,
      categoria_id TEXT,
      invoice_id TEXT,
      observacoes_cliente TEXT,
      foto_comprovante_url TEXT,
      conciliado_em TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (categoria_id) REFERENCES financial_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    );

    -- BPO FINANCEIRO: Plano de Contas Oficial Importado da Domínio Sistemas
    CREATE TABLE IF NOT EXISTS dominio_chart_of_accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      codigo_conta TEXT NOT NULL, -- Código reduzido da Domínio (ex: 10, 150, 420)
      classificacao TEXT NOT NULL, -- Classificação contábil (ex: 1.1.01.01.001)
      nome_conta TEXT NOT NULL, -- Descrição (ex: Caixa Geral, Banco Itaú, Fornecedores a Pagar)
      tipo_conta TEXT DEFAULT 'analitica', -- 'sintetica' ou 'analitica'
      natureza TEXT DEFAULT 'D', -- 'D' (Devedora) ou 'C' (Credora)
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- BPO FINANCEIRO: Provisões Contábeis Automáticas (Folha de Pagamento & Impostos)
    CREATE TABLE IF NOT EXISTS accounting_provisions (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      tipo_provisao TEXT NOT NULL, -- 'FOLHA_SALARIOS', 'INSS_EMPRESA', 'FGTS', 'FERIAS_13', 'DAS_SIMPLES', 'ICMS', 'PIS_COFINS'
      competencia TEXT NOT NULL, -- '08/2026'
      data_lancamento TEXT NOT NULL, -- '2026-08-31'
      valor REAL NOT NULL,
      conta_debito TEXT NOT NULL, -- Código ou classificação contábil
      conta_credito TEXT NOT NULL, -- Código ou classificação contábil
      historico TEXT NOT NULL,
      status TEXT DEFAULT 'provisionado', -- 'provisionado', 'conciliado_pago'
      documento_ref TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- BPO FINANCEIRO: Anexos e Comprovantes Arrastados (Dropzone de Documentos)
    CREATE TABLE IF NOT EXISTS financial_attachments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      transaction_id TEXT,
      provision_id TEXT,
      tipo_documento TEXT NOT NULL, -- 'comprovante_pix', 'folha_pagamento', 'guia_imposto', 'extrato_pdf', 'outros'
      nome_arquivo TEXT NOT NULL,
      caminho_arquivo TEXT NOT NULL,
      tamanho_bytes INTEGER,
      valor_detectado REAL,
      data_detectada TEXT,
      status_processamento TEXT DEFAULT 'processado',
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (provision_id) REFERENCES accounting_provisions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chart_accounts_comp ON dominio_chart_of_accounts(company_id, codigo_conta);
    CREATE INDEX IF NOT EXISTS idx_provisions_comp ON accounting_provisions(company_id, competencia);
    CREATE INDEX IF NOT EXISTS idx_attachments_comp ON financial_attachments(company_id);

    -- NFS-e Prefeituras & Portal Nacional ADN Table (com Integração WhatsApp n8n)
    CREATE TABLE IF NOT EXISTS nfse_issued (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      prefeitura TEXT NOT NULL, -- 'Salvador', 'Feira de Santana', 'Lauro de Freitas', 'São Gonçalo dos Campos', 'Curitiba', 'Portal Nacional ADN'
      numero_nfse TEXT,
      codigo_verificacao TEXT,
      prestador_cnpj TEXT NOT NULL,
      tomador_cnpj TEXT NOT NULL,
      tomador_nome TEXT NOT NULL,
      valor_servicos REAL NOT NULL,
      aliquota_iss REAL DEFAULT 5.0,
      valor_iss REAL DEFAULT 0.0,
      discriminacao_servico TEXT NOT NULL,
      status TEXT DEFAULT 'emitida',
      pdf_url TEXT,
      whatsapp_phone TEXT,
      issued_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- NFS-e Tomadores de Serviços
    CREATE TABLE IF NOT EXISTS nfse_recurring_clients (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      cnpj_cpf TEXT NOT NULL,
      razao_social TEXT NOT NULL,
      email TEXT,
      telefone_whatsapp TEXT,
      cep TEXT,
      logradouro TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      municipio TEXT,
      uf TEXT,
      iss_retido INTEGER DEFAULT 0, -- 0 = Não, 1 = Sim
      aliquota_iss REAL DEFAULT 5.0,
      item_servico TEXT, -- ex: '17.01'
      discriminacao_padrao TEXT,
      valor_padrao REAL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_nfse_recurring_comp ON nfse_recurring_clients(company_id, cnpj_cpf);
    CREATE INDEX IF NOT EXISTS idx_nfse_company ON nfse_issued(company_id);
    CREATE INDEX IF NOT EXISTS idx_manifest_invoice ON nfe_manifestations(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- Table for E-Mail Password Reset Tokens (Security Expiry 30 min)
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Suporte Técnico & Central de Demandas / Ocorrências
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      company_id TEXT,
      company_name TEXT,
      solicitante_nome TEXT NOT NULL,
      solicitante_phone TEXT NOT NULL,
      tipo_demanda TEXT NOT NULL,
      mensagem_erro TEXT NOT NULL,
      status TEXT DEFAULT 'aberto',
      solucao TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    -- Configurações Globais do Sistema (2Captcha, Notificações, Webhooks)
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );

    -- BPO FINANCEIRO: Radar de Alertas Preditivos no WhatsApp (Anti-Spam & Auditoria)
    CREATE TABLE IF NOT EXISTS predictive_alerts_log (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      item_type TEXT NOT NULL, -- 'payable', 'tax_guide', 'invoice_duplicate'
      item_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      message_preview TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_predictive_alerts_comp ON predictive_alerts_log(company_id, item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_pwd_resets_token ON password_resets(token);
  `);

  // Migrate nfse_recurring_clients for address columns if missing
  try {
    const tomadorInfo = db.prepare("PRAGMA table_info('nfse_recurring_clients')").all() as any[];
    const tomCols = tomadorInfo.map(c => c.name);
    ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf'].forEach(col => {
      if (!tomCols.includes(col)) {
        db.exec(`ALTER TABLE nfse_recurring_clients ADD COLUMN ${col} TEXT;`);
      }
    });
  } catch (e) {
    // Ignore migration error
  }

  // Migrate companies table for NFS-e columns if missing
  try {
    const compInfo = db.prepare("PRAGMA table_info('companies')").all() as any[];
    const compCols = compInfo.map(c => c.name);
    
    if (!compCols.includes('emite_nfse')) {
      db.exec("ALTER TABLE companies ADD COLUMN emite_nfse INTEGER DEFAULT 0;");
    }
    if (!compCols.includes('nfse_tipo_auth')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_tipo_auth TEXT DEFAULT 'certificado';");
    }
    if (!compCols.includes('nfse_usuario_prefeitura')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_usuario_prefeitura TEXT;");
    }
    if (!compCols.includes('nfse_senha_prefeitura')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_senha_prefeitura TEXT;");
    }
    if (!compCols.includes('nfse_prefeitura_padrao')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_prefeitura_padrao TEXT DEFAULT 'Salvador';");
    }
    if (!compCols.includes('nfse_aliquota_padrao')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_aliquota_padrao REAL DEFAULT 5.0;");
    }
    if (!compCols.includes('nfse_iss_retido_padrao')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_iss_retido_padrao INTEGER DEFAULT 0;");
    }
    if (!compCols.includes('inscricao_municipal')) {
      db.exec("ALTER TABLE companies ADD COLUMN inscricao_municipal TEXT;");
    }
    if (!compCols.includes('item_servico_padrao')) {
      db.exec("ALTER TABLE companies ADD COLUMN item_servico_padrao TEXT DEFAULT '17.01';");
    }
    if (!compCols.includes('cnae_padrao')) {
      db.exec("ALTER TABLE companies ADD COLUMN cnae_padrao TEXT;");
    }
    if (!compCols.includes('codigo_tributacao_municipio')) {
      db.exec("ALTER TABLE companies ADD COLUMN codigo_tributacao_municipio TEXT;");
    }
    if (!compCols.includes('ultimo_rps_numero')) {
      db.exec("ALTER TABLE companies ADD COLUMN ultimo_rps_numero INTEGER DEFAULT 0;");
    }
    if (!compCols.includes('serie_rps')) {
      db.exec("ALTER TABLE companies ADD COLUMN serie_rps TEXT DEFAULT '1';");
    }
    if (!compCols.includes('focus_nfe_token')) {
      db.exec("ALTER TABLE companies ADD COLUMN focus_nfe_token TEXT;");
    }
    if (!compCols.includes('nfse_provedor')) {
      db.exec("ALTER TABLE companies ADD COLUMN nfse_provedor TEXT DEFAULT 'focus_nfe';");
    }
  } catch (e) {
    // Ignore migration error
  }

  // Migrate nfse_issued for RPS columns if missing
  try {
    const nfseInfo = db.prepare("PRAGMA table_info('nfse_issued')").all() as any[];
    const nfseCols = nfseInfo.map(c => c.name);
    if (!nfseCols.includes('numero_rps')) {
      db.exec("ALTER TABLE nfse_issued ADD COLUMN numero_rps TEXT;");
    }
    if (!nfseCols.includes('serie_rps')) {
      db.exec("ALTER TABLE nfse_issued ADD COLUMN serie_rps TEXT DEFAULT '1';");
    }
  } catch (e) {
    // Ignore migration error
  }

  // Migrate existing users table if tenant_id column missing
  try {
    const tableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
    const hasTenantId = tableInfo.some(c => c.name === 'tenant_id');
    if (!hasTenantId) {
      db.prepare("ALTER TABLE users ADD COLUMN tenant_id TEXT DEFAULT 'tenant_viacont_master'").run();
      console.log('✓ Column tenant_id added to users table successfully.');
    }
  } catch (e: any) {
    // Ignore if column already exists
  }

  // Migrate existing companies table if tenant_id column missing
  try {
    const compTableInfo = db.prepare("PRAGMA table_info('companies')").all() as any[];
    const hasCompTenantId = compTableInfo.some(c => c.name === 'tenant_id');
    if (!hasCompTenantId) {
      db.prepare("ALTER TABLE companies ADD COLUMN tenant_id TEXT DEFAULT 'tenant_viacont_master'").run();
      console.log('✓ Column tenant_id added to companies table successfully.');
    }
  } catch (e: any) {
    // Ignore if column already exists
  }

  // Seed Viacont Master Admin User & Master Tenant
  seedMasterAdmin();

  // Seed default financial categories if empty
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM financial_categories').get() as { count: number };
    if (catCount.count === 0) {
      const defaultCategories = [
        { id: 'cat_01', codigo: '01.01.01', nome: 'Compras de Mercadorias para Revenda', tipo: 'despesa', deb: '1.1.03.01', cred: '2.1.01.01' },
        { id: 'cat_02', codigo: '01.01.02', nome: 'Compras de Insumos e Alimentos (Carnes/Bebidas)', tipo: 'despesa', deb: '1.1.03.02', cred: '2.1.01.01' },
        { id: 'cat_03', codigo: '01.02.01', nome: 'Receita de Vendas no Cartão de Crédito', tipo: 'receita', deb: '1.1.01.02', cred: '3.1.01.01' },
        { id: 'cat_04', codigo: '01.02.02', nome: 'Receita de Vendas no Cartão de Débito', tipo: 'receita', deb: '1.1.01.02', cred: '3.1.01.01' },
        { id: 'cat_05', codigo: '01.02.03', nome: 'Receita de Vendas no PIX', tipo: 'receita', deb: '1.1.01.01', cred: '3.1.01.01' },
        { id: 'cat_06', codigo: '02.01.01', nome: 'Salários e Pró-Labore', tipo: 'folha', deb: '4.1.01.01', cred: '2.1.02.01' },
        { id: 'cat_07', codigo: '02.01.02', nome: 'FGTS e Encargos Sociais', tipo: 'folha', deb: '4.1.01.02', cred: '2.1.02.02' },
        { id: 'cat_08', codigo: '02.02.01', nome: 'DAS - Simples Nacional', tipo: 'imposto', deb: '4.1.02.01', cred: '2.1.03.01' },
        { id: 'cat_09', codigo: '02.02.02', nome: 'DARF - Impostos Federais', tipo: 'imposto', deb: '4.1.02.02', cred: '2.1.03.02' },
        { id: 'cat_10', codigo: '02.02.03', nome: 'DAE - ICMS Estadual', tipo: 'imposto', deb: '4.1.02.03', cred: '2.1.03.03' },
        { id: 'cat_11', codigo: '03.01.01', nome: 'Energia Elétrica (Enel/Coelba)', tipo: 'despesa', deb: '4.1.03.01', cred: '1.1.01.01' },
        { id: 'cat_12', codigo: '03.01.02', nome: 'Água e Esgoto (Embasa)', tipo: 'despesa', deb: '4.1.03.02', cred: '1.1.01.01' },
        { id: 'cat_13', codigo: '03.02.01', nome: 'Tarifas e Despesas Bancárias', tipo: 'despesa', deb: '4.2.01.01', cred: '1.1.01.01' },
        { id: 'cat_14', codigo: '03.02.02', nome: 'Taxas de Maquininhas de Cartão (MDR)', tipo: 'despesa', deb: '4.2.01.02', cred: '1.1.01.01' },
        { id: 'cat_15', codigo: '03.03.01', nome: 'Honorários Contábeis Viacont', tipo: 'despesa', deb: '4.1.04.01', cred: '2.1.01.02' }
      ];

      const stmt = db.prepare(`
        INSERT INTO financial_categories (id, tenant_id, codigo, nome, tipo, conta_debito_dominio, conta_credito_dominio, created_at)
        VALUES (?, 'tenant_viacont_master', ?, ?, ?, ?, ?, datetime('now'))
      `);

      for (const cat of defaultCategories) {
        stmt.run(cat.id, cat.codigo, cat.nome, cat.tipo, cat.deb, cat.cred);
      }
      console.log('✓ Categorias financeiras padrão e contas Domínio inseridas com sucesso.');
    }
  } catch (err: any) {
    console.warn('Aviso ao inicializar categorias financeiras:', err.message);
  }

  try {
    db.exec("ALTER TABLE companies ADD COLUMN focus_nfe_token TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE companies ADD COLUMN nfse_provedor TEXT DEFAULT 'focus_nfe';");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE invoices ADD COLUMN fatura_json TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE invoices ADD COLUMN duplicatas_json TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE invoices ADD COLUMN pagamentos_json TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE invoices ADD COLUMN transporte_json TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE invoices ADD COLUMN info_adicional TEXT;");
  } catch (_) {}

  // BPO FINANCEIRO: Extensão de colunas para Conciliação Lado a Lado estilo Conta Azul
  try {
    db.exec("ALTER TABLE bank_transactions ADD COLUMN fornecedor_cliente_nome TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE bank_transactions ADD COLUMN centro_custo TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE bank_transactions ADD COLUMN descricao_custom TEXT;");
  } catch (_) {}
  try {
    db.exec("ALTER TABLE bank_transactions ADD COLUMN forma_lancamento TEXT DEFAULT 'novo_lancamento';");
  } catch (_) {}

  // BPO FINANCEIRO: Tabela de Parcelas / Duplicatas (Contas a Pagar / Contas a Receber)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_installments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'pagar' (compra) vs 'receber' (venda)
      numero_fatura TEXT,
      numero_parcela TEXT NOT NULL,
      data_vencimento TEXT NOT NULL,
      valor REAL NOT NULL,
      status TEXT DEFAULT 'pendente', -- 'pendente', 'pago', 'conciliado', 'cancelado'
      forma_pagamento TEXT,
      fornecedor_cliente_nome TEXT,
      fornecedor_cliente_cnpj TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_installments_company ON invoice_installments(company_id, data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_installments_invoice ON invoice_installments(invoice_id);

    -- AUDITORIA SEFAZ ROBUSTA (Camada 1 ERP)
    CREATE TABLE IF NOT EXISTS sefaz_audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      cnpj TEXT NOT NULL,
      razao_social TEXT NOT NULL,
      nsu_inicial TEXT,
      nsu_final TEXT,
      max_nsu TEXT,
      notas_localizadas INTEGER DEFAULT 0,
      notas_baixadas INTEGER DEFAULT 0,
      cstat TEXT,
      xmotivo TEXT,
      trigger_type TEXT DEFAULT 'agendado', -- 'agendado' | 'manual'
      duracao_ms INTEGER DEFAULT 0,
      iniciado_em TEXT NOT NULL,
      finalizado_em TEXT,
      status TEXT NOT NULL, -- 'sucesso' | 'bloqueado_carência' | 'fora_da_janela' | 'erro'
      detalhes_json TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sefaz_audit_company ON sefaz_audit_logs(company_id, iniciado_em);

    -- ========================================================================
    -- SUPER APP VIACONT (ÁREA DO CLIENTE) - TABELAS CORE (M1)
    -- ========================================================================

    -- R3: Central de Guias & Impostos com 1-Clique PIX
    CREATE TABLE IF NOT EXISTS tax_guides (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      tipo_tributo TEXT NOT NULL, -- 'DAS_SIMPLES', 'ICMS_DAE', 'FGTS_DIGITAL', 'INSS_DARF', 'ISS_MUNICIPAL', 'IRRF_FOLHA', 'OUTROS'
      titulo TEXT NOT NULL,
      competencia TEXT NOT NULL, -- '07/2026'
      data_vencimento TEXT NOT NULL, -- 'YYYY-MM-DD'
      valor_principal REAL NOT NULL DEFAULT 0.0,
      valor_multa_juros REAL DEFAULT 0.0,
      valor_total REAL NOT NULL,
      codigo_barras_linha_digitavel TEXT,
      pix_copia_e_cola TEXT,
      pix_qr_code_url TEXT,
      pdf_file_path TEXT,
      status TEXT DEFAULT 'pendente', -- 'pendente', 'pago', 'vencido', 'cancelado'
      data_pagamento TEXT,
      comprovante_file_path TEXT,
      origem_apuracao TEXT DEFAULT 'contabilidade_viacont',
      notificado_whatsapp INTEGER DEFAULT 0,
      notificado_em TEXT,
      observacoes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tax_guides_comp_venc ON tax_guides(company_id, data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_tax_guides_comp_status ON tax_guides(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_tax_guides_comp_competencia ON tax_guides(company_id, competencia);

    -- R4: Captura & Scanner OCR de Recibos e Comprovantes
    CREATE TABLE IF NOT EXISTS receipts_ocr (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      arquivo_nome TEXT NOT NULL,
      arquivo_path TEXT NOT NULL,
      arquivo_tamanho INTEGER,
      mime_type TEXT,
      raw_ocr_text TEXT,
      ocr_confidence_score REAL DEFAULT 0.0,
      fornecedor_nome_detectado TEXT,
      fornecedor_cnpj_detectado TEXT,
      data_despesa_detectada TEXT,
      valor_total_detectado REAL,
      categoria_sugerida_id TEXT,
      categoria_sugerida_nome TEXT,
      itens_detectados_json TEXT,
      descricao_final TEXT,
      valor_final REAL,
      data_final TEXT,
      forma_pagamento TEXT,
      observacoes_cliente TEXT,
      status_match TEXT DEFAULT 'pendente', -- 'pendente', 'sugerido', 'conciliado', 'ignorado'
      matched_payable_id TEXT,
      matched_transaction_id TEXT,
      matched_confidence REAL DEFAULT 0.0,
      matched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (categoria_sugerida_id) REFERENCES financial_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (matched_payable_id) REFERENCES invoice_installments(id) ON DELETE SET NULL,
      FOREIGN KEY (matched_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_ocr_comp_date ON receipts_ocr(company_id, data_final);
    CREATE INDEX IF NOT EXISTS idx_receipts_ocr_comp_status ON receipts_ocr(company_id, status_match);
    CREATE INDEX IF NOT EXISTS idx_receipts_ocr_created ON receipts_ocr(company_id, created_at DESC);

    -- R2: Catálogo de Produtos e Serviços Favoritos para Emissão em 1 Toque
    CREATE TABLE IF NOT EXISTS favorite_catalog_items (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      tipo TEXT NOT NULL DEFAULT 'servico', -- 'servico' ou 'produto'
      nome_atalho TEXT NOT NULL,
      descricao_padrao TEXT NOT NULL,
      item_lista_servico TEXT,
      cnae TEXT,
      codigo_tributacao_municipio TEXT,
      ncm TEXT,
      cfop TEXT,
      unidade_medida TEXT DEFAULT 'UN',
      valor_padrao REAL NOT NULL DEFAULT 0.0,
      aliquota_iss_padrao REAL DEFAULT 5.0,
      iss_retido_padrao INTEGER DEFAULT 0,
      aliquota_icms_padrao REAL DEFAULT 0.0,
      aliquota_pis_padrao REAL DEFAULT 0.0,
      aliquota_cofins_padrao REAL DEFAULT 0.0,
      aliquota_ipi_padrao REAL DEFAULT 0.0,
      total_usos INTEGER DEFAULT 0,
      is_ativo INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_fav_catalog_comp_tipo ON favorite_catalog_items(company_id, tipo, is_ativo);
    CREATE INDEX IF NOT EXISTS idx_fav_catalog_comp_usos ON favorite_catalog_items(company_id, total_usos DESC);

    -- R2: Clientes e Tomadores Recorrentes (Autopreenchimento no Passo 1)
    CREATE TABLE IF NOT EXISTS recurring_clients (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      tipo_pessoa TEXT DEFAULT 'PJ', -- 'PJ' ou 'PF'
      cnpj_cpf TEXT NOT NULL,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      email TEXT,
      telefone_whatsapp TEXT,
      cep TEXT,
      logradouro TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      municipio TEXT,
      codigo_ibge_municipio TEXT,
      uf TEXT,
      inscricao_estadual TEXT,
      inscricao_municipal TEXT,
      iss_retido INTEGER DEFAULT 0,
      aliquota_iss REAL DEFAULT 5.0,
      item_servico TEXT,
      discriminacao_padrao TEXT,
      valor_padrao REAL DEFAULT 0.0,
      condicao_pagamento_padrao TEXT DEFAULT 'PIX',
      total_notas_emitidas INTEGER DEFAULT 0,
      valor_total_emitido REAL DEFAULT 0.0,
      ultimo_servico_utilizado TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_rec_clients_comp_doc ON recurring_clients(company_id, cnpj_cpf);
    CREATE INDEX IF NOT EXISTS idx_rec_clients_comp_nome ON recurring_clients(company_id, razao_social);
    CREATE INDEX IF NOT EXISTS idx_rec_clients_comp_notas ON recurring_clients(company_id, total_notas_emitidas DESC);

    -- Regras de Reconciliação Bancária BPO
    CREATE TABLE IF NOT EXISTS reconciliation_rules (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'tenant_viacont_master',
      padrao_descricao TEXT NOT NULL,
      categoria_id TEXT NOT NULL,
      auto_match INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES financial_categories(id) ON DELETE CASCADE
    );
  `);

  // Migrações de colunas para bloqueio e carência SEFAZ
  for (const column of ['sefaz_cstat', 'sefaz_xmotivo']) {
    if (!(db.prepare('PRAGMA table_info(nfe_manifestations)').all() as any[]).some(c => c.name === column)) {
      db.exec(`ALTER TABLE nfe_manifestations ADD COLUMN ${column} TEXT`);
    }
  }
  try { db.exec("ALTER TABLE companies ADD COLUMN sefaz_locked_until TEXT;"); } catch {}
  try { db.exec("ALTER TABLE companies ADD COLUMN sefaz_last_cstat TEXT;"); } catch {}
  try { db.exec("ALTER TABLE companies ADD COLUMN sefaz_last_xmotivo TEXT;"); } catch {}

  // Sincronização legado: copiar tomadores de nfse_recurring_clients para recurring_clients
  try {
    db.exec(`
      INSERT OR IGNORE INTO recurring_clients (
        id, company_id, tenant_id, tipo_pessoa, cnpj_cpf, razao_social, 
        email, telefone_whatsapp, cep, logradouro, numero, complemento, 
        bairro, municipio, uf, iss_retido, aliquota_iss, item_servico, 
        discriminacao_padrao, valor_padrao, condicao_pagamento_padrao, 
        total_notas_emitidas, valor_total_emitido, created_at, updated_at
      )
      SELECT 
        id, company_id, 'tenant_viacont_master', 
        CASE WHEN LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '/', ''), '-', '')) <= 11 THEN 'PF' ELSE 'PJ' END,
        REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '/', ''), '-', ''),
        razao_social, email, telefone_whatsapp, cep, logradouro, numero, complemento,
        bairro, municipio, uf, iss_retido, aliquota_iss, item_servico,
        discriminacao_padrao, valor_padrao, 'PIX', 0, 0.0, created_at, created_at
      FROM nfse_recurring_clients;
    `);
  } catch (e) {
    // Ignore migration sync error
  }

  // Seed Viacont Master Admin User & Master Tenant
  seedMasterAdmin();

  // Seed Super App Viacont Portal demo data (tax guides, favorites, clients, receipts)
  seedPortalData();

  // Ingest JL Comercio (Leandro Gomes) 2026 Fiscal Invoices from Google Drive
  try {
    const jlCount = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE company_id = ?').get(JL_COMPANY_ID) as { c: number } | undefined;
    if (!jlCount || jlCount.c < 1442) {
      console.log(`[JL Comércio Ingest] Verificando notas de 2026 no Google Drive (atual: ${jlCount?.c || 0})...`);
      runJlComercioFullIngestion(db);
    }
  } catch (jlErr: any) {
    console.warn('[JL Comércio Ingest] Aviso durante ingestão automática:', jlErr.message);
  }

  // Automated fiscal direction audit & reclassification across all companies
  try {
    reclassifyAndSanitizeDatabase(db);

    // Also sanitize server/database.sqlite if it exists
    const altDbPath = path.resolve(__dirname, '../../database.sqlite');
    if (fs.existsSync(altDbPath)) {
      try {
        const altDb = new DatabaseSync(altDbPath);
        const hasInvoices = altDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'").get();
        if (hasInvoices) {
          console.log('[Reclassificação] Saneando base alternativa database.sqlite...');
          reclassifyAndSanitizeDatabase(altDb);
        }
      } catch (altErr: any) {
        console.warn('Aviso ao verificar database.sqlite:', altErr.message);
      }
    }
  } catch (reclassErr: any) {
    console.error('Erro na reclassificação fiscal automática:', reclassErr);
  }

  console.log('✓ SQLite Database tables and indexes initialized successfully.');
}

function seedMasterAdmin() {
  try {
    const now = new Date().toISOString();

    // 1. Seed Viacont Tenant Master
    const tenantId = 'tenant_viacont_master';
    const existingTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(tenantId);
    if (!existingTenant) {
      db.prepare(`
        INSERT INTO tenants (id, name, cnpj, plan, status, created_at, updated_at)
        VALUES (?, 'Viacont Inovações Contábeis', '00000000000199', 'enterprise', 'ativo', ?, ?)
      `).run(tenantId, now, now);
      console.log('✓ Master Tenant (Viacont Inovações Contábeis) seeded successfully.');
    }

    // 2. Seed / Update Master Admin User
    const adminEmail = 'augustocesarcontdados@gmail.com';
    const hash = bcrypt.hashSync('Mud@r123', 12);
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (id, tenant_id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ('usr_admin_viacont_master', ?, 'Augusto César (Viacont)', ?, ?, 'admin', 1, ?, ?)
      `).run(tenantId, adminEmail, hash, now, now);
      console.log('✓ Master Admin user (augustocesarcontdados@gmail.com) seeded successfully.');
    } else {
      db.prepare(`
        UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?
      `).run(hash, now, adminEmail);
      console.log('✓ Master Admin user password updated to Mud@r123 successfully.');
    }
  } catch (err: any) {
    console.warn('Could not seed master admin or tenant:', err.message);
  }
}

export function seedPortalData() {
  try {
    const now = new Date().toISOString();

    // 1. Localizar ou criar empresas de demonstração
    let companies = db.prepare('SELECT id, cnpj, razao_social, uf FROM companies').all() as any[];
    if (companies.length === 0) {
      const comp1Id = 'comp_viacont_demo_01';
      const comp2Id = 'comp_viacont_demo_02';
      db.prepare(`
        INSERT INTO companies (id, cnpj, razao_social, nome_fantasia, uf, status, sefaz_ambiente, created_at, updated_at)
        VALUES (?, '12345678000199', 'VIACONT INOVACOES CONTABEIS LTDA', 'Viacont Inovações', 'BA', 'ativo', 'producao', ?, ?)
      `).run(comp1Id, now, now);
      db.prepare(`
        INSERT INTO companies (id, cnpj, razao_social, nome_fantasia, uf, status, sefaz_ambiente, created_at, updated_at)
        VALUES (?, '99887766000155', 'METALURGICA SUL BRASIL LTDA', 'Metalúrgica Sul', 'PR', 'ativo', 'producao', ?, ?)
      `).run(comp2Id, now, now);
      companies = db.prepare('SELECT id, cnpj, razao_social, uf FROM companies').all() as any[];
    }

    const comp1 = companies.find((c: any) => c.cnpj === '12345678000199') || companies[0];

    // Associar usuário master a todas as empresas
    const masterUser = db.prepare("SELECT id FROM users WHERE email = 'augustocesarcontdados@gmail.com'").get() as { id: string } | undefined;
    if (masterUser && companies.length > 0) {
      for (const comp of companies) {
        db.prepare(`
          INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)
        `).run(masterUser.id, comp.id);
      }
    }

    // 2. Seed Tax Guides (Guias de Impostos)
    const taxCount = db.prepare('SELECT COUNT(*) as count FROM tax_guides').get() as { count: number };
    if (taxCount.count === 0 && comp1) {
      const sampleGuides = [
        {
          id: 'guide_das_07_2026',
          company_id: comp1.id,
          tenant_id: 'tenant_viacont_master',
          tipo_tributo: 'DAS_SIMPLES',
          titulo: 'DAS Simples Nacional - Competência 07/2026',
          competencia: '07/2026',
          data_vencimento: '2026-08-20',
          valor_principal: 4820.50,
          valor_multa_juros: 0.0,
          valor_total: 4820.50,
          codigo_barras_linha_digitavel: '858000000482 05000328260 82000000000 00000000000',
          pix_copia_e_cola: '00020126580014br.gov.bcb.pix0136das-viacont-202607-00152040000530398654044820.505802BR5925VIACONT INOVACOES CONTAB6008SALVADOR62140510DAS2026079963047A1B',
          pdf_file_path: '/storage/pdfs/DAS_202607_12345678000199.pdf',
          status: 'pendente',
          origem_apuracao: 'pgdas_auto'
        },
        {
          id: 'guide_icms_08_2026',
          company_id: comp1.id,
          tenant_id: 'tenant_viacont_master',
          tipo_tributo: 'ICMS_DAE',
          titulo: 'DAE ICMS Antecipação Tributária - 08/2026',
          competencia: '08/2026',
          data_vencimento: '2026-08-25',
          valor_principal: 1340.80,
          valor_multa_juros: 0.0,
          valor_total: 1340.80,
          codigo_barras_linha_digitavel: '858500000134 08000192260 82500000000 00000000000',
          pix_copia_e_cola: '00020126580014br.gov.bcb.pix0136dae-sefaz-ba-202608-00252040000530398654041340.805802BR5925SEFAZ ESTADO DA BAHIA6008SALVADOR62140510DAE2026084463045E8C',
          pdf_file_path: '/storage/pdfs/DAE_202608_12345678000199.pdf',
          status: 'pago',
          data_pagamento: '2026-08-25',
          origem_apuracao: 'contabilidade_viacont'
        },
        {
          id: 'guide_fgts_08_2026',
          company_id: comp1.id,
          tenant_id: 'tenant_viacont_master',
          tipo_tributo: 'FGTS_DIGITAL',
          titulo: 'FGTS Digital - Guia Rápida PIX - 08/2026',
          competencia: '08/2026',
          data_vencimento: '2026-09-20',
          valor_principal: 890.40,
          valor_multa_juros: 0.0,
          valor_total: 890.40,
          codigo_barras_linha_digitavel: '858200000089 04000199260 92000000000 00000000000',
          pix_copia_e_cola: '00020126580014br.gov.bcb.pix0136fgts-digital-caixa-2026085204000053039865403890.405802BR5925CAIXA ECONOMICA FEDERAL6008BRASILIA62140510FGTS202608116304C49F',
          pdf_file_path: '/storage/pdfs/FGTS_202608_12345678000199.pdf',
          status: 'pendente',
          origem_apuracao: 'esocial_auto'
        },
        {
          id: 'guide_inss_08_2026',
          company_id: comp1.id,
          tenant_id: 'tenant_viacont_master',
          tipo_tributo: 'INSS_DARF',
          titulo: 'DARF Previdenciário DCTFWeb - 08/2026',
          competencia: '08/2026',
          data_vencimento: '2026-09-20',
          valor_principal: 1760.00,
          valor_multa_juros: 0.0,
          valor_total: 1760.00,
          codigo_barras_linha_digitavel: '858100000176 00000199260 92000000000 00000000000',
          pix_copia_e_cola: '00020126580014br.gov.bcb.pix0136darf-receita-federal-20260852040000530398654041760.005802BR5925RECEITA FEDERAL DO BRASIL6008BRASILIA62140510DARF2026089963049F2D',
          pdf_file_path: '/storage/pdfs/DARF_202608_12345678000199.pdf',
          status: 'pendente',
          origem_apuracao: 'esocial_auto'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO tax_guides (
          id, company_id, tenant_id, tipo_tributo, titulo, competencia, 
          data_vencimento, valor_principal, valor_multa_juros, valor_total, 
          codigo_barras_linha_digitavel, pix_copia_e_cola, pdf_file_path, 
          status, data_pagamento, origem_apuracao, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const g of sampleGuides) {
        stmt.run(
          g.id, g.company_id, g.tenant_id, g.tipo_tributo, g.titulo, g.competencia,
          g.data_vencimento, g.valor_principal, g.valor_multa_juros, g.valor_total,
          g.codigo_barras_linha_digitavel, g.pix_copia_e_cola, g.pdf_file_path,
          g.status, g.data_pagamento || null, g.origem_apuracao, now, now
        );
      }
      console.log('✓ Guias de impostos (tax_guides) populadas com sucesso.');
    }

    // 3. Seed Favorite Catalog Items (Catálogo de Favoritos em 1 Toque)
    const favCount = db.prepare('SELECT COUNT(*) as count FROM favorite_catalog_items').get() as { count: number };
    if (favCount.count === 0 && comp1) {
      const sampleFavorites = [
        {
          id: 'fav_item_01',
          company_id: comp1.id,
          tipo: 'servico',
          nome_atalho: 'Honorários Contábeis e Assessoria',
          descricao_padrao: 'Prestação de serviços contábeis, escrituração fiscal, folha de pagamento e apuração de tributos mensais.',
          item_lista_servico: '17.01',
          cnae: '6920-6/01',
          codigo_tributacao_municipio: '17.01',
          unidade_medida: 'MES',
          valor_padrao: 1500.00,
          aliquota_iss_padrao: 5.0,
          iss_retido_padrao: 0,
          total_usos: 48
        },
        {
          id: 'fav_item_02',
          company_id: comp1.id,
          tipo: 'servico',
          nome_atalho: 'Consultoria Financeira e BPO',
          descricao_padrao: 'Consultoria de gestão financeira empresarial, fluxo de caixa diário e conciliação bancária mensal.',
          item_lista_servico: '17.01',
          cnae: '6920-6/01',
          codigo_tributacao_municipio: '17.01',
          unidade_medida: 'SV',
          valor_padrao: 2800.00,
          aliquota_iss_padrao: 5.0,
          iss_retido_padrao: 0,
          total_usos: 32
        },
        {
          id: 'fav_item_03',
          company_id: comp1.id,
          tipo: 'servico',
          nome_atalho: 'Manutenção de Servidores e Redes',
          descricao_padrao: 'Suporte técnico, segurança de dados e manutenção preventiva da infraestrutura de servidores e TI.',
          item_lista_servico: '01.07',
          cnae: '6202-3/00',
          codigo_tributacao_municipio: '01.07',
          unidade_medida: 'HR',
          valor_padrao: 950.00,
          aliquota_iss_padrao: 2.0,
          iss_retido_padrao: 0,
          total_usos: 19
        },
        {
          id: 'fav_item_04',
          company_id: comp1.id,
          tipo: 'produto',
          nome_atalho: 'Venda de Café Especial Torrado 1kg',
          descricao_padrao: 'Café Especial 100% Arábica Gourmet torrado em grãos - Embalagem laminada com válvula 1kg.',
          ncm: '0901.21.00',
          cfop: '5.102',
          unidade_medida: 'UN',
          valor_padrao: 85.00,
          aliquota_icms_padrao: 18.0,
          total_usos: 64
        },
        {
          id: 'fav_item_05',
          company_id: comp1.id,
          tipo: 'produto',
          nome_atalho: 'Embalagens Térmicas Kraft (Caixa c/ 100)',
          descricao_padrao: 'Embalagens descartáveis térmicas em papel kraft biodegradável para transporte de alimentos.',
          ncm: '4819.10.00',
          cfop: '5.102',
          unidade_medida: 'CX',
          valor_padrao: 120.00,
          aliquota_icms_padrao: 18.0,
          total_usos: 27
        }
      ];

      const stmtFav = db.prepare(`
        INSERT INTO favorite_catalog_items (
          id, company_id, tenant_id, tipo, nome_atalho, descricao_padrao,
          item_lista_servico, cnae, codigo_tributacao_municipio, ncm, cfop,
          unidade_medida, valor_padrao, aliquota_iss_padrao, iss_retido_padrao,
          aliquota_icms_padrao, total_usos, is_ativo, created_at, updated_at
        ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);

      for (const fav of sampleFavorites) {
        stmtFav.run(
          fav.id, fav.company_id, fav.tipo, fav.nome_atalho, fav.descricao_padrao,
          fav.item_lista_servico || null, fav.cnae || null, fav.codigo_tributacao_municipio || null,
          fav.ncm || null, fav.cfop || null, fav.unidade_medida, fav.valor_padrao,
          fav.aliquota_iss_padrao || 0.0, fav.iss_retido_padrao || 0, fav.aliquota_icms_padrao || 0.0,
          fav.total_usos, now, now
        );
      }
      console.log('✓ Catálogo de favoritos (favorite_catalog_items) populado com sucesso.');
    }

    // 4. Seed Recurring Clients (Tomadores e Clientes Recorrentes)
    const clientCount = db.prepare('SELECT COUNT(*) as count FROM recurring_clients').get() as { count: number };
    if (clientCount.count === 0 && comp1) {
      const sampleClients = [
        {
          id: 'rec_client_01',
          company_id: comp1.id,
          tipo_pessoa: 'PJ',
          cnpj_cpf: '34581300000123',
          razao_social: 'SALVADOR ESCRITORIO VIRTUAL E COWORKING LTDA',
          nome_fantasia: 'Salvador Hub Coworking',
          email: 'financeiro@salvadorcoworking.com.br',
          telefone_whatsapp: '5571991823344',
          cep: '41820-020',
          logradouro: 'Avenida Tancredo Neves',
          numero: '1632',
          complemento: 'Sala 1001 - Salvador Trade Center',
          bairro: 'Caminho das Árvores',
          municipio: 'Salvador',
          codigo_ibge_municipio: '2927408',
          uf: 'BA',
          inscricao_municipal: '72516200143',
          iss_retido: 0,
          aliquota_iss: 5.0,
          item_servico: '17.01',
          discriminacao_padrao: 'Assessoria contábil mensal e compliance tributário empresarial.',
          valor_padrao: 1500.00,
          condicao_pagamento_padrao: 'PIX',
          total_notas_emitidas: 18,
          valor_total_emitido: 27000.00
        },
        {
          id: 'rec_client_02',
          company_id: comp1.id,
          tipo_pessoa: 'PJ',
          cnpj_cpf: '18492019000188',
          razao_social: 'CLINICA MEDICA SAO RAFAEL LTDA',
          nome_fantasia: 'Clínica São Rafael',
          email: 'contato@clinicasaorafael.med.br',
          telefone_whatsapp: '5571988776655',
          cep: '41810-011',
          logradouro: 'Rua das Hortênsias',
          numero: '450',
          complemento: 'Térreo',
          bairro: 'Pituba',
          municipio: 'Salvador',
          codigo_ibge_municipio: '2927408',
          uf: 'BA',
          inscricao_municipal: '65432100199',
          iss_retido: 0,
          aliquota_iss: 5.0,
          item_servico: '17.01',
          discriminacao_padrao: 'Honorários de gestão financeira e contabilidade médica.',
          valor_padrao: 2200.00,
          condicao_pagamento_padrao: 'PIX',
          total_notas_emitidas: 12,
          valor_total_emitido: 26400.00
        },
        {
          id: 'rec_client_03',
          company_id: comp1.id,
          tipo_pessoa: 'PJ',
          cnpj_cpf: '07382910000144',
          razao_social: 'SUPERMERCADO CENTRAL DA PRATA LTDA',
          nome_fantasia: 'Central Supermercados',
          email: 'compras@supercentralprata.com.br',
          telefone_whatsapp: '5511998811223',
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          numero: '2100',
          complemento: 'Loja 4',
          bairro: 'Bela Vista',
          municipio: 'São Paulo',
          codigo_ibge_municipio: '3550308',
          uf: 'SP',
          inscricao_estadual: '112345678900',
          iss_retido: 0,
          aliquota_iss: 5.0,
          item_servico: '5.102',
          discriminacao_padrao: 'Fornecimento de café especial em grãos para revenda.',
          valor_padrao: 4250.00,
          condicao_pagamento_padrao: 'BOLETO',
          total_notas_emitidas: 24,
          valor_total_emitido: 102000.00
        },
        {
          id: 'rec_client_04',
          company_id: comp1.id,
          tipo_pessoa: 'PF',
          cnpj_cpf: '02938475899',
          razao_social: 'DRA. MARIANA ALVES SILVA',
          nome_fantasia: 'Dra. Mariana Silva',
          email: 'mariana.alves@consultorio.com.br',
          telefone_whatsapp: '5571993344556',
          cep: '42700-000',
          logradouro: 'Rua Silveira Martins',
          numero: '88',
          bairro: 'Vilas do Atlântico',
          municipio: 'Lauro de Freitas',
          codigo_ibge_municipio: '2919207',
          uf: 'BA',
          iss_retido: 0,
          aliquota_iss: 5.0,
          item_servico: '17.01',
          discriminacao_padrao: 'Consultoria e apuração de Carnê-Leão e IRPF.',
          valor_padrao: 850.00,
          condicao_pagamento_padrao: 'PIX',
          total_notas_emitidas: 6,
          valor_total_emitido: 5100.00
        }
      ];

      const stmtClient = db.prepare(`
        INSERT INTO recurring_clients (
          id, company_id, tenant_id, tipo_pessoa, cnpj_cpf, razao_social,
          nome_fantasia, email, telefone_whatsapp, cep, logradouro, numero,
          complemento, bairro, municipio, codigo_ibge_municipio, uf,
          inscricao_estadual, inscricao_municipal, iss_retido, aliquota_iss,
          item_servico, discriminacao_padrao, valor_padrao, condicao_pagamento_padrao,
          total_notas_emitidas, valor_total_emitido, created_at, updated_at
        ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const cli of sampleClients) {
        stmtClient.run(
          cli.id, cli.company_id, cli.tipo_pessoa, cli.cnpj_cpf, cli.razao_social,
          cli.nome_fantasia || null, cli.email || null, cli.telefone_whatsapp || null,
          cli.cep || null, cli.logradouro || null, cli.numero || null,
          cli.complemento || null, cli.bairro || null, cli.municipio || null,
          cli.codigo_ibge_municipio || null, cli.uf || null,
          cli.inscricao_estadual || null, cli.inscricao_municipal || null,
          cli.iss_retido || 0, cli.aliquota_iss || 5.0, cli.item_servico || null,
          cli.discriminacao_padrao || null, cli.valor_padrao || 0.0,
          cli.condicao_pagamento_padrao || 'PIX', cli.total_notas_emitidas || 0,
          cli.valor_total_emitido || 0.0, now, now
        );
      }
      console.log('✓ Clientes recorrentes (recurring_clients) populados com sucesso.');
    }

    // 5. Seed Receipts OCR (Recibos e Comprovantes Capturados)
    const ocrCount = db.prepare('SELECT COUNT(*) as count FROM receipts_ocr').get() as { count: number };
    if (ocrCount.count === 0 && comp1) {
      const sampleReceipts = [
        {
          id: 'ocr_rcp_01',
          company_id: comp1.id,
          arquivo_nome: 'comprovante_combustivel_shell_20260826.jpg',
          arquivo_path: '/storage/receipts/comprovante_shell_01.jpg',
          arquivo_tamanho: 245820,
          mime_type: 'image/jpeg',
          raw_ocr_text: 'POSTO SHELL DA BAHIA LTDA\nCNPJ: 00.123.456/0001-00\nDATA: 26/08/2026 14:32\nGASOLINA COMUM 42.4L x R$ 5.90\nVALOR TOTAL: R$ 250.00\nPAGAMENTO: CARTAO DE DEBITO',
          ocr_confidence_score: 0.96,
          fornecedor_nome_detectado: 'POSTO SHELL DA BAHIA LTDA',
          fornecedor_cnpj_detectado: '00123456000100',
          data_despesa_detectada: '2026-08-26',
          valor_total_detectado: 250.00,
          categoria_sugerida_nome: 'Combustíveis e Lubrificantes',
          descricao_final: 'Abastecimento Frota Comercial - 42.4L Gasolina Comum',
          valor_final: 250.00,
          data_final: '2026-08-26',
          forma_pagamento: 'CARTAO_DEBITO',
          status_match: 'conciliado',
          matched_confidence: 0.98,
          matched_at: '2026-08-26T15:00:00.000Z'
        },
        {
          id: 'ocr_rcp_02',
          company_id: comp1.id,
          arquivo_nome: 'nota_papelaria_kalunga_20260825.pdf',
          arquivo_path: '/storage/receipts/kalunga_nf_02.pdf',
          arquivo_tamanho: 182400,
          mime_type: 'application/pdf',
          raw_ocr_text: 'KALUNGA COMERCIO E INDUSTRIA GRAFICA LTDA\nCNPJ: 43.214.055/0023-90\nDATA EMISSAO: 25/08/2026\nRESMA PAPEL SULFITE A4 75G (5x) R$ 150.00\nCANETAS ESFEROGRAFICAS CX (1x) R$ 35.40\nTOTAL A PAGAR: R$ 185.40\nCONDICAO: PIX',
          ocr_confidence_score: 0.94,
          fornecedor_nome_detectado: 'KALUNGA COMERCIO E INDUSTRIA GRAFICA LTDA',
          fornecedor_cnpj_detectado: '43214055002390',
          data_despesa_detectada: '2026-08-25',
          valor_total_detectado: 185.40,
          categoria_sugerida_nome: 'Material de Escritório & Insumos',
          descricao_final: 'Materiais de escritório para o setor administrativo',
          valor_final: 185.40,
          data_final: '2026-08-25',
          forma_pagamento: 'PIX',
          status_match: 'conciliado',
          matched_confidence: 0.95,
          matched_at: '2026-08-25T17:30:00.000Z'
        },
        {
          id: 'ocr_rcp_03',
          company_id: comp1.id,
          arquivo_nome: 'recibo_restaurante_almoco_20260827.jpg',
          arquivo_path: '/storage/receipts/recibo_almoco_03.jpg',
          arquivo_tamanho: 154200,
          mime_type: 'image/jpeg',
          raw_ocr_text: 'CHURRASCARIA BOI PRETO GRILL LTDA\nCNPJ: 14.882.910/0001-55\nDATA: 27/08/2026 12:45\nREFEICAO BUFFET EXECUTIVO 2 PESSOAS\nSUCO NATURAL (2x) R$ 22.00\nTOTAL R$ 142.00\nFORMA: PIX',
          ocr_confidence_score: 0.91,
          fornecedor_nome_detectado: 'CHURRASCARIA BOI PRETO GRILL LTDA',
          fornecedor_cnpj_detectado: '14882910000155',
          data_despesa_detectada: '2026-08-27',
          valor_total_detectado: 142.00,
          categoria_sugerida_nome: 'Alimentação & Refeições de Trabalho',
          descricao_final: 'Almoço de alinhamento com cliente parceiro',
          valor_final: 142.00,
          data_final: '2026-08-27',
          forma_pagamento: 'PIX',
          status_match: 'pendente',
          matched_confidence: 0.0
        }
      ];

      const stmtOcr = db.prepare(`
        INSERT INTO receipts_ocr (
          id, company_id, tenant_id, arquivo_nome, arquivo_path, arquivo_tamanho,
          mime_type, raw_ocr_text, ocr_confidence_score, fornecedor_nome_detectado,
          fornecedor_cnpj_detectado, data_despesa_detectada, valor_total_detectado,
          categoria_sugerida_nome, descricao_final, valor_final, data_final,
          forma_pagamento, status_match, matched_confidence, matched_at, created_at, updated_at
        ) VALUES (?, ?, 'tenant_viacont_master', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const r of sampleReceipts) {
        stmtOcr.run(
          r.id, r.company_id, r.arquivo_nome, r.arquivo_path, r.arquivo_tamanho,
          r.mime_type, r.raw_ocr_text, r.ocr_confidence_score, r.fornecedor_nome_detectado,
          r.fornecedor_cnpj_detectado, r.data_despesa_detectada, r.valor_total_detectado,
          r.categoria_sugerida_nome, r.descricao_final, r.valor_final, r.data_final,
          r.forma_pagamento, r.status_match, r.matched_confidence, r.matched_at || null,
          now, now
        );
      }
      console.log('✓ Recibos OCR (receipts_ocr) populados com sucesso.');
    }

    // 6. Seed Bank Account and Installments if empty
    const bankCount = db.prepare('SELECT COUNT(*) as count FROM bank_accounts').get() as { count: number };
    if (bankCount.count === 0 && comp1) {
      db.prepare(`
        INSERT INTO bank_accounts (id, company_id, banco_nome, banco_codigo, agencia, conta, tipo_conta, saldo_inicial, saldo_atual, created_at)
        VALUES (?, ?, 'Banco Itaú', '341', '1234', '56789-0', 'corrente', 50000.00, 158450.20, ?)
      `).run('bank_acc_demo_01', comp1.id, now);
    }

    const instCount = db.prepare('SELECT COUNT(*) as count FROM invoice_installments').get() as { count: number };
    if (instCount.count === 0 && comp1) {
      const today = new Date().toISOString().split('T')[0];
      // Payables today
      db.prepare(`
        INSERT INTO invoice_installments (id, invoice_id, company_id, tipo, numero_parcela, data_vencimento, valor, status, fornecedor_cliente_nome, fornecedor_cliente_cnpj, created_at)
        VALUES (?, 'inv_demo_pay_01', ?, 'pagar', '1', ?, 12500.00, 'pendente', 'POSTO SHELL DA BAHIA LTDA', '00123456000100', ?)
      `).run('inst_pay_today_01', comp1.id, today, now);

      // Receivables today
      db.prepare(`
        INSERT INTO invoice_installments (id, invoice_id, company_id, tipo, numero_parcela, data_vencimento, valor, status, fornecedor_cliente_nome, fornecedor_cliente_cnpj, created_at)
        VALUES (?, 'inv_demo_rec_01', ?, 'receber', '1', ?, 28400.00, 'pendente', 'SALVADOR ESCRITORIO VIRTUAL E COWORKING LTDA', '34581300000123', ?)
      `).run('inst_rec_today_01', comp1.id, today, now);
    }

    // 7. Seed Invoices for RBT12 calculation if empty
    const invCount = db.prepare('SELECT COUNT(*) as count FROM invoices').get() as { count: number };
    if (invCount.count === 0 && comp1) {
      const sampleMonthly = [140000, 155000, 160000, 145000, 150000, 165000, 170000, 155000, 160000, 145000, 150000, 155000];
      for (let i = 0; i < sampleMonthly.length; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        const dtStr = d.toISOString().split('T')[0];
        db.prepare(`
          INSERT INTO invoices (
            id, company_id, chave_acesso, numero, serie, tipo, status, data_emissao,
            emitente_cnpj, emitente_nome, emitente_uf, destinatario_cnpj, destinatario_nome,
            destinatario_uf, valor_total, created_at
          ) VALUES (?, ?, ?, ?, '1', 'saida', 'autorizada', ?, ?, ?, 'BA', '34581300000123', 'CLIENTE DEMO LTDA', 'BA', ?, ?)
        `).run(
          `inv_seed_hist_${i}`,
          comp1.id,
          `CHAVE_SEED_2026_${i}_${Date.now()}`,
          `100${i}`,
          dtStr,
          comp1.cnpj,
          comp1.razao_social,
          sampleMonthly[i],
          now
        );
      }
    }
  } catch (err: any) {
    console.warn('Aviso ao popular dados do Portal do Cliente:', err.message);
  }
}

export { STORAGE_DIR, CERTS_DIR, XMLS_DIR, PDFS_DIR, DATA_DIR, reclassifyAndSanitizeDatabase };

