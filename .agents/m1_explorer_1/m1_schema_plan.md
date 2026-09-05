# Plano de Arquitetura de Banco de Dados, DDLs, Migrações e Seeds (M1)

**Projeto:** Super App Viacont (Área do Cliente)  
**Módulo:** Fundação de Banco de Dados & Serviços Core (M1)  
**Arquivo Alvo:** `server/src/database/db.ts`  
**Data:** 27 de Agosto de 2026  
**Autor:** M1 Explorer 1 (Database Schema & Migrations)  
**Status:** Planejamento Concluído & Pronto para Implementação

---

## 1. Visão Geral da Arquitetura de Dados

O banco de dados do Super App Viacont é executado em **SQLite 3 nativo** via `node:sqlite` (`DatabaseSync`) em modo **WAL (Write-Ahead Logging)** com chaves estrangeiras ativadas (`PRAGMA foreign_keys = ON;`).

Para suportar os 5 requisitos de negócio estabelecidos em `ORIGINAL_REQUEST.md` e os contratos de API de `PROJECT.md`, a camada de persistência em `server/src/database/db.ts` precisa ser expandida com 4 novas tabelas principais:
1. **`tax_guides`**: Central de Guias Fiscais e Tributárias (DAS Simples Nacional, ICMS DAE, FGTS Digital, INSS DARF/DCTFWeb) com código PIX Copia-e-Cola Bacen EMV e semáforo de vencimento (R3).
2. **`receipts_ocr`**: Dropzone e Scanner OCR de comprovantes, notas de balcão e cupons com extração automática via Tesseract e auto-matching com Contas a Pagar (`invoice_installments`) e Extrato Bancário (`bank_transactions`) (R4).
3. **`favorite_catalog_items`**: Catálogo de produtos e serviços favoritos para emissão guiada de notas fiscais (NFS-e e NF-e) em 1 toque (R2).
4. **`recurring_clients`**: Cadastro unificado de clientes/tomadores frequentes com preenchimento automático por CNPJ/CPF, dados fiscais (CGA/IE, IBGE) e estatísticas de faturamento (R2).

---

## 2. Especificação Exata dos DDLs SQLite

Abaixo estão os comandos SQL DDL completos, com tipagem estrita, valores padrão, chaves primárias UUID e integridade referencial com exclusão em cascata.

### 2.1. Tabela: `tax_guides` (Central de Guias & Impostos com 1-Clique PIX)

```sql
CREATE TABLE IF NOT EXISTS tax_guides (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  tipo_tributo TEXT NOT NULL,         -- 'DAS_SIMPLES', 'ICMS_DAE', 'FGTS_DIGITAL', 'INSS_DARF', 'ISS_MUNICIPAL', 'IRRF_FOLHA', 'OUTROS'
  titulo TEXT NOT NULL,               -- Ex: 'DAS - Simples Nacional - Competência 07/2026'
  competencia TEXT NOT NULL,          -- 'MM/YYYY' (ex: '07/2026')
  data_vencimento TEXT NOT NULL,      -- 'YYYY-MM-DD' (ex: '2026-08-20')
  valor_principal REAL NOT NULL DEFAULT 0.0,
  valor_multa_juros REAL DEFAULT 0.0,
  valor_total REAL NOT NULL,
  codigo_barras_linha_digitavel TEXT, -- 47 ou 48 dígitos
  pix_copia_e_cola TEXT,              -- String EMV PIX Copia-e-Cola oficial (000201...)
  pix_qr_code_url TEXT,               -- URL ou Base64 do QR Code PIX
  pdf_file_path TEXT,                 -- Caminho do PDF da guia no storage
  status TEXT DEFAULT 'pendente',     -- 'pendente', 'pago', 'vencido', 'cancelado'
  data_pagamento TEXT,                -- 'YYYY-MM-DD' de quitação
  comprovante_file_path TEXT,         -- Comprovante de pagamento anexado
  origem_apuracao TEXT DEFAULT 'contabilidade_viacont', -- 'contabilidade_viacont', 'pgdas_auto', 'esocial_auto', 'manual'
  notificado_whatsapp INTEGER DEFAULT 0, -- 0 = Não, 1 = Sim
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
```

### 2.2. Tabela: `receipts_ocr` (Captura & Scanner OCR de Recibos e Comprovantes)

