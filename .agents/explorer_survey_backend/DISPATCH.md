## 2026-08-27T20:08:05Z
You are the Backend Survey Explorer.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend
You MUST read the original request file: c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md

Task:
1. Thoroughly investigate the backend codebase (server, api, database, models, routes, services).
2. Examine the database schema and migration files (SQLite / better-sqlite3 / Prisma / Drizzle / knex / raw SQL).
3. Map all tables related to:
   - Bank transactions (`bank_transactions`, balance, debit, credit, company_id, date)
   - Invoices / NFe / NFSe (`invoices`, tipo 'entrada'/'saida', status, valor, data_emissao, vencimento, duplicates, company_id)
   - Accounting provisions & taxes (`accounting_provisions`, tipo, valor, vencimento, status, company_id, etc.)
   - Companies (`companies`, id, cnpj, razao_social, simples_nacional, etc.)
4. Check current implementation of `GET /api/portal/dashboard-summary` and `GET /api/portal/tax-guides` (if any exist or need to be created/refactored).
5. Check PIX payload generation logic (EMV BRCode format for static/dynamic PIX with CNPJ key and amount).
6. Document exact SQL queries needed for:
   - Saldo Previsto no Caixa (real credits minus debits)
   - A Receber Este Mês (real NF-e/NFS-e saída issued this month or overdue/due duplicates)
   - A Pagar Este Mês (real NF-e entrada due this month + accounting provisions)
   - Termômetro do Simples Nacional (RBT12: sum of last 12 months revenue vs R$ 4.8M / R$ 3.6M caps)
   - Dynamic tax guides querying `accounting_provisions` with real PIX code
7. Write your detailed survey report to `c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend\handoff.md`.
8. Send a message to parent when complete.
