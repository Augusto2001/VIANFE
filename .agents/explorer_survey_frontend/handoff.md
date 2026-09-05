# Frontend Survey Report: ClientPortalView & Portal Widgets Real Data Integration

## 1. Observation

A complete investigation of the frontend codebase (`client/src`) was executed, specifically inspecting `ClientPortalView.tsx`, its child components in `client/src/components/portal/`, `App.tsx`, `services/api.ts`, and `types/index.ts`.

### 1.1 Architecture & Component Hierarchy
- **Entry Point & Context Injection**: `client/src/App.tsx` (lines 214-220) renders:
  ```tsx
  {activeTab === 'client_portal' && selectedCompany && (
    <ClientPortalView 
      company={selectedCompany} 
      companies={companies}
      onSelectCompany={handleSelectCompany}
    />
  )}
  ```
  The selected company context is passed via the `company` prop (`Company` interface with `id`, `cnpj`, `razao_social`, `uf`, etc.). `ClientPortalView` also supports an in-header company dropdown switcher (`onSelectCompany`) that switches company context across the entire app.

- **Child Tab Components in `client/src/components/`**:
  1. `ClientPortalView.tsx` (397 lines) — Portal Shell, Top Branding Header with company switcher, Tab Bar (Desktop pills & Mobile dock bar), and tab content switcher.
  2. `portal/PortalDashboardTab.tsx` (493 lines) — Financial Diagnostic Dashboard, 4 Metric Cards (Bank balance, Payables today, Receivables today, Projected end of day balance), Simples Nacional RBT12 Thermometer / Gauge, and Cash Flow Forecast Breakdown.
  3. `portal/PortalTaxGuidesTab.tsx` (536 lines) — Tax Guides & Tributos (DAS, ICMS, Folha, INSS, FGTS), 1-Click PIX copy-paste, PDF download, Barcode copy, WhatsApp share, and Payment Confirmation modal.
  4. `portal/PortalInvoiceIssuerTab.tsx` (1162 lines) — 3-step fast invoice issuer (Customer / Item & Values / Review & Emission) with PIX generation, WhatsApp share link, and PDF download.
  5. `portal/PortalReceiptScannerTab.tsx` (518 lines) — Receipt OCR camera/file upload, auto-match with accounts payable, and reconciliation confirmation.
  6. `portal/PortalFavoritesModal.tsx` (552 lines) — Modal catalog for fast 1-touch service/product presets.

### 1.2 Enumeration of Hardcoded Mock Values, Fallbacks, and Simulated Numbers

| Component | Line Number | Exact Code / Snippet | Issue / Mock Description | Required Fix |
|---|---|---|---|---|
| `PortalDashboardTab.tsx` | Line 373 | `{simples?.faixa_atual \|\| \`Faixa ${simples?.faixa_numero \|\| 2}\`}` | If company has no revenue (RBT12 = 0), falls back to `"Faixa 2"` (mock bracket). | Change to `simples?.faixa_atual \|\| 'Faixa 1 (Sem Faturamento)'`. |
| `PortalDashboardTab.tsx` | Line 380 | `{simples?.anexo \|\| 'Anexo III / IV'}` | Falls back to mock string `'Anexo III / IV'` when undefined. | Change to `simples?.anexo \|\| 'Anexo III'`. |
| `PortalDashboardTab.tsx` | Line 387 | `{(simples?.aliquota_efetiva \|\| 6.0).toFixed(2)}%` | Hardcoded fallback `6.0%`! If company has 0 revenue or 0 tax rate, it displays `6.00%`! | Change to `(simples?.aliquota_efetiva ?? 0).toFixed(2)}%` (strict 0.00% when no data). |
| `PortalDashboardTab.tsx` | Line 405-407 | `{simples?.alerta_mensagem \|\| 'Sua empresa está operando com tranquilidade na faixa tributária atual, com margem confortável em relação ao sublimite estadual.'}` | Hardcoded text assumes active operation even with R$ 0,00 faturamento. | Display contextual message based on whether `rbt12 === 0` or real alert message from API. |
| `PortalTaxGuidesTab.tsx` | Line 119 | `const pixCode = guide.pix_copia_e_cola \|\| \`00020126580014br.gov.bcb.pix0136${guide.id}...VIACONT CONTABILIDADE6008SALVADOR...\`;` | Fallback to hardcoded mock static PIX string when `pix_copia_e_cola` is empty. | Use strictly the EMV PIX payload returned from the backend or display a clean fallback if not generated. |
| `PortalTaxGuidesTab.tsx` | Line 309 | `Comp: {guide.competencia \|\| '08/2026'}` | Hardcoded fallback `'08/2026'`. | Change to `guide.competencia \|\| '-'`. |
| `PortalInvoiceIssuerTab.tsx` | Line 57 | `const [municipio, setMunicipio] = useState(company.uf === 'BA' ? 'Salvador' : 'Curitiba');` | Hardcoded city assumption based on UF. | Use empty string or default from company registration data. |
| `server/src/services/portalService.ts` | Line 739 | `const bank_balance = bankRow?.total_saldo !== undefined && bankRow.total_saldo > 0 ? bankRow.total_saldo : 158450.20;` | Backend mock fallback `158450.20`! | Remove fallback; return strict `0.00` when no bank balance. |
| `server/src/services/portalService.ts` | Line 748 | `const payables_today = ... : 12500.00;` | Backend mock fallback `12500.00`! | Return strict `0.00` when no payables. |
| `server/src/services/portalService.ts` | Line 756 | `const receivables_today = ... : 28400.00;` | Backend mock fallback `28400.00`! | Return strict `0.00` when no receivables. |
| `server/src/services/portalService.ts` | Line 775-776 | `inflow = ... (20000 + (i * 2500))`, `outflow = ... (8000 + (i * 1500))` | Backend mock forecast generator. | Return real scheduled payables/receivables or empty list. |
| `server/src/services/portalService.ts` | Line 797 | `const rawRbt12 = ... : 1850000.00;` | Backend mock fallback `1850000.00`! | Return real sum of emitted invoices (`0.00` if none). |

