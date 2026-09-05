# Project: Viacont Super App / Client Portal Deterministic Data & Real Metrics

## Architecture
- **Backend Architecture**: Node.js 22 + TypeScript + Express.js + SQLite (`node:sqlite` `DatabaseSync`) at `storage/data/fiscal_hub.db`. Strict parameterization with `WHERE company_id = ?`.
- **Frontend Architecture**: React 18 + TypeScript + Vite + Tailwind CSS (`ClientPortalView.tsx` with `PortalDashboardTab`, `PortalTaxGuidesTab`, `PortalInvoiceIssuerTab`, `PortalReceiptScannerTab`).
- **Data Flow**:
  - Client sends `company.id` in query params (`?company_id=XYZ`).
  - Backend controllers validate `company_id` strictly (rejecting missing parameters with HTTP 400).
  - Services execute deterministic SQL calculations returning exact real sums or strict `0.00` (zero mocks).
  - Dynamic PIX generation uses official BACEN EMV BR Code specifications with CRC16-CCITT checksum based on company CNPJ and amount.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Real-Time Bank Balance Calculation | Credits minus debits from `bank_transactions` + initial balance for `company_id`. Strict 0.00 when empty. | M1 | Survey / R1 |
| 2 | Real-Time Receivables (A Receber) | Open installments + issued NF-e/NFS-e saída this month for `company_id`. Strict 0.00 when empty. | M1 | Survey / R1 |
| 3 | Real-Time Payables (A Pagar) | Open purchase installments + `accounting_provisions` this month for `company_id`. Strict 0.00 when empty. | M1 | Survey / R1 |
| 4 | Simples Nacional RBT12 Thermometer | Sum of last 12 months issued invoices vs R$ 3.6M (subteto) and R$ 4.8M (teto), bracket determination and effective rate calculation. Strict 0.00 when empty. | M1 | Survey / R1 |
| 5 | Route Alias Support | Support both `/api/portal/dashboard-summary` and `/api/portal/dashboard/summary`. | M1 | Survey / R1 |
| 6 | Dynamic Tax Guides Aggregation | Query `accounting_provisions` and `tax_guides` for `company_id` to list all pending and paid tax obligations. | M2 | Survey / R2 |
| 7 | Dynamic Real PIX Generation | Compute EMV BR Code PIX copia-e-cola using company CNPJ, amount, and CRC16-CCITT checksum for each tax obligation. | M2 | Survey / R2 |
| 8 | Frontend Mock Fallback Elimination | Remove all hardcoded mock numbers (158k, 12.5k, 28.4k, 1.85M, Faixa 2, 6.0% rate) in `PortalDashboardTab.tsx` and `PortalTaxGuidesTab.tsx`. | M3 | Survey / R3 |
| 9 | Frontend Deterministic Zero-State | Render strict R$ 0,00, 0,00% gauge, and empty message states when active company has no records. | M3 | Survey / R3 |
| 10 | Frontend Company Switching Continuity | Re-fetch all metrics and tax guides immediately when `company.id` switches. | M3 | Survey / R3 |
| 11 | Strict Multi-Tenant SQL Isolation | Enforce `WHERE company_id = ?` across all portal queries; eliminate fallback to `LIMIT 1` company. | M4 | Survey / R4 |
| 12 | TypeScript Strict Compilation (0 Errors) | Fix `.js` module resolution imports in `bpoController.ts` & `tenantsController.ts`; verify `tsc --noEmit` exits with code 0 on client & server. | M4 | Survey / R4 |
| 13 | E2E & Determinism Test Suite (Tiers 1-4) | Comprehensive opaque-box and integration tests covering multi-tenant isolation, 0.00 fallback, real calculations, and PIX. | M5 | Survey / R4 |
| 14 | Adversarial Hardening (Tier 5) | Stress testing corner cases, edge boundaries, and adversarial isolation probes. | M5 | Survey / R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Real-Time Calculations & Route Endpoints | Remove backend mocks in `portalService.ts`, implement real SQL calculations for Saldo, Receber, Pagar, RBT12, add route alias `/portal/dashboard-summary`. | none | DONE |
| M2 | Dynamic Tax Guides & Real PIX Code Generation | Implement dynamic `accounting_provisions` query and EMV PIX generation in `portalService.ts` / `portalController.ts`. | M1 | DONE |
| M3 | Frontend ClientPortalView 100% Real API Data | Refactor `PortalDashboardTab.tsx` and `PortalTaxGuidesTab.tsx` to eliminate mock fallbacks and render strict 0.00 / real data. | M1, M2 | DONE |
| M4 | Multi-Tenant SQL Strict Isolation & TypeScript Fixes | Fix `portalController.ts` parameter validation, remove `LIMIT 1` leaks, fix NodeNext import extensions in `bpoController.ts` & `tenantsController.ts`. | M1, M2 | DONE |
| M5 | Final Milestone: Full E2E Test Pass (100%) & Adversarial Hardening | Run and pass 100% of E2E test suite (Tiers 1-4) and adversarial verification (Tier 5). | M1, M2, M3, M4 | DONE |

