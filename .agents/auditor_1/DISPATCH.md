## 2026-08-27T20:18:10Z
You are the Forensic Auditor for the Viacont Super App / Client Portal Project.
Your Working Directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\auditor_1
You MUST read:
- c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\PROJECT.md
- c:\Users\USER\Documents\app_xml_antigravity\.agents\TEST_READY.md

Your Task:
1. Perform a strict Forensic Integrity Audit on the entire codebase:
   - Search for hardcoded test results, dummy/facade implementations, mock numbers (158450.20, 12500, 28400, 1850000, Faixa 2, 6.0%, static PIX keys).
   - Check if database queries are genuine and actually query the SQLite tables (`bank_transactions`, `invoices`, `accounting_provisions`, `companies`).
   - Check if calculations (Saldo Caixa, A Receber, A Pagar, RBT12, Simples Nacional gauge, PIX EMV) are genuine, mathematical, and deterministic.
   - Check if multi-tenant isolation is genuinely enforced via `WHERE company_id = ?`.
2. Inspect the source files:
   - `server/src/services/portalService.ts`
   - `server/src/controllers/portalController.ts`
   - `server/src/routes/api.ts`
   - `client/src/components/portal/PortalDashboardTab.tsx`
   - `client/src/components/portal/PortalTaxGuidesTab.tsx`
   - `client/src/services/api.ts`
   - `tests/e2e/*`
3. Deliver a binary verdict (CLEAN or INTEGRITY VIOLATION) in `c:\Users\USER\Documents\app_xml_antigravity\.agents\auditor_1\handoff.md`.
4. Send a message to parent when done.
