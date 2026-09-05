# Project: Super App Viacont (Área do Cliente)

## Architecture
The Super App Viacont (Área do Cliente) is an integrated hybrid client portal (Mobile PWA & Expanded Desktop) for accounting and BPO financial clients.
- **Frontend (`client/`)**: React 18 + Vite 6 + TailwindCSS 3 + TypeScript 5 SPA. Uses modular components with responsive switching between Mobile PWA (bottom navigation, thumb-friendly touch targets ≥ 48px, compact cards) and Expanded Desktop (sidebar navigation, multi-column grid, rich data tables), with seamless tab switching without full-page reload.
- **Backend (`server/`)**: Express 4 + Node.js 22 + TypeScript 5 REST API with native SQLite 3 database (`DatabaseSync` in WAL mode). Provides endpoints for authentication, company management, fast 3-step invoice issuance (NFS-e/NF-e), favorites catalog, tax guides & PIX Copy-Paste EMV code generation, OCR receipt parsing & auto-match with accounts payable, and real-time financial diagnostics (cash flow, payables/receivables, Simples Nacional RBT12 gauge).
- **Data Flow & State Management**: Local client state in React with reactive synchronization to backend REST APIs. Zero-reload tab transitions with optimistic UI updates.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Hybrid Responsive Layout | Responsive shell adapting between Mobile PWA (<768px) and Desktop (≥768px) | M2 | ORIGINAL_REQUEST §R1 |
| 2 | Zero-Reload Tab Navigation | Instant switching between Início/Finanças, Emitir Notas, Guias/Impostos, Recibos | M2 | ORIGINAL_REQUEST §R1 |
| 3 | Backend SQLite Schema & Core APIs | SQLite tables (`tax_guides`, `receipts_ocr`, `favorite_catalog_items`, `recurring_clients`) & endpoints | M1 | ORIGINAL_REQUEST §R1-R5 |
| 4 | 3-Step Guided Invoice Issuer | Step 1 (CNPJ/CPF Lookup) -> Step 2 (Service/Product selection) -> Step 3 (Review & Emit) | M3 | ORIGINAL_REQUEST §R2 |
| 5 | Favorites Catalog | 1-touch selection of recurring products and services in invoice issuer | M3 | ORIGINAL_REQUEST §R2 |
| 6 | PDF Invoice Mirror & WhatsApp Share | Visual mirror preview of RPS/DANFE, direct WhatsApp sharing link with PIX | M3 | ORIGINAL_REQUEST §R2 |
| 7 | Tax Guides & Impostos Center | Listing of DAS, ICMS, Folha/INSS with due dates, values, and status | M4 | ORIGINAL_REQUEST §R3 |
| 8 | 1-Click PIX Copy-Paste | 1-touch copy of EMV PIX payload / barcode line for tax guides | M4 | ORIGINAL_REQUEST §R3 |
| 9 | Receipt OCR Scanner & Upload | Camera capture (`capture="environment"`) and file upload for receipts/vouchers | M4 | ORIGINAL_REQUEST §R4 |
| 10 | Auto-Match OCR with Payables | OCR data extraction (CNPJ, date, total) and matching with accounts payable | M4 | ORIGINAL_REQUEST §R4 |
| 11 | Real-time Financial Dashboard | Daily cash flow, accounts payable/receivable forecast for 7/15/30 days | M5 | ORIGINAL_REQUEST §R5 |
| 12 | Simples Nacional RBT12 Gauge | Thermometer of accumulated revenue vs R$ 3.6M state limit and R$ 4.8M ceiling | M5 | ORIGINAL_REQUEST §R5 |
| 13 | Comprehensive E2E Test Suite | 4-tier opaque-box test suite (Tiers 1-4) covering all features and scenarios | E2E Track | ORIGINAL_REQUEST Acceptance |
| 14 | Clean TypeScript & Vite Build | Full compilation of `client` and `server` without errors | M6 / Final | ORIGINAL_REQUEST Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | Backend Foundations & Core Services | SQLite migrations, schemas, seed data, and REST API controllers for portal endpoints | none | DONE |
| **M2** | Frontend Core Shell & Hybrid PWA Navigation | ClientPortalView shell, responsive layout (mobile dock / desktop sidebar), tab navigation without reload | M1 | DONE |
| **M3** | Fast 3-Step Invoice Issuer & Favorites | 3-step wizard (CNPJ lookup -> Item/Service selection -> Mirror/Emit/WhatsApp PIX share) + Favorites catalog | M1, M2 | DONE |
| **M4** | Tax Guides & PIX + Receipt OCR Scanner | Tax guides center with 1-click PIX + Receipt OCR capture/upload and auto-match | M1, M2 | DONE |
| **M5** | Financial Dashboard & Simples Gauge | Cash flow, payables/receivables summary, Simples Nacional RBT12 gauge | M1, M2 | DONE |
| **M6** | Final Verification & Coverage Hardening | 100% E2E test execution, adversarial edge-case testing, clean build validation | M1-M5, E2E Track | DONE |
| **E2E** | E2E Testing Track | Requirement-driven opaque-box test suite (Tiers 1-4) publishing TEST_READY.md | none | DONE |

