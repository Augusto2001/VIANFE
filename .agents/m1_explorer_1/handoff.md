# Handoff Report — M1 Explorer 1 (Database Schema & Migrations)

## 1. Observation
- **Database Engine & Configuration**: `server/src/database/db.ts` initializes SQLite using Node.js 22 built-in `node:sqlite` (`DatabaseSync`) with `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;` (lines 20-25).
- **Existing Schema**: `initDatabase()` in `server/src/database/db.ts` defines 21 tables including `companies`, `invoices`, `gdrive_configs`, `sync_logs`, `system_settings`, `tenants`, `users`, `user_companies`, `nfe_manifestations`, `bank_accounts`, `financial_categories`, `bank_transactions`, `dominio_chart_of_accounts`, `accounting_provisions`, `financial_attachments`, `nfse_issued`, `nfse_recurring_clients`, `password_resets`, `support_tickets`, `invoice_installments`, `sefaz_audit_logs`.
- **Target Requirements**: `ORIGINAL_REQUEST.md` (§R1-§R5) and `PROJECT.md` (§3, Milestone M1) require dedicated persistent data models for:
  1. `tax_guides` (R3: Central de Guias Fiscais DAS, ICMS, Folha/FGTS com PIX Copia-e-Cola e status de vencimento).
  2. `receipts_ocr` (R4: Dropzone/Scanner OCR de recibos e cupons fiscais com extração de dados e auto-match com contas a pagar e transações).
  3. `favorite_catalog_items` (R2: Catálogo de produtos e serviços favoritos para emissão guiada em 1 toque).
  4. `recurring_clients` (R2: Cadastro unificado de clientes/tomadores com dados para emissão rápida de NFS-e e NF-e).
- **Legacy Compatibility**: `nfse_recurring_clients` is currently used in `server/src/controllers/nfseController.ts` (lines 568, 592, 624). The new `recurring_clients` table unifies both NFS-e and NF-e recipients and supports automatic migration of existing rows.
- **Related Dependency**: `server/src/controllers/bpoController.ts` (line 73) queries `reconciliation_rules`, which was missing from the base DDL in `initDatabase()`.

## 2. Logic Chain
1. **Multi-Tenancy & Integrity**: All 4 new tables must include `company_id TEXT NOT NULL` and `tenant_id TEXT DEFAULT 'tenant_viacont_master'`, with `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE` and `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`. This preserves strict tenant isolation.
2. **Query Performance**: The Super App portal features frequent filtering (e.g., tax guides filtered by status and due date, autocomplete searching for recurring clients by CNPJ/CPF and Razão Social, active catalog favorites ordered by usage frequency). Thus, dedicated composite indices (`idx_tax_guides_comp_venc`, `idx_tax_guides_comp_status`, `idx_receipts_ocr_comp_date`, `idx_fav_catalog_comp_usos`, `idx_rec_clients_comp_doc`) are specified.
3. **Receipts & Auto-Matching Structure**: `receipts_ocr` includes raw OCR text (`raw_ocr_text`), confidence score (`ocr_confidence_score`), detected vs user-validated fields (`fornecedor_nome_detectado`, `descricao_final`, `valor_final`), and foreign keys to `financial_categories(id)`, `invoice_installments(id)`, and `bank_transactions(id)` with `ON DELETE SET NULL`.
4. **Smooth Migration**: In `initDatabase()`, an idempotent `INSERT OR IGNORE INTO recurring_clients (...) SELECT ... FROM nfse_recurring_clients;` statement migrates existing municipal service clients without schema disruption or data loss.
5. **Realistic Seeding**: Comprehensive seed records for all 4 tables with authentic Brazilian tax codes (DAS, DAE ICMS, FGTS Digital, DCTFWeb, LC 116 17.01, NCMs, CFOPs, and valid EMV PIX payloads) enable immediate manual and automated testing.

## 3. Caveats
- No caveats. The SQLite schemas, DDLs, indices, migrations, and seed data are fully specified and align with all contracts in `PROJECT.md` and `ORIGINAL_REQUEST.md`.

## 4. Conclusion
The comprehensive schema, migration, and seed data plan has been fully authored in `.agents/m1_explorer_1/m1_schema_plan.md`. The DDL statements are ready to be integrated into `server/src/database/db.ts` during M1 implementation.

## 5. Verification Method
- **File Inspection**: Inspect `.agents/m1_explorer_1/m1_schema_plan.md` for complete DDLs, index definitions, and TypeScript seed functions.
- **SQL DDL Syntax & Migration Check**: When implemented in `server/src/database/db.ts`, execute `initDatabase()` and verify table creation:
  - `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tax_guides', 'receipts_ocr', 'favorite_catalog_items', 'recurring_clients', 'reconciliation_rules');`
  - `PRAGMA foreign_key_check;` returns 0 violations.
- **Build Verification**: Run `npm run build --prefix server` and `npm run build --prefix client` to ensure no syntax or type errors.
