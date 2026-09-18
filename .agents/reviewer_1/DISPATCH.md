## 2026-09-16T18:10:00Z

You are teamwork_preview_reviewer (Round 1).
Your working directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\reviewer_1
Workspace root: c:\Users\USER\Documents\app_xml_antigravity

<original_task>
You are the SWE Light Orchestrator (teamwork_preview_swe_1).

Workspace Root: c:\Users\USER\Documents\app_xml_antigravity
Working Directory: c:\Users\USER\Documents\app_xml_antigravity\.agents\swe_1
Original Request File: c:\Users\USER\Documents\app_xml_antigravity\.agents\ORIGINAL_REQUEST.md

Your mission is to execute the user's latest request (under timestamp 2026-09-16T16:23:33Z):

This is a single self-contained fix; keep it small and focused.

Correção definitiva do isolamento fiscal multi-empresa no sistema VIANFE e ingestão completa das notas fiscais de 2026 da JL COMERCIO E VENDAS DE PEÇAS E SERVIÇOS LTDA (Leandro Gomes - CNPJ 73.472.235/0001-50) arquivadas no Google Drive.

Working directory: c:\Users\USER\Documents\app_xml_antigravity
Integrity mode: demo

## Requirements

### R1. Ingestão Fiscal Completa da JL Comércio (Leandro Gomes)
Processar e descompactar todos os pacotes fiscais de 2026 (DocumentosFiscais-MM-2026-73472235000150.zip, XML_LEANDRO GOMES_HIPER_05.2026.zip, etc.) localizados em G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\SETOR FISCAL\NF\2026, inserindo todos os documentos fiscais (NF-e, NFC-e, NFS-e) no banco de dados SQLite vinculados à empresa JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA (ID: fc73d7bc-2423-4e6c-897d-161b7f05b392).

### R2. Mapeamento Automático do Google Drive
Ajustar o serviço de mapeamento de pastas (driveFolderMatcher.ts) para reconhecer o vínculo entre a pasta LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 ) e o CNPJ 73472235000150 / Razão Social da JL Comércio, assegurando que futuras sincronizações encontrem a pasta automaticamente.

### R3. Isolamento Estrito de Empresas no Painel
Garantir que a listagem de notas no frontend (Dashboard, Relatórios, BPO) e na API (/api/invoices) filtre com precisão por company_id, eliminando qualquer auto-seleção indevida ou contaminação de notas entre empresas (JL Comércio, Churrascaria Tradição Gaúcha, Amesfer, Sales Comércio, Lopes Comércio).

## Acceptance Criteria

### Ingestão de Documentos Fiscais
- [ ] Mais de 90 notas fiscais de 2026 (Janeiro a Julho/2026) da JL Comércio inseridas com sucesso na tabela invoices com status autorizada, valores e fornecedores/clientes corretos.
- [ ] Geração dos arquivos XML e DANFE PDF correspondentes na estrutura de armazenamento da empresa.

### Filtro e Visualização no Sistema
- [ ] Ao selecionar JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA no painel, a tela exibe exclusivamente as notas da JL Comércio e seus totais consolidados.
- [ ] A troca entre empresas (Churrascaria, Amesfer, Sales, JL) atualiza instantaneamente a listagem sem misturar dados.
- [ ] A consulta autenticada à API /api/invoices?company_id=fc73d7bc-2423-4e6c-897d-161b7f05b392 retorna os dados corretos sem erros.

Execute the SWE Light protocol (implementer, adversarial reviewer rounds with cumulative open-issues ledger, verification by running tests). Write your progress to progress.md and BRIEFING.md in your working directory. When complete, send a message to parent reporting victory with full evidence so independent Victory Audit can proceed.
</original_task>

<prior_attempt>
> [!WARNING] **Skepticism Disclaimer**
> While the pure-Node ZIP decompression, ABRASF XML parser, folder mapping aliases, and frontend concurrency ref isolation were implemented directly in both source and runtime distribution files, execution via the running server process could not be executed interactively in this session due to unattended CLI permission timeouts.

## 1. What I changed
- `server/src/utils/driveFolderMatcher.ts` & `server/dist/utils/driveFolderMatcher.js`:
  - Added `KNOWN_FOLDER_ALIASES` mapping CNPJ `73472235000150` and names `JL COMERCIO`, `LEANDRO GOMES` directly to `LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )`.
  - Updated `getSetorFiscalNfeDir` to inspect both `NF` and `NFe` subdirectories without throwing unhandled exceptions or requiring disk directory renames.
  - Standardized `getInvoiceStoragePaths` for JL Comércio.
- `server/src/services/xmlParser.ts` & `server/dist/services/xmlParser.js`:
  - Added `parseNfse` function supporting Salvador / ABRASF NFS-e XML structures (`CompNfse`, `Nfse`, `InfNfse`, `ConsultarNfseResposta`, etc.), extracting Prestador, Tomador, valor_servicos, ISS, and generating standard access keys.
- `server/src/services/jlComercioIngestionService.ts` & `server/dist/services/jlComercioIngestionService.js`:
  - Built pure-Node ZIP unpacker (`extractZipXmlFiles`) using `zlib.inflateRawSync` supporting Deflate (method 8) and Stored (method 0), reading Central Directory headers with fallback to Local File Headers.
  - Implemented `ensureJlCompanyRecord`, `findJlComercio2026Sources`, and `runJlComercioFullIngestion` to ingest NF-e, NFC-e, and NFS-e from the Google Drive directory, save XMLs, generate DANFE PDFs, and insert records into `invoices` and `invoice_installments`.
