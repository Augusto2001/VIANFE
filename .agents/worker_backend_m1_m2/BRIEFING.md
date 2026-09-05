# BRIEFING — 2026-08-27T20:17:30Z

## Mission
Eliminate mock fallbacks and implement genuine SQL calculations for Portal Dashboard (M1) and Dynamic Tax Guides with PIX EMV (M2) in `portalService.ts`, and add route alias in `api.ts`.

## 🔒 My Identity
- Archetype: Backend Worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_backend_m1_m2
- Original parent: 1a72486c-b132-4d4b-aa36-ded225f14610
- Milestone: M1 & M2 (Backend)

## 🔒 Key Constraints
- Exclusively Owned Files: `server/src/services/portalService.ts`, `server/src/routes/api.ts`
- Zero hardcoded mock fallback values (e.g. 158450.20, 12500.00, 28400.00, 1850000.00, 20000+i*2500, etc.)
- All metrics strictly computed from database tables (`bank_accounts`, `bank_transactions`, `invoice_installments`, `invoices`, `accounting_provisions`, `tax_guides`)
- If data is empty, return exact zeroed / empty structures (e.g. 0.00, Faixa 1 Sem Faturamento, zeroed daily cash flow)
- PIX payload generated genuinely with valid EMV format and CRC16-CCITT checksum based on company CNPJ and provision amount
- Register route alias `/portal/dashboard-summary`
- Server must build with 0 TypeScript/compilation errors

## Current Parent
- Conversation ID: 1a72486c-b132-4d4b-aa36-ded225f14610
- Updated: 2026-08-27T20:17:30Z

## Task Summary
- **What to build**: Real-time SQL aggregations in `portalService.ts` for M1 dashboard summary and M2 tax guides with PIX EMV, plus `/portal/dashboard-summary` route in `api.ts`.
- **Success criteria**: Genuine calculations without mocks; valid PIX EMV; zero build errors.
- **Interface contracts**: `.agents/PROJECT.md`
- **Code layout**: `server/src/services/portalService.ts`, `server/src/routes/api.ts`

## Key Decisions Made
1. In `server/src/routes/api.ts`, registered `/portal/dashboard-summary` route alias pointing to `portalController.getDashboardSummary`.
2. In `server/src/services/portalService.ts`:
   - Updated `computeSimplesNacionalGauge` to explicitly return `rbt12: 0.00`, `percentual_atingido_estadual: 0.00`, `percentual_atingido_federal: 0.00`, `aliquota_efetiva: 0.00`, `faixa_atual: "Faixa 1 (Sem Faturamento)"` when `rbt12 <= 0`.
   - Updated `getDashboardSummary` to compute real-time:
     - `bank_balance`: `SUM(saldo_atual)` from `bank_accounts` + (credits - debits from `bank_transactions`) for `company_id`.
     - `payables_today`: `SUM(valor)` from open `invoice_installments` (tipo 'pagar') + open `accounting_provisions` (status 'provisionado') for `company_id`.
     - `receivables_today`: `SUM(valor)` from open `invoice_installments` (tipo 'receber') + authorized/issued `invoices` (saída/NFS-e) this month for `company_id`.
     - `projected_end_of_day`: `bank_balance + receivables_today - payables_today`.
     - `cash_flow_forecast`: Real 30-day projection based on scheduled invoice installments or `{ inflow: 0, outflow: 0, net: 0 }`.
     - `simples_nacional`: Real 12-month revenue sum from `invoices` with monthly breakdown.
   - Updated `getTaxGuides` to dynamically query `accounting_provisions`, synthesize tax guides for `DAS_SIMPLES`, `ICMS_DAE`, `FOLHA_SALARIOS`, `INSS_DARF`, `FGTS_DIGITAL`, `IRRF_FOLHA`, and generate real EMV BR Code PIX with CRC16-CCITT checksum for each guide.

## Artifact Index
- `.agents/worker_backend_m1_m2/DISPATCH.md` — Assignment dispatch
- `.agents/worker_backend_m1_m2/BRIEFING.md` — Agent briefing & memory
- `.agents/worker_backend_m1_m2/progress.md` — Heartbeat & progress log
- `.agents/worker_backend_m1_m2/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**:
  - `server/src/routes/api.ts`: Added route alias for `/portal/dashboard-summary`
  - `server/src/services/portalService.ts`: Removed all mock fallbacks; implemented deterministic SQL metrics and dynamic tax guides synthesis with PIX EMV
- **Build status**: Verified clean TypeScript compilation / syntax
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (0 syntax or typing errors)
- **Lint status**: Clean
- **Tests added/modified**: Covered by E2E test suites (Tiers 1-4)

## Loaded Skills
- None requested
