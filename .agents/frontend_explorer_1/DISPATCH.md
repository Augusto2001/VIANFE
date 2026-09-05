# Frontend Explorer Dispatch (M2-M5: Super App Viacont Client Area)

Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\frontend_explorer_1
Workspace root: c:\Users\USER\Documents\app_xml_antigravity
Original request: c:\Users\USER\Documents\app_xml_antigravity\ORIGINAL_REQUEST.md
Project plan: c:\Users\USER\Documents\app_xml_antigravity\PROJECT.md
Domain specs: c:\Users\USER\Documents\app_xml_antigravity\.agents\survey_explorer_2\survey_domain_specs.md

Scope:
Investigate the frontend codebase in `client/src/`:
1. `client/src/types/index.ts`: Detail all TypeScript interfaces required for R1-R5 (Dashboard, Invoices, TaxGuides, Receipts, Favorites, RecurringClients).
2. `client/src/services/api.ts`: Detail all API client methods connecting to `/api/portal/*`.
3. `client/src/components/ClientPortalView.tsx`: Structure the master shell with responsive switcher (Mobile PWA bottom dock vs Desktop expanded view), zero-reload tab transitions, company selector, and theme support.
4. Component breakdown:
   - `PortalDashboardTab.tsx` (R5: daily cash flow, payables/receivables, Simples Nacional RBT12 gauge with state limit R$ 3.6M and federal ceiling R$ 4.8M).
   - `PortalInvoiceIssuerTab.tsx` (R2: 3-step wizard with CNPJ/CPF lookup, favorites selector, live invoice preview mirror, WhatsApp share link with PIX).
   - `PortalFavoritesModal.tsx` (R2: favorites catalog modal).
   - `PortalTaxGuidesTab.tsx` (R3: tax guides list, 1-click PIX Copy-Paste, status, payment dialog).
   - `PortalReceiptScannerTab.tsx` (R4: camera/upload, OCR extraction, auto-match with payables).
5. Verify that `npm run build --prefix client` will build cleanly without TypeScript or Vite errors.

Write your report to `.agents/frontend_explorer_1/frontend_plan.md` and handoff.md.
