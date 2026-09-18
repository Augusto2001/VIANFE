# Original User Request

## Initial Request — 2026-08-27T20:07:00Z

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

## 2026-09-16T16:23:33Z

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

## 2026-09-17T08:01:04Z

This is a single self-contained fix; keep it small and focused.

Correção definitiva do classificador de direção fiscal (Entrada vs Saída) no importador de XMLs e reclassificação automática de todo o banco de dados para todas as empresas (JL Comércio / Leandro Gomes, Churrascaria Tradição Gaúcha, Amesfer, Sales Comércio, etc.).

Working directory: c:\Users\USER\Documents\app_xml_antigravity
Integrity mode: demo

## Requirements

### R1. Correção Algorítmica do Importador de XMLs (uploadBatchXml / xmlParser)
Garantir que tanto no importador em lote (botão de upload manual de XMLs) quanto no sincronizador de pastas e SEFAZ, o sistema compare rigorosamente o CNPJ da empresa ativa com o CNPJ do Emitente e Destinatário do XML:
- Se emitente_cnpj === company.cnpj e tpNF === '1' -> tipo = 'saida' (Venda / Faturamento da empresa).
- Se destinatario_cnpj === company.cnpj e tpNF === '1' -> tipo = 'entrada' (Compra / Mercadoria recebida de fornecedor).
- Se tpNF === '0' (emissão própria de entrada para devolução/remessa) -> tipo = 'entrada'.
- Eliminar qualquer lógica que classifique notas emitidas pela própria empresa como "entrada".

### R2. Reclassificação e Saneamento do Banco de Dados Existente
Executar uma varredura em todas as notas fiscais cadastradas no banco de dados SQLite (invoices), confrontando o CNPJ da empresa proprietária (companies.cnpj) com emitente_cnpj e destinatario_cnpj:
- Corrigir o campo tipo ('entrada' vs 'saida') de todas as notas fiscais de todas as empresas (JL Comércio, Churrascaria Tradição Gaúcha, Lopes, Amesfer, etc.).
- Atualizar os totais nos KPIs do Dashboard e Relatórios em conformidade com a contabilidade fiscal real.

### R3. Preenchimento e Exibição Completa dos DANFEs
Garantir que as notas de venda balcão ao consumidor (NFC-e modelo 65) e notas sem CPF preenchido exibam identificação amigável e completa nos DANFEs ("Consumidor Final - Venda Balcão", "CPF não informado no cupom", dados corretos da empresa emitente).

## Acceptance Criteria

### Classificação Fiscal
- [ ] No painel de JL Comércio (Leandro Gomes - 73.472.235/0001-50), todas as 1.442 notas emitidas constam exclusivamente sob Saídas (Faturamento) e as compras de fornecedores constam sob Entradas.
- [ ] Na Churrascaria Tradição Gaúcha e demais empresas clientes, as notas emitidas pela empresa e as notas de compras recebidas de fornecedores estão 100% segregadas sem inversão.
- [ ] O botão de upload e importação manual de XMLs processa novos arquivos aplicando a regra determinística de tipo.

### Teste e Integridade
- [ ] Script de verificação automatizada confirma 0 notas com direção invertida no banco de dados.
- [ ] Frontend (npm run build) e Backend (tsc) compilam com 0 erros.