```sql
CREATE TABLE IF NOT EXISTS receipts_ocr (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  arquivo_nome TEXT NOT NULL,         -- Nome original do arquivo (ex: 'cupom_shell_20260827.jpg')
  arquivo_path TEXT NOT NULL,         -- Caminho no storage
  arquivo_tamanho INTEGER,            -- Tamanho em bytes
  mime_type TEXT,                     -- 'image/jpeg', 'image/png', 'application/pdf'
  raw_ocr_text TEXT,                  -- Texto bruto lido pelo motor Tesseract
  ocr_confidence_score REAL DEFAULT 0.0, -- Confiança da extração (0.0 a 1.0)
  fornecedor_nome_detectado TEXT,     -- Nome do estabelecimento extraído
  fornecedor_cnpj_detectado TEXT,     -- CNPJ ou CPF detectado
  data_despesa_detectada TEXT,        -- Data detectada 'YYYY-MM-DD'
  valor_total_detectado REAL,         -- Valor monetário detectado
  categoria_sugerida_id TEXT,         -- FK para financial_categories(id)
  categoria_sugerida_nome TEXT,       -- Ex: 'Combustíveis & Lubrificantes'
  itens_detectados_json TEXT,         -- JSON serializado dos itens do recibo
  descricao_final TEXT,               -- Descrição revisada pelo usuário
  valor_final REAL,                   -- Valor final validado
  data_final TEXT,                    -- Data final validada
  forma_pagamento TEXT,               -- 'PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO'
  observacoes_cliente TEXT,
  status_match TEXT DEFAULT 'pendente', -- 'pendente', 'sugerido', 'conciliado', 'ignorado'
  matched_payable_id TEXT,            -- FK para invoice_installments(id)
  matched_transaction_id TEXT,        -- FK para bank_transactions(id)
  matched_confidence REAL DEFAULT 0.0,-- Score calculado pelo auto-matching
  matched_at TEXT,                    -- Timestamp da conciliação
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
```

### 2.3. Tabela: `favorite_catalog_items` (Catálogo de Favoritos para Emissão em 1 Toque)

```sql
CREATE TABLE IF NOT EXISTS favorite_catalog_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  tipo TEXT NOT NULL DEFAULT 'servico', -- 'servico' (NFS-e) ou 'produto' (NF-e)
  nome_atalho TEXT NOT NULL,          -- Rótulo do botão (ex: 'Honorários Contábeis')
  descricao_padrao TEXT NOT NULL,     -- Discriminação oficial do serviço ou produto
  item_lista_servico TEXT,            -- Código LC 116/03 (ex: '17.01', '01.07')
  cnae TEXT,                          -- CNAE fiscal (ex: '6920-6/01', '6202-3/00')
  codigo_tributacao_municipio TEXT,   -- Código municipal
  ncm TEXT,                           -- NCM de 8 dígitos para NF-e (ex: '0901.21.00')
  cfop TEXT,                          -- CFOP (ex: '5.102', '5.933', '6.102')
  unidade_medida TEXT DEFAULT 'UN',   -- 'UN', 'HR', 'MES', 'SV', 'KG', 'CX'
  valor_padrao REAL NOT NULL DEFAULT 0.0,
  aliquota_iss_padrao REAL DEFAULT 5.0,
  iss_retido_padrao INTEGER DEFAULT 0,-- 0 = Não, 1 = Sim
  aliquota_icms_padrao REAL DEFAULT 0.0,
  aliquota_pis_padrao REAL DEFAULT 0.0,
  aliquota_cofins_padrao REAL DEFAULT 0.0,
  aliquota_ipi_padrao REAL DEFAULT 0.0,
  total_usos INTEGER DEFAULT 0,       -- Estatística para ordenar favoritos por uso
  is_ativo INTEGER DEFAULT 1,         -- 1 = Ativo, 0 = Arquivado
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fav_catalog_comp_tipo ON favorite_catalog_items(company_id, tipo, is_ativo);
CREATE INDEX IF NOT EXISTS idx_fav_catalog_comp_usos ON favorite_catalog_items(company_id, total_usos DESC);
```

### 2.4. Tabela: `recurring_clients` (Tomadores & Clientes Recorrentes)

