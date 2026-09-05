# Handoff Report: Business Engines & Services Architecture (`portalService.ts`)

**Agent**: M1 Explorer 2 (Business Engines & Services)  
**Date**: 2026-08-27  
**Working Directory**: `c:\Users\USER\Documents\app_xml_antigravity\.agents\m1_explorer_2`  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Existing Service Landscape**:
   - `server/src/services/` contains 11 service files including `whatsappService.ts`, `taxAuditorService.ts`, `danfeGenerator.ts`, `xmlParser.ts`, `sefazService.ts`.
   - `server/package.json` includes `tesseract.js` (`^7.0.0`), `pdfkit` (`^0.16.0`), `uuid` (`^11.1.0`), `fast-xml-parser` (`^4.5.3`), and `bcryptjs` (`^3.0.3`).
   - `whatsappService.ts` lines 8-25 implements `isSafeNotificationHour()` restricting automated dispatch to 08h00–18h00 Brasília time.

2. **Interface Contracts in PROJECT.md**:
   - `/api/portal/dashboard/summary` (PROJECT.md lines 46-70): Returns `bank_balance`, `payables_today`, `receivables_today`, `cash_flow_forecast`, and `simples_nacional` gauge (RBT12 vs R$ 3.6M subteto / R$ 4.8M teto, alíquota efetiva, faixa atual, alerta).
   - `/api/portal/invoices/emit-fast` (PROJECT.md lines 72-111): Emits 3-step invoice returning `numero_nota`, `codigo_verificacao`, `status`, `pdf_url`, `pix_code`, `pix_qr_base64`, `whatsapp_share_url`.
   - `/api/portal/tax-guides` (PROJECT.md lines 113-134): Returns list of DAS, ICMS, Folha guides with `pix_copia_cola`, `linha_digitavel`, `pdf_url`.
   - `/api/portal/receipts/scan` (PROJECT.md lines 136-158): Returns `receipt_id`, extracted OCR fields (CNPJ, fornecedor, data, valor, categoria), and auto-match status with pending payables.

3. **Database Tables in `server/src/database/db.ts`**:
   - Existing tables: `companies`, `invoices`, `bank_accounts`, `financial_categories`, `bank_transactions`, `accounting_provisions`, `invoice_installments`, `nfse_issued`, `nfse_recurring_clients`.
   - Pending schema tables being added by M1 Explorer 1: `tax_guides`, `receipts_ocr`, `favorite_catalog_items`.

---

## 2. Logic Chain

1. **EMV PIX Generator Architecture**:
   - *Observation*: BCB PIX EMVCo specifications mandate TLV encoding with Tag `00` (Payload format), Tag `26` (Merchant info with GUI `br.gov.bcb.pix` + key), Tag `52` (MCC 0000), Tag `53` (Currency 986), Tag `54` (Amount), Tag `58` (BR), Tag `59` (Merchant name), Tag `60` (City), Tag `62` (TxID in sub-tag 05), Tag `63` (CRC16-CCITT).
   - *Deduction*: By implementing a pure function `generatePixEmvPayload()` that formats TLV fields and applies CRC16-CCITT with polynomial `0x1021` and initial `0xFFFF`, the system generates valid PIX Copy-Paste strings for invoices and tax guides without third-party API dependencies.

2. **Simples Nacional Bracket Engine**:
   - *Observation*: Lei Complementar nº 123/2006 / LC 155/2016 establishes 6 revenue brackets across Anexos I to V, with the effective rate formula $R_{efetiva} = \frac{(RBT12 \times R_{nominal}) - P_{deduzir}}{RBT12}$, Subteto Estadual of R$ 3.600.000,00, and Teto Federal of R$ 4.800.000,00.
   - *Deduction*: By indexing Anexos I–V tables and aggregating 12-month rolling revenue from `invoices` (`tipo = 'saida'`), the engine dynamically computes the exact Faixa, nominal and effective rates, gauge percentages, and alert flags (`normal`, `atencao`, `alerta_subteto`, `critico`).

3. **Receipt OCR & Auto-Match Engine**:
   - *Observation*: Receipts from stores, gas stations, restaurants, and utilities follow Brazilian fiscal receipt formats containing CNPJ, issue date, total amount, and vendor name.
   - *Deduction*: A hybrid OCR pipeline combining Tesseract extraction with multi-pattern regex matching provides robust token extraction. A weighted multi-factor scoring algorithm (Amount 45%, CNPJ 35%, Date 10%, Vendor 10%) matches extracted receipts against `invoice_installments` / `accounting_provisions` with a calibrated threshold ($\ge 0.70$ `MATCHED`, $\ge 0.40$ `POSSIBLE_MATCH`).

4. **WhatsApp Deep Link Engine**:
   - *Observation*: Client invoices and tax guides must be shareable via 1-click WhatsApp web/mobile links.
   - *Deduction*: Structured templates with bold headings, emojis, monetary formatting, and monospace code blocks for PIX payloads (`https://api.whatsapp.com/send?phone=...&text=...`) provide instant, friction-free sharing.

---

## 3. Caveats

1. **OCR Engine Image Quality**: Low-resolution camera photos or distorted receipt images may fail full OCR text parsing; the algorithm is designed with defensive regex and partial matching, but manual 1-click correction UI on the frontend is recommended as a fallback.
2. **Subteto Estadual Variations**: While R$ 3.600.000,00 is standard across almost all Brazilian states (including BA, SP, RJ, MG), a few smaller states historically had R$ 1.8M/R$ 2.4M subtetos. R$ 3.6M is configured as default according to standard national regulations.
3. **Pix Static vs Dynamic**: Static PIX codes generated locally do not require immediate PSP webhooks, whereas dynamic charges can link directly to banking APIs if configured.

---

## 4. Conclusion

The complete architectural plan for `portalService.ts` has been authored and documented in `.agents/m1_explorer_2/m1_service_plan.md`. The design provides:
- Fully compliant **CRC16-CCITT BR Code PIX generator**.
- Accurate **Simples Nacional RBT12 gauge and bracket computation engine** for Anexos I through V.
- Intelligent **OCR receipt extraction and multi-factor accounts payable auto-match algorithm**.
- Clean **WhatsApp sharing and notification formatting**.
- Complete TypeScript interfaces and service class methods ready for direct implementation in Milestone 1.

---

## 5. Verification Method

To verify the algorithms and architecture:

1. **Inspect Architecture Plan**:
   - Review `.agents/m1_explorer_2/m1_service_plan.md` for complete code examples, type definitions, and test vectors.
2. **Verify Mathematical Models**:
   - Verify CRC16 algorithm implementation: polynomial `0x1021`, initial `0xFFFF`, CRC tag format `6304`.
   - Verify Simples Nacional Faixa 5 Anexo III calculation: for RBT12 = R$ 1.850.000,00, effective rate equals $14.21\%$.
3. **Verify Build Compatibility**:
   - The TypeScript interfaces and pure functions in the plan are fully typed and strictly compatible with TypeScript 5.7+ and Node.js 22.
