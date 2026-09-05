# Handoff Report — Survey Explorer 2
**Date:** 2026-08-27T10:42:00Z  
**Role:** Domain Specification & Requirements Architecture Specialist  
**Artifact:** `c:\Users\USER\Documents\app_xml_antigravity\.agents\survey_explorer_2\survey_domain_specs.md`

---

## 1. Observation
- **Original Request (`ORIGINAL_REQUEST.md`)**: Specifies the creation of the Super App Viacont (Client Area) with responsive hybrid support (Mobile PWA & Expanded Desktop), 3-step invoice issuer for NFS-e and NF-e with favorites catalogue, live mirror preview, WhatsApp share and PIX, Tax Guides Center with 1-click PIX copy-paste, Receipt OCR scanner with auto-match to payables, and Real-time Financial Dashboard with Simples Nacional RBT12 vs annual ceiling thermometer.
- **Existing Codebase State**:
  - `server/src/database/db.ts`: SQLite DB initializing tables for `companies`, `invoices`, `bank_accounts`, `financial_categories`, `bank_transactions`, `dominio_chart_of_accounts`, `accounting_provisions`, `nfse_issued`, `nfse_recurring_clients`, `invoice_installments`. Missing dedicated tables for `tax_guides`, `receipt_scans`, and `invoice_favorites`.
  - `server/src/routes/api.ts`: API endpoints for companies, invoices, BPO transactions, and NFS-e emission exist, but require new REST contract endpoints for tax guides, OCR receipt uploads, quick-invoice 3-step issuer, and RBT12 diagnostics.
  - `client/src/components/ClientPortalView.tsx`: Exists in a preliminary state with basic manifestation and manual entry, but needs the 4 primary tabs (`inicio_financas`, `emitir_notas`, `guias_impostos`, `recibos`) and full PWA responsive hybrid layout.
  - `server/src/services/danfeGenerator.ts` & `server/src/services/nfse/NfseAdapterFactory.ts`: Already contain PDF generation and municipal transmission capabilities ready to be surfaced directly in the 3-step issuer.

---

## 2. Logic Chain
1. **R1 (PWA & Desktop Responsive SPA)**: By structuring the client portal as a unified SPA with 4 primary tabs (`Início/Finanças`, `Emitir Notas`, `Guias/Impostos`, `Recibos`), users can switch contexts instantly without page reloads. The mobile view uses a docked bottom navigation bar with >= 48px touch targets and native camera access, while desktop expands into multi-column cards and data tables.
2. **R2 (3-Step Invoice Issuer)**: Structuring the emission into (1) Tomador/Destinatário with CPF/CNPJ auto-lookup and favorites, (2) Produto/Serviço with preset catalogue and tax rates, and (3) Review with live mirror preview, BACEN EMV standard PIX payload generation, and 1-click WhatsApp share link (`wa.me`) guarantees sub-30-second invoice generation from any mobile device.
3. **R3 (Tax Guides Center & 1-Click PIX)**: By modeling `tax_guides` with columns for `tipo_tributo` (DAS, ICMS, Folha), `pix_copia_e_cola`, `data_vencimento`, `valor_total`, and `status`, clients can copy the PIX code with 1 tap, view deadlines with clear visual badges, and upload payment receipts.
4. **R4 (Receipt OCR Scanner & Auto-Match)**: Modeling `receipt_scans` with camera environment capture and an OCR parser that feeds a 4-factor weighted scoring algorithm ($P_{\text{valor}} \times 0.4 + P_{\text{data}} \times 0.3 + P_{\text{nome}} \times 0.2 + P_{\text{doc}} \times 0.1$) allows automatic matching with open `invoice_installments` and `bank_transactions`.
5. **R5 (Financial Dashboard & RBT12 Gauge)**: Real-time aggregation of sales NF-e + NFS-e across the past 12 months computes the official Simples Nacional RBT12, displaying a gauge against the R$ 3.6M state sublimit and R$ 4.8M national ceiling alongside daily projected cash flow.

---

## 3. Caveats
- **Prefeitura / SEFAZ Credentials**: Live transmission of NFS-e depends on valid municipal credentials or Focus NFe token, though offline RPS generation and visual mirror preview operate autonomously.
- **Tesseract / Vision OCR Latency**: High-resolution mobile photos should be scaled client-side before upload to maintain fast response times.
- **Simples Nacional Proportionalization**: For new companies with less than 12 months of operation, the standard CGSN 140/2018 proportionalization rule is applied.

---

## 4. Conclusion
The deep domain specification survey is complete and recorded in `survey_domain_specs.md`. It includes:
- Architectural diagrams for SPA responsive navigation (Mobile PWA & Desktop Expanded).
- Detailed domain models in TypeScript and SQLite SQL DDL.
- End-to-end REST API contracts for all 5 requirements.
- Concrete algorithms for EMV PIX payload generation, weighted receipt matching, and RBT12 tax bracket calculation.
- Error handling and edge-case mitigation matrix.

---

## 5. Verification Method
- **Specification Inspection**:
  - Open and review `c:\Users\USER\Documents\app_xml_antigravity\.agents\survey_explorer_2\survey_domain_specs.md`.
- **Schema & TypeScript Validation**:
  - Compare the provided SQL DDL and TypeScript interfaces with existing definitions in `server/src/database/db.ts` and `client/src/types/index.ts`.
- **Build Verification**:
  - Future implementation agents can verify compliance against `ORIGINAL_REQUEST.md` and run `npm run build --prefix client` and `npm run build --prefix server`.
