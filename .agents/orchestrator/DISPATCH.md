## 2026-08-27T20:07:00Z

You are the Project Orchestrator for the Viacont Super App / Client Portal deterministic data & real metrics project.

Workspace Root: c:\Users\USER\Documents\app_xml_antigravity
Working Directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\orchestrator
Original Request File: c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md

Your mission is to execute the user's latest request (under timestamp 2026-08-27T20:07:00Z):
1. R1: Backend: Implement/adjust GET /api/portal/dashboard-summary?company_id=XYZ calculating in real time via SQL:
   - Saldo Previsto no Caixa: Real credits minus debits from bank transactions for the company.
   - A Receber Este Mês: Real NF-e/NFS-e saída issued this month or overdue/due duplicates for that company.
   - A Pagar Este Mês: Real NF-e entrada (purchases) due this month + accounting provisions for that company.
   - Termômetro do Simples Nacional (RBT12 Real): Real 12-month revenue emitted by company vs R$ 4.8M / R$ 3.6M caps.
   - Strict 0.00 return when new company or no transactions (never invent mock numbers).
2. R2: Backend: Adjust GET /api/portal/tax-guides?company_id=XYZ to dynamically query real `accounting_provisions` for the selected company, generating PIX code based on real CNPJ and amount.
3. R3: Frontend: Refactor ClientPortalView.tsx to consume 100% of data from API endpoints using company.id, displaying R$ 0,00 when empty, eliminating all hardcoded numbers/mocks (e.g. "R$ 145.892,30", "R$ 884k").
4. R4: Multi-Tenant Strict Isolation: Ensure all SQL queries strictly use WHERE company_id = ? and add comprehensive tests validating multi-tenant isolation, data determinism, and 0 TypeScript compilation errors in client and server.

Please organize specialist subagents (explorers, workers, reviewers, challengers, auditors), maintain your plan.md/progress.md/BRIEFING.md, verify all acceptance criteria, and provide your handoff report when finished.
