## 2026-08-27T20:13:09Z
You are the Backend Worker for Milestones M1 & M2.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_backend_m1_m2
You MUST read:
- c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\PROJECT.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\explorer_survey_backend\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Exclusively Owned Files:
- `server/src/services/portalService.ts`
- `server/src/routes/api.ts`

Your Tasks:
1. In `server/src/services/portalService.ts`:
   - REMOVE ALL HARDCODED MOCK FALLBACKS (lines 739, 748, 756, 775, 776, 797: `158450.20`, `12500.00`, `28400.00`, `1850000.00`, `20000 + i*2500`, etc.).
   - Implement real-time SQL calculations:
     - Saldo Previsto no Caixa: SUM of `saldo_atual` from `bank_accounts` + (credits - debits from `bank_transactions`) for `company_id`. Strict `0.00` if empty.
     - A Receber Este Mês: Open receivable installments (`invoice_installments` with `tipo = 'receber'`) + authorized/issued `invoices` (saída/NFS-e) in current month for `company_id`. Strict `0.00` if empty.
     - A Pagar Este Mês: Open payable installments (`invoice_installments` with `tipo = 'pagar'`) + open `accounting_provisions` (competência/data no mês) for `company_id`. Strict `0.00` if empty.
     - Termômetro do Simples Nacional (RBT12 Real): Real SUM of issued invoices in the last 12 months for `company_id` vs R$ 3.6M subteto and R$ 4.8M teto. Calculate exact effective tax rate $\frac{(\text{RBT12} \times \text{Alíquota}) - \text{Dedução}}{\text{RBT12}}$. If RBT12 is 0.00, return Faixa 1 (Sem Faturamento), 0.00% rate, 0.00% percentages.
     - Cash Flow Forecast: Real projection based on scheduled invoice installments for the next 7/15/30 days. If none exist, return zeroed daily entries (`inflow: 0, outflow: 0, net: 0`).
   - Dynamic Tax Guides with PIX (M2):
     - Query both `tax_guides` and `accounting_provisions` for `company_id`.
     - Synthesize tax guide records for provisions (DAS_SIMPLES, ICMS, FOLHA_SALARIOS, INSS_EMPRESA, FGTS, etc.).
     - Compute real EMV BR Code PIX (`generatePixEmvPayload`) using company's sanitized CNPJ, company name/city, and real provision amount with CRC16-CCITT checksum.
2. In `server/src/routes/api.ts`:
   - Register route alias `/portal/dashboard-summary` alongside `/portal/dashboard/summary` pointing to `portalController.getDashboardSummary`.
3. Verify server builds with 0 errors (`npm run --prefix server build` or `cd server && npx tsc --noEmit`).
4. Document all changes and build results in `c:\Users\USER\Documents\app_xml_antigravity\.agents\worker_backend_m1_m2\handoff.md`. Send message when done.