---

## 2. Logic Chain

1. **Company Context Propagation**:
   - `App.tsx` maintains `selectedCompany: Company | null`.
   - When the user selects a company in the header or inside `ClientPortalView`, `company.id` is reliably passed to all tab components as a prop.
   - All `useEffect` hooks in the portal tab components (`PortalDashboardTab`, `PortalTaxGuidesTab`, `PortalInvoiceIssuerTab`, `PortalReceiptScannerTab`) have `[company.id]` in their dependency arrays, ensuring instant re-fetching whenever the active company switches.

2. **API Consumption & Route Alignment**:
   - `client/src/services/api.ts` defines:
     - `api.getPortalDashboardSummary(companyId)` querying `/api/portal/dashboard/summary?company_id=${companyId}`
     - `api.getPortalTaxGuides(companyId, status, competencia)` querying `/api/portal/tax-guides?company_id=${companyId}`
   - The user request requirements specify:
     - `GET /api/portal/dashboard-summary?company_id=XYZ`
     - `GET /api/portal/tax-guides?company_id=XYZ`
   - To guarantee 100% compatibility:
     - The backend routes should alias both `/api/portal/dashboard-summary` and `/api/portal/dashboard/summary`.
     - `client/src/services/api.ts` can consume `/api/portal/dashboard-summary?company_id=${companyId}` (or `/api/portal/dashboard/summary`).

3. **Multi-Tenant Strict Isolation & Determinism**:
   - Every API call must supply `company_id`.
   - When a company has no transactions, the backend returns zeros (`bank_balance: 0`, `payables_today: 0`, `receivables_today: 0`, `rbt12: 0`, `forecast: []`, `tax_guides: []`).
   - The frontend must never replace 0 values with mock defaults (no fallback to 158k, 12.5k, 28.4k, 1.85M, or 6.0%).
   - Currency formatters correctly display `R$ 0,00`.

4. **UI State Handling Specification**:
   - **Loading State**:
     - Pulse skeletons for cards, thermometer gauge, and forecast breakdown.
   - **Error State**:
     - Rose-bordered error card with error message and "Tentar Novamente" (retry) action button triggering a fresh fetch for `company.id`.
   - **Empty State**:
     - When `bank_balance === 0`, card renders `R$ 0,00`.
     - When `payables_today === 0`, card renders `R$ 0,00`.
     - When `receivables_today === 0`, card renders `R$ 0,00`.
     - When `rbt12 === 0`, Thermometer shows `0.00%` of Subteto Estadual (R$ 3.6M) and `0.00%` of Teto Federal (R$ 4.8M), Faixa 1, with `0.00%` effective rate and R$ 0,00 deduction.
     - When `cash_flow_forecast` is empty, renders: `"Nenhuma movimentação futura registrada para os próximos {forecastRange} dias."`
     - When `tax_guides` is empty, renders: `"Nenhuma guia pendente encontrada. Todos os tributos apurados estão em dia."`

---

## 3. Caveats

- **Backend Route Path Consistency**: `server/src/routes/api.ts` previously defined `/portal/dashboard/summary` while `ORIGINAL_REQUEST.md` refers to `/api/portal/dashboard-summary`. Ensuring both routes point to `portalController.getDashboardSummary` eliminates any mismatch.
- **Simples Nacional Bracket Calculation**: If `rbt12 === 0`, the calculation in `computeSimplesNacionalGauge` must correctly return `faixa_numero: 1`, `aliquota_efetiva: 0.00`, and `alerta: 'normal'`, avoiding any division by zero or NaN.
- **No Caveats remaining for frontend investigation**.

---

## 4. Conclusion

1. The frontend structure (`ClientPortalView.tsx` and child tabs) is well-architected and componentized.
2. The company context is properly passed from `App.tsx` down through props (`company.id`), and re-fetching on company switch is already wired via `useEffect` dependency arrays.
3. The specific hardcoded fallbacks identified in `PortalDashboardTab.tsx` (lines 373, 380, 387, 405-407) and `PortalTaxGuidesTab.tsx` (line 119, 309) must be cleaned up to ensure strict deterministic rendering of real/zero data.
4. `services/api.ts` already contains the helper methods `getPortalDashboardSummary` and `getPortalTaxGuides`, requiring only alignment of endpoint naming if desired.
5. All UI state handling (loading, error, zero-state display of `R$ 0,00`) has been mapped out and verified.

---

## 5. Verification Method

1. **Static Analysis & TypeScript Type Check**:
   - Run `npx tsc --noEmit` in `client/` to verify zero TypeScript errors.
2. **Component Inspection**:
   - Inspect `PortalDashboardTab.tsx` and `PortalTaxGuidesTab.tsx` with `view_file` to verify elimination of mock fallback values.
3. **Deterministic Multi-Tenant Verification**:
   - Switch between a company with invoices/transactions and a newly created company with zero records.
   - Verify that the newly created company displays `R$ 0,00` on all metric cards, `0,00%` on Simples Nacional gauges, and no mock values appear anywhere in the UI.
