# E2E Test Infra: Super App Viacont (Área do Cliente)

## Test Philosophy
- **Requirement-Driven & Opaque-Box**: Tests are derived strictly from `ORIGINAL_REQUEST.md` and user-facing acceptance criteria, completely independent of backend/frontend internal implementations.
- **Automated Verification**: Headless, end-to-end executable test suite covering both API and UI requirements without manual browser interaction.
- **Coverage Methodology**: 4-Tier Test Matrix (Category-Partition, Boundary Value Analysis, Pairwise Combinatorial, Real-World Business Workloads).

---

## Feature Inventory & Test Matrix

| # | Feature Area | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workflows) |
|---|--------------|-------------|:----------------:|:-----------------:|:----------------------:|:------------------:|
| F1 | Hybrid Responsive Layout & SPA Tabs | ORIGINAL_REQUEST §R1 | 5 tests | 5 tests | Pairwise | Real-World App |
| F2 | Fast 3-Step Invoice Issuer & Favorites | ORIGINAL_REQUEST §R2 | 5 tests | 5 tests | Pairwise | Real-World App |
| F3 | Tax Guides & Impostos Center (1-Click PIX) | ORIGINAL_REQUEST §R3 | 5 tests | 5 tests | Pairwise | Real-World App |
| F4 | Receipt OCR Scanner & Auto-Match | ORIGINAL_REQUEST §R4 | 5 tests | 5 tests | Pairwise | Real-World App |
| F5 | Financial Dashboard & Simples Gauge | ORIGINAL_REQUEST §R5 | 5 tests | 5 tests | Pairwise | Real-World App |

---

## Detailed Test Tiers Breakdown

### Tier 1: Feature Coverage (≥5 per feature = 25 tests)
- **F1 (Hybrid Responsive Layout & SPA Tabs)**:
  - T1.1.1: Mobile PWA viewport shell structure and bottom navigation dock.
  - T1.1.2: Desktop expanded multi-column layout and sidebar navigation.
  - T1.1.3: Tab switching between Início/Finanças, Emitir Notas, Guias/Impostos, Recibos without page reload.
  - T1.1.4: Mobile touch target compliance (min-height ≥ 44px/48px).
  - T1.1.5: Theme and responsive styling consistency.
- **F2 (3-Step Invoice Issuer & Favorites)**:
  - T1.2.1: Step 1 CNPJ/CPF lookup and autofill of client data.
  - T1.2.2: Step 2 Service selection and tax calculation (ISS/ICMS).
  - T1.2.3: Step 3 Preview mirror generation and emission.
  - T1.2.4: Favorites catalog: loading and 1-tap selection.
  - T1.2.5: WhatsApp share URL generation with valid encoded link.
- **F3 (Tax Guides & 1-Click PIX)**:
  - T1.3.1: Listing of tax guides (DAS, ICMS, Folha/INSS).
  - T1.3.2: Verification of due date, amount, and status formatting.
  - T1.3.3: 1-click PIX Copy-Paste code generator & validation.
  - T1.3.4: Barcode / Linha digitável copy validation.
  - T1.3.5: Payment status transition (PENDENTE -> PAGO).
- **F4 (Receipt OCR Scanner & Auto-Match)**:
  - T1.4.1: Receipt file upload / camera capture endpoint.
  - T1.4.2: OCR extraction of CNPJ, date, and total amount.
  - T1.4.3: Auto-match algorithm matching receipt with accounts payable item.
  - T1.4.4: Confidence score calculation and visual indicator.
  - T1.4.5: Storage and retrieval of scanned receipts.
- **F5 (Financial Dashboard & Simples Gauge)**:
  - T1.5.1: Bank balance and daily cash flow forecast endpoint.
  - T1.5.2: Today's payables and receivables aggregation.
  - T1.5.3: Simples Nacional RBT12 calculation.
  - T1.5.4: Simples Nacional state limit (R$ 3.6M) and federal ceiling (R$ 4.8M) percentage calculation.
  - T1.5.5: Quick action shortcut triggers.

### Tier 2: Boundary & Corner Cases (≥5 per feature = 25 tests)
- **F1 (Responsive & Navigation)**:
  - T2.1.1: Viewport exactly at 767px (mobile limit) and 768px (desktop threshold).
  - T2.1.2: Rapid tab clicking in under 100ms (no race condition or broken state).
  - T2.1.3: Deep link / refresh preservation of active company and tab.
  - T2.1.4: Screen orientation change simulation (portrait vs landscape).
  - T2.1.5: Offline network condition handling.
