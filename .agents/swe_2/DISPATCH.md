## 2026-09-17T08:03:10Z

You are the SWE Light Orchestrator (swe_2).
Working directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\swe_2
Workspace root: c:\Users\USER\Documents\app_xml_antigravity
Original request file: c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md (see latest section under timestamp 2026-09-17T08:01:04Z).

Your mission:
Orchestrate the SWE Light loop (single implementer on the whole task, then reviewer rounds with cumulative open-issues ledger) for:
1. R1. Correção Algorítmica do Importador de XMLs (uploadBatchXml / xmlParser):
   - Compare active company CNPJ with emitente_cnpj and destinatario_cnpj:
     * If emitente_cnpj === company.cnpj and tpNF === '1' -> tipo = 'saida' (Venda / Faturamento da empresa).
     * If destinatario_cnpj === company.cnpj and tpNF === '1' -> tipo = 'entrada' (Compra / Mercadoria recebida de fornecedor).
     * If tpNF === '0' (emissão própria de entrada para devolução/remessa) -> tipo = 'entrada'.
     * Eliminate any logic that classifies invoices emitted by the company itself as "entrada".
   - Ensure folder synchronization and SEFAZ follow this exact deterministic rule.
2. R2. Reclassificação e Saneamento do Banco de Dados Existente:
   - Run a migration / scan across all invoices in the SQLite database (invoices table), comparing companies.cnpj with emitente_cnpj and destinatario_cnpj.
   - Correct the tipo ('entrada' vs 'saida') of all invoices across all companies (JL Comércio / Leandro Gomes, Churrascaria Tradição Gaúcha, Lopes, Amesfer, Sales Comércio, etc.).
   - Ensure dashboard KPIs and reports accurately reflect real fiscal accounting totals.
3. R3. Preenchimento e Exibição Completa dos DANFEs:
   - NFC-e model 65 and notes without CPF must display friendly, complete identification on DANFEs ("Consumidor Final - Venda Balcão", "CPF não informado no cupom", correct company emitter details).
4. Acceptance Criteria & Test Integrity:
   - JL Comércio (73.472.235/0001-50): all 1,442 emitted invoices strictly under Saídas, supplier purchases strictly under Entradas.
   - Churrascaria Tradição Gaúcha and other companies: 100% segregated without inversion.
   - Upload / manual batch XML importer processes new files applying the deterministic rule.
   - Automated verification test/script confirms 0 inverted invoices in DB.
   - Frontend (`npm run build`) and Backend (`tsc`) compile with 0 errors.

Maintain your BRIEFING.md and progress.md in your working directory. Ensure all changes are verified with tests and compilation. Report completion with a full handoff report when ready for Victory Audit.