---

## Interface Contracts

### 1. Dashboard & Diagnostics (`/api/portal/dashboard/summary`)
- **Query**: `company_id: string`
- **Response**:
```json
{
  "success": true,
  "data": {
    "bank_balance": 158450.20,
    "payables_today": 12500.00,
    "receivables_today": 28400.00,
    "cash_flow_forecast": [
      { "date": "2026-08-27", "inflow": 28400.00, "outflow": 12500.00, "net": 15900.00 }
    ],
    "simples_nacional": {
      "rbt12": 1850000.00,
      "teto_estadual": 3600000.00,
      "teto_federal": 4800000.00,
      "percentual_atingido_estadual": 51.38,
      "percentual_atingido_federal": 38.54,
      "faixa_atual": "Faixa 4 - Alíquota Efetiva ~10.45%",
      "alerta": "normal"
    }
  }
}
```

### 2. Fast Invoice Issuance (`/api/portal/invoices/emit-fast`)
- **Body**:
```json
{
  "company_id": "string",
  "tipo": "NFS-e" | "NF-e",
  "tomador": {
    "cnpj_cpf": "string",
    "razao_social": "string",
    "email": "string",
    "whatsapp": "string",
    "logradouro": "string",
    "municipio": "string",
    "uf": "string"
  },
  "item": {
    "descricao": "string",
    "valor": 1250.00,
    "aliquota_iss": 2.0,
    "iss_retido": false,
    "ncm": "string (optional for NF-e)"
  },
  "condicao_pagamento": "PIX" | "Boleto" | "A_VISTA"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "numero_nota": "20260012",
    "codigo_verificacao": "A89F-771B",
    "status": "AUTORIZADA",
    "pdf_url": "/api/portal/invoices/20260012/pdf",
    "pix_code": "00020126580014br.gov.bcb.pix...",
    "pix_qr_base64": "data:image/png;base64,...",
    "whatsapp_share_url": "https://api.whatsapp.com/send?phone=...&text=..."
  }
}
```

### 3. Tax Guides (`/api/portal/tax-guides`)
- **Query**: `company_id: string, status?: string`
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tipo": "DAS" | "ICMS" | "FOLHA_INSS" | "FGTS",
      "descricao": "DAS Simples Nacional - Competência 07/2026",
      "competencia": "07/2026",
      "vencimento": "2026-08-20",
      "valor": 4820.50,
      "status": "PENDENTE" | "PAGO" | "VENCIDO",
      "pix_copia_cola": "00020126580014br.gov.bcb.pix...",
      "linha_digitavel": "858000000482 05000328260 82000000000 00000000000",
      "pdf_url": "/api/portal/tax-guides/uuid/pdf"
    }
  ]
}
```

### 4. Receipt OCR & Auto-Match (`/api/portal/receipts/scan`)
- **Body**: Multipart Form Data (`company_id`, `image`)
- **Response**:
```json
{
  "success": true,
  "data": {
    "receipt_id": "uuid",
    "extracted": {
      "cnpj": "12.345.678/0001-90",
      "fornecedor": "Posto Shell Combustíveis",
      "data_emissao": "2026-08-26",
      "valor_total": 245.80,
      "categoria_sugerida": "Combustíveis & Frotas"
    },
    "matched_payable": {
      "payable_id": "uuid",
      "match_confidence": 0.95,
      "match_status": "MATCHED"
    }
  }
}
```

---

## Code Layout & File Boundaries
- **Backend Core**:
  - `server/src/database/db.ts` (DB initialization and table definitions)
  - `server/src/controllers/portalController.ts` (Controllers for all Super App client area endpoints)
  - `server/src/services/portalService.ts` (Business logic, calculations, OCR, PIX generator, Simples engine)
  - `server/src/routes/api.ts` (Route mappings)
- **Frontend Components**:
  - `client/src/components/ClientPortalView.tsx` (Main shell, tab bar, responsive wrapper)
  - `client/src/components/portal/PortalDashboardTab.tsx` (R5: Real-time financial dashboard & RBT12 gauge)
  - `client/src/components/portal/PortalInvoiceIssuerTab.tsx` (R2: 3-step invoice issuer, favorites, mirror preview)
  - `client/src/components/portal/PortalTaxGuidesTab.tsx` (R3: Tax guides center & 1-click PIX copy-paste)
  - `client/src/components/portal/PortalReceiptScannerTab.tsx` (R4: Receipt OCR scanner & auto-match interface)
  - `client/src/components/portal/PortalFavoritesModal.tsx` (Favorites catalogue management)
  - `client/src/services/api.ts` (API client functions)
  - `client/src/types/index.ts` (Frontend TypeScript interfaces)
- **Tests**:
  - `tests/e2e/` & `server/src/tests/` (Automated E2E test runner and test cases)
