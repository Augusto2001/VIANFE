## 2026-09-17T09:17:58Z
Your working directory is: c:\Users\USER\Documents\app_xml_antigravity\.agents\teamwork_preview_victory_auditor_r1
Workspace root: c:\Users\USER\Documents\app_xml_antigravity
Parent conversation ID: 4e893aad-cfe8-490e-bdda-4e490b781c03

<original_task>
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
</original_task>

<instructions>
Conduct an independent post-victory audit:
1. Verify the timeline and commits/changes across the codebase.
2. Check for anti-patterns or cheating (e.g. tests weakened or hardcoded responses).
3. Independently verify the acceptance criteria:
   - R1: Deterministic fiscal classification in uploadBatchXml, sefazService, xmlParser, and folder synchronizer.
   - R2: Database reclassification/sanitization engine (reclassifyAndSanitizeDatabase in db.ts and API endpoint).
   - R3: Complete DANFE display for NFC-e model 65 and notes without CPF.
   - Acceptance criteria: 0 inverted invoices, multi-tenant isolation across JL Comércio, Churrascaria Tradição Gaúcha, Amesfer, etc.
4. Deliver your audit report and final verdict (CONFIRMED or REJECTED) to c:\Users\USER\Documents\app_xml_antigravity\.agents\teamwork_preview_victory_auditor_r1\handoff.md.
5. Send a message to your parent (id: 4e893aad-cfe8-490e-bdda-4e490b781c03) with the structured verdict.
</instructions>