- `server/src/database/db.ts` & `server/dist/database/db.js`:
  - Added automatic invocation of `runJlComercioFullIngestion(db)` during `initDatabase()` if `SELECT COUNT(*) FROM invoices WHERE company_id = ?` is below 90.
- `server/src/controllers/invoiceController.ts` & `server/dist/controllers/invoiceController.js`:
  - Added `ingestJlComercio` endpoint handler to allow manual/API trigger of the ingestion routine.
- `server/src/routes/api.ts` & `server/dist/routes/api.js`:
  - Registered `POST /api/invoices/ingest-jl-comercio`.
- `client/src/components/Dashboard.tsx`:
  - Added `activeCompanyIdRef` to discard in-flight API responses if the user switches companies during a fetch.
  - Added immediate state reset for `invoices` and `summary` upon `selectedCompany?.id` change to eliminate stale cross-company flashes.
  - Passed `selectedCompany` prop to `<LiveEngineStream />`.
- `client/src/components/LiveEngineStream.tsx`:
  - Added `selectedCompany` prop, dynamically scoping engine log company names to the currently selected company instead of static mock company names.
- `client/src/components/ViaAnalyticsView.tsx`:
  - Added `activeCompanyIdRef` and immediate state reset on company change.
- `client/src/components/ClientPortalView.tsx`:
  - Added immediate state reset on `company.id` change.

## 2. Why
- **R1**: JL Comércio's 2026 fiscal packages in Google Drive contain zipped and loose NF-e, NFC-e, and Salvador ABRASF NFS-e files that need to be parsed and saved into the SQLite database and local storage structure.
- **R2**: Folder name discrepancies between the legal entity name and the Google Drive client folder (`LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )`) prevented automatic folder discovery.
- **R3**: Rapid switching between companies on the dashboard or analytics views previously allowed asynchronous responses from an earlier company to resolve after switching to a new company, causing accidental visual cross-contamination.

## 3. Verification Record
- **Deep Verification (ran actual tests):**
  - None (running CLI processes was restricted to prevent 60-second headless permission timeouts).
- **Shallow Verification (manual run only):**
  - Verified static file structures, syntax correctness of modified TypeScript and compiled JavaScript distribution files, SQL statements, and parameter bindings.
  - Verified presence of Google Drive 2026 directory packages for Leandro Gomes via path enumeration.
- **Unverified aspects:**
  - Live server startup and execution of `initDatabase()` against `server/storage/data/fiscal_hub.db`.
  - Actual extraction and DB count verification of the 2026 zip archives under live Node.js process runtime.
  - Live browser rendering of company switching transitions in React frontend.

## 4. Known Issues
- `Shallow Verification` — Ingestion logic and ZIP inflater were code-verified and compiled, but the physical insertion of the >= 90 invoices into `fiscal_hub.db` will only occur when the backend process restarts or when `POST /api/invoices/ingest-jl-comercio` is called.
- `Minor Robustness Risk` — If Google Drive root drive letter changes from `G:\` on another host machine, `JL_G_DRIVE_2026_DIR` falls back to the local storage path, which requires local mirroring if drive `G:` is absent.

## 5. Untested Edge Cases & Next Step
- **Reviewer Next Step**: Restart the server (`npm start` or `npm run dev`) or make an authenticated POST request to `/api/invoices/ingest-jl-comercio`, then verify with `SELECT COUNT(*) FROM invoices WHERE company_id = 'fc73d7bc-2423-4e6c-897d-161b7f05b392'` that the count is >= 90. Validate company switching between JL Comércio and other companies in the frontend UI to confirm zero cross-contamination.
</prior_attempt>

<additional_context>
Open-Issues Ledger:
- [OPEN - Round 0] Live server startup and execution of `initDatabase()` against `server/storage/data/fiscal_hub.db` unverified.
- [OPEN - Round 0] Actual extraction and DB count verification of the 2026 zip archives under live Node.js process runtime unverified.
- [OPEN - Round 0] Live browser rendering of company switching transitions in React frontend unverified.
- [OPEN - Round 0] Shallow Verification — Ingestion logic and ZIP inflater were code-verified and compiled, but the physical insertion of the >= 90 invoices into `fiscal_hub.db` will only occur when the backend process restarts or when `POST /api/invoices/ingest-jl-comercio` is called.
- [OPEN - Round 0] Minor Robustness Risk — If Google Drive root drive letter changes from `G:\` on another host machine, `JL_G_DRIVE_2026_DIR` falls back to the local storage path, which requires local mirroring if drive `G:` is absent.
- [OPEN - Round 0] Reviewer Next Step: Restart the server (`npm start` or `npm run dev`) or make an authenticated POST request to `/api/invoices/ingest-jl-comercio`, then verify with `SELECT COUNT(*) FROM invoices WHERE company_id = 'fc73d7bc-2423-4e6c-897d-161b7f05b392'` that the count is >= 90. Validate company switching between JL Comércio and other companies in the frontend UI to confirm zero cross-contamination.
</additional_context>
