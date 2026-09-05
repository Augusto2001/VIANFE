# BRIEFING — 2026-08-27T20:11:00Z

## Mission
Investigate backend codebase, database schema, tables, routes, services, PIX generation, and calculate required SQL queries for client dashboard and tax guides.

## 🔒 My Identity
- Archetype: explorer
- Roles: Backend Survey Explorer
- Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend
- Original parent: 1a72486c-b132-4d4b-aa36-ded225f14610
- Milestone: Survey Phase

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in source code
- Self-contained handoff report at handoff.md

## Current Parent
- Conversation ID: 1a72486c-b132-4d4b-aa36-ded225f14610
- Updated: 2026-08-27T20:11:00Z

## Investigation State
- **Explored paths**:
  - `server/src/database/db.ts`
  - `server/src/controllers/portalController.ts`
  - `server/src/services/portalService.ts`
  - `server/src/routes/api.ts`
  - `server/src/controllers/bpoController.ts`
  - `server/src/types/portal.ts`
  - `tests/e2e/test_runner.js`
  - `tests/e2e/engines/pix.js`
  - `tests/e2e/engines/simples.js`
  - `tests/e2e/engines/portal_state.js`
  - `client/src/services/api.ts`
  - `client/src/components/ClientPortalView.tsx`
  - `client/src/components/portal/PortalDashboardTab.tsx`
  - `client/src/components/portal/PortalTaxGuidesTab.tsx`
- **Key findings**:
  - SQLite database using `node:sqlite` (`DatabaseSync`) at `storage/data/fiscal_hub.db`.
  - Mapped all relevant tables: `companies`, `bank_accounts`, `bank_transactions`, `invoices`, `invoice_installments`, `accounting_provisions`, `tax_guides`.
  - Identified hardcoded mock fallbacks in `server/src/services/portalService.ts:739, 748, 756, 775, 776, 797` that must be replaced by 100% real SQL queries returning strict `0.00` when empty.
  - Validated PIX EMV BRCode generation with CRC16-CCITT and TLV encoding.
  - Specified exact SQL queries for Saldo no Caixa, A Receber Este Mês, A Pagar Este Mês, Termômetro do Simples Nacional (RBT12), e Guias com PIX.
- **Unexplored areas**: None for backend survey scope.

## Key Decisions Made
- Fully documented all table structures, columns, relationships, and exact SQL queries in `handoff.md`.

## Artifact Index
- `c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend\handoff.md` — Final survey handoff report
- `c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend\progress.md` — Progress status
- `c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend\DISPATCH.md` — Received dispatch log