- **F2 (Invoice Issuer)**:
  - T2.2.1: Invalid CNPJ (wrong check digits) and invalid CPF rejection.
  - T2.2.2: Foreign / Non-standard characters in service description.
  - T2.2.3: Zero value (R$ 0,00) and negative value rejection.
  - T2.2.4: High monetary value (e.g. R$ 10.000.000,00) formatting and tax rounding.
  - T2.2.5: Missing required fields in step 1 or step 2 blocks progression to step 3.
- **F3 (Tax Guides)**:
  - T2.3.1: Expired tax guide (status VENCIDO) formatting and warning.
  - T2.3.2: Guide paid in advance (early payment).
  - T2.3.3: Empty tax guide list for newly created company.
  - T2.3.4: EMV PIX payload CRC16 checksum mathematical validity.
  - T2.3.5: Multiple simultaneous PIX copy requests.
- **F4 (Receipt OCR)**:
  - T2.4.1: Low quality / corrupted image handling without server crash.
  - T2.4.2: Receipt with multiple potential dates/values (selecting the total amount).
  - T2.4.3: Receipt with no matching payable (unmatched status).
  - T2.4.4: Maximum file size limit enforcement.
  - T2.4.5: Unsupported file MIME types rejection.
- **F5 (Financial Dashboard)**:
  - T2.5.1: RBT12 at exact limit (R$ 3.600.000,00) boundary.
  - T2.5.2: RBT12 exceeding federal ceiling (> R$ 4.800.000,00) trigger alert.
  - T2.5.3: Zero cash flow transactions (clean state).
  - T2.5.4: Negative bank balance (overdraft) visualization.
  - T2.5.5: Leap year and month-end date transitions in 30-day forecast.

### Tier 3: Cross-Feature Combinations (Pairwise Coverage = 10 tests)
- T3.1: Emit invoice in F2 -> Update dashboard receivables and RBT12 in F5 immediately.
- T3.2: Scan receipt in F4 -> Auto-match with payable -> Update dashboard payables in F5.
- T3.3: Pay tax guide in F3 -> Update cash flow outflow in F5.
- T3.4: Add favorite catalog item in F2 -> Switch tabs to F5 and back -> Favorite remains available.
- T3.5: Switch between Mobile and Desktop while mid-way through 3-step invoice issuance (state preserved).
- T3.6: Scan receipt in F4 -> Switch to F3 Guias -> No memory leak or state contamination.
- T3.7: Emit NFS-e with WhatsApp sharing link -> Validate PIX code in share link matches PIX engine in F3.
- T3.8: Complete company change -> Dashboard, Invoices, Guides, and Receipts reload for new company cleanly.
- T3.9: Offline draft creation -> Online reconnection -> Successful emission.
- T3.10: High-load concurrent API calls across all 4 tab endpoints.

### Tier 4: Real-World Business Scenarios (5 tests)
- T4.1: **End-to-End Monthly Routine of Small Business**:
  Client opens mobile app -> Checks dashboard & RBT12 gauge -> Pays DAS guide with 1-click PIX -> Scans supply receipt -> Emits monthly service invoice to recurrent client with WhatsApp share -> Verifies updated dashboard balance.
- T4.2: **High-Volume Service Provider Day**:
  User uses 1-tap favorites catalog to rapidly emit 5 consecutive NFS-e invoices with different clients, copying WhatsApp links for each.
- T4.3: **Tax Audit & Impostos Compliance Check**:
  Client reviews pending ICMS and Folha guides on desktop expanded view, copies PIX codes, marks as paid, and verifies clean tax status.
- T4.4: **Expense Reconciliation Sprint**:
  Client uploads 3 receipts from mobile camera -> auto-match successfully resolves 2 against pending payables and flags 1 for manual review.
- T4.5: **Simples Nacional Limit Escalation & Warning**:
  Company near R$ 3.6M limit emits high-value invoice -> Dashboard Simples thermometer transitions to warning state with notification.

---

## Test Architecture & Execution
- **Test Runner Location**: `tests/e2e/test_runner.js` (or `.ts`)
- **Execution Command**: `npm run test:e2e` (or `node tests/e2e/test_runner.js`)
- **Pass/Fail Criteria**: All 65+ automated test cases must pass (Exit Code 0).