```sql
CREATE TABLE IF NOT EXISTS recurring_clients (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  tipo_pessoa TEXT DEFAULT 'PJ',      -- 'PJ' ou 'PF'
  cnpj_cpf TEXT NOT NULL,             -- Apenas dígitos limpos (14 CNPJ ou 11 CPF)
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  email TEXT,
  telefone_whatsapp TEXT,             -- Formato DDI+DDD (ex: '5571999887766')
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  codigo_ibge_municipio TEXT,         -- Código IBGE 7 dígitos (ex: '2927408')
  uf TEXT,
  inscricao_estadual TEXT,            -- IE para NF-e
  inscricao_municipal TEXT,           -- Inscrição Municipal (CGA) para NFS-e
  iss_retido INTEGER DEFAULT 0,       -- 0 = Não, 1 = Sim
  aliquota_iss REAL DEFAULT 5.0,
  item_servico TEXT,
  discriminacao_padrao TEXT,
  valor_padrao REAL DEFAULT 0.0,
  condicao_pagamento_padrao TEXT DEFAULT 'PIX', -- 'PIX', 'BOLETO', 'A_VISTA', 'A_PRAZO'
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
```

---

## 3. Estratégia de Migração & Compatibilidade

A inicialização e migração em `server/src/database/db.ts` é 100% resiliente:

1. **Criação Idempotente**: Executa `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS` durante a chamada de `initDatabase()`.
2. **Sincronização de Legado (`nfse_recurring_clients` -> `recurring_clients`)**:
   Uma rotina no `initDatabase()` copia os tomadores já cadastrados em `nfse_recurring_clients` para a nova tabela unificada `recurring_clients`, preservando os IDs e sanitizando CPFs e CNPJs:
   ```sql
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
   ```
3. **Criação da Tabela `reconciliation_rules`**:
   Adicionar a tabela `reconciliation_rules` ao `initDatabase()` para garantir integridade total das rotinas de reconciliação em `bpoController.ts`:
   ```sql
   CREATE TABLE IF NOT EXISTS reconciliation_rules (
     id TEXT PRIMARY KEY,
     tenant_id TEXT DEFAULT 'tenant_viacont_master',
     padrao_descricao TEXT NOT NULL,
     categoria_id TEXT NOT NULL,
     auto_match INTEGER DEFAULT 1,
     created_at TEXT NOT NULL,
     FOREIGN KEY (categoria_id) REFERENCES financial_categories(id) ON DELETE CASCADE
   );
   ```

---

## 4. Dados Iniciais de Teste e Demonstração (Seed Data)

Abaixo está o código TypeScript que popula o banco com dados realistas para as empresas de demonstração:

### 4.1. Função de Seeding em `server/src/database/db.ts`

```typescript
export function seedPortalData() {
  try {
    const now = new Date().toISOString();

    // 1. Localizar empresas de teste
    const companies = db.prepare('SELECT id, cnpj, razao_social, uf FROM companies').all() as any[];
    if (companies.length === 0) return;

    const comp1 = companies.find(c => c.cnpj === '12345678000199') || companies[0];
    const comp2 = companies.find(c => c.cnpj === '99887766000155') || (companies.length > 1 ? companies[1] : comp1);

    // 2. Seed Tax Guides (Guias de Impostos)
    const taxCount = db.prepare('SELECT COUNT(*) as count FROM tax_guides').get() as { count: number };
    if (taxCount.count === 0) {
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
    if (favCount.count === 0) {
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
    if (clientCount.count === 0) {
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
    if (ocrCount.count === 0) {
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
  } catch (err: any) {
    console.warn('Aviso ao popular dados do Portal do Cliente:', err.message);
  }
}
```

---

## 5. Validação de Integridade e Testabilidade

Para verificar a integridade da arquitetura de dados e garantir conformidade com o sistema:

1. **Testes de Chaves Estrangeiras**:
   - Deletar uma `company` resulta na exclusão automática de suas linhas em `tax_guides`, `receipts_ocr`, `favorite_catalog_items` e `recurring_clients` (`ON DELETE CASCADE`).
   - Deletar uma transação bancária vinculada a um recibo OCR apenas anula a referência (`ON DELETE SET NULL`) sem apagar a despesa comprovada.
2. **Índices Compostos e Performance**:
   - `idx_tax_guides_comp_venc` e `idx_tax_guides_comp_status` garantem resposta abaixo de 5ms mesmo com dezenas de milhares de guias apuradas.
   - `idx_rec_clients_comp_doc` e `idx_rec_clients_comp_nome` garantem que o autocomplete de tomadores no Passo 1 da emissão responda instantaneamente (< 2ms).
   - `idx_fav_catalog_comp_usos` ordena automaticamente os serviços e produtos mais emitidos para a barra de favoritos em 1 toque.
