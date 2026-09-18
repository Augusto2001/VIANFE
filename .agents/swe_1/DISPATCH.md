## 2026-09-16T16:28:29Z

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