## Interface Contracts
### `GET /api/portal/dashboard-summary?company_id=XYZ` (and `/api/portal/dashboard/summary?company_id=XYZ`)
- **Query Params**: `company_id` (string, required). Returns 400 Bad Request if missing.
- **Response Format**:
  ```json
  {
    "success": true,
    "data": {
      "bank_balance": 0.00,
      "payables_today": 0.00,
      "receivables_today": 0.00,
      "projected_end_of_day": 0.00,
      "cash_flow_forecast": [
        { "data": "2026-08-28", "inflow": 0.00, "outflow": 0.00, "net": 0.00, "projected_balance": 0.00 }
      ],
      "simples_nacional": {
        "rbt12": 0.00,
        "limite_estadual": 3600000.00,
        "limite_federal": 4800000.00,
        "percentual_atingido_estadual": 0.00,
        "percentual_atingido_federal": 0.00,
        "alerta": "normal",
        "faixa_numero": 1,
        "faixa_atual": "Faixa 1 (Sem Faturamento)",
        "anexo": "Anexo III",
        "aliquota_efetiva": 0.00,
        "historico_12m": []
      }
    }
  }
  ```

### `GET /api/portal/tax-guides?company_id=XYZ&status=all&competencia=08/2026`
- **Query Params**: `company_id` (string, required), optional `status`, optional `competencia`.
- **Response Format**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "guide_xxx",
        "company_id": "XYZ",
        "tipo_tributo": "DAS_SIMPLES",
        "titulo": "DAS - Simples Nacional",
        "competencia": "08/2026",
        "data_vencimento": "2026-09-20",
        "valor_total": 4820.50,
        "status": "pendente",
        "pix_copia_e_cola": "00020126...",
        "origem_apuracao": "provisao_contabil"
      }
    ]
  }
  ```

## Code Layout
- `server/src/services/portalService.ts` — Backend SQL calculation engines, PIX generator, Tax guides synthesis. Owned exclusively by M1 & M2.
- `server/src/controllers/portalController.ts` — Route handlers, validation, error handling. Owned by M1, M2 & M4.
- `server/src/routes/api.ts` — Express route mapping. Owned by M1.
- `server/src/controllers/bpoController.ts`, `tenantsController.ts` — TypeScript import extensions. Owned by M4.
- `client/src/components/portal/PortalDashboardTab.tsx` — Dashboard metrics & Simples gauge UI. Owned by M3.
- `client/src/components/portal/PortalTaxGuidesTab.tsx` — Dynamic tax guides & PIX UI. Owned by M3.
- `client/src/components/ClientPortalView.tsx` — Portal shell & context. Owned by M3.
- `client/src/services/api.ts` — API client. Owned by M3.
- `tests/e2e/*` — Test suites, runner, and harnesses. Owned by E2E Testing Track / M5.
