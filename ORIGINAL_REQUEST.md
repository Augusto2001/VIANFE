# Original User Request

## 2026-08-27T10:36:58Z

Desenvolver o Super App Viacont (Área do Cliente) com suporte responsivo híbrido (Mobile PWA para celular e Área do Cliente Expandida para desktop/computador), incluindo Emissor de Notas Fiscais (NFS-e e NF-e), Central de Guias de Impostos com PIX Copia-e-Cola, Leitor/Scanner OCR de Recibos e Painel Financeiro do Cliente.

Working directory: C:\app_xml_antigravity
Integrity mode: development

## Requirements

### R1. Área do Cliente Híbrida (Mobile PWA & Desktop Expandido)
Desenvolver a interface da Área do Cliente com chaveamento fluido entre visão mobile (focada em velocidade, botões rápidos de toque e facilidade) e visão desktop (grade expandida com relatórios, faturamento e downloads).

### R2. Emissor Relâmpago de Notas Fiscais Integrado (NFS-e & NF-e)
Implementar emissão guiada em 3 passos pelo celular/desktop (1. Busca CNPJ/CPF com autopreenchimento; 2. Seleção de Produto/Serviço; 3. Emissão instantânea com geração de PDF + Link/QR Code PIX para envio no WhatsApp do cliente).

### R3. Central de Guias & Impostos com 1-Clique PIX
Disponibilizar a visualização das guias fiscais apuradas pela contabilidade (DAS Simples Nacional, ICMS, Guias de Folha) com botão de "Copiar Código PIX" e status de pagamento.

### R4. Captura & Scanner OCR de Recibos e Comprovantes
Interface para envio de fotos de notas de compras, cupons e recibos de balcão via câmera/upload, integrando com o contas a pagar e auto-match.

### R5. Painel Financeiro & Diagnóstico em Tempo Real
Exibição do fluxo de caixa diário, contas a vencer/receber e termômetro do Simples Nacional (RBT12 vs teto anual).

## Acceptance Criteria

### Experiência de Usuário & Responsividade
- [ ] O app carrega perfeitamente em telas móveis (layout de aplicativo nativo) e se expande em telas de computador/desktop.
- [ ] O cliente pode alternar entre as abas principais (Início/Finanças, Emitir Notas, Guias/Impostos, Recibos) sem recarregar a página.

### Emissão de Notas
- [ ] Formulário de emissão rápida em 3 passos funcional, gerando o espelho da nota e opção de compartilhamento no WhatsApp.
- [ ] Suporte a catálogo de produtos e serviços favoritos para emissão em 1 toque.

### Central de Guias & PIX
- [ ] Listagem de guias com valor, vencimento e botão funcional de cópia do código PIX.

### Build & Integridade
- [ ] Compilação do cliente (`npm run build --prefix client`) e servidor (`npm run build --prefix server`) sem erros de TypeScript ou Vite.

## 2026-08-27T20:07:00Z

Tornar todos os dados, métricas financeiras, previsões de caixa, faturamento e guias de impostos do Super App Viacont / Área do Cliente 100% determinísticos, reais e dinâmicos, consultando exclusivamente as tabelas do banco de dados da empresa selecionada (company_id), eliminando qualquer número inventado, valor fixo/mockado (como os R$ 145k) ou vazamento de dados entre clientes.

Working directory: C:\app_xml_antigravity
Integrity mode: development

## Requirements

### R1. Backend: Endpoint de Métricas & Diagnóstico Financeiro Real da Empresa
Criar/ajustar endpoint GET /api/portal/dashboard-summary?company_id=XYZ que calcula em tempo real via SQL:
- Saldo Previsto no Caixa: Soma real de créditos menos débitos das transações bancárias da empresa selecionada.
- A Receber Este Mês: Total de NF-e/NFS-e de saída emitidas no mês atual ou duplicatas a vencer daquela empresa.
- A Pagar Este Mês: Total de NF-e de entrada (compras) a vencer no mês atual + guias de provisão daquela empresa.
- Termômetro do Simples Nacional (RBT12 Real): Soma real do faturamento dos últimos 12 meses emitido pela empresa na SEFAZ/Prefeitura vs teto de R$ 4,8M (e R$ 3,6M).
- Se a empresa for nova ou não tiver movimentações, retornar 0,00 (zero) de forma estrita, nunca inventar valores fictícios.

### R2. Backend: Endpoint Dinâmico de Guias de Impostos & Tributos
Ajustar listagem de guias em GET /api/portal/tax-guides?company_id=XYZ para buscar exclusivamente as provisões fiscais reais da tabela accounting_provisions (DAS, ICMS, FGTS, Folha) geradas para a empresa, gerando a chave/código PIX com base no CNPJ real da empresa e valor da guia.

### R3. Frontend: Eliminar Todo e Qualquer Mock Hardcoded no Super App
Refatorar ClientPortalView.tsx para consumir 100% dos dados dos endpoints da API (company.id), exibindo R$ 0,00 quando não houver dados, sem textos ou números fictícios (como "R$ 145.892,30" ou "R$ 884k").

### R4. Isolamento Estrito Multi-Tenant & Auditoria de Vazamento de Dados
Garantir que todas as consultas SQL no backend usem estritamente WHERE company_id = ? para impedir qualquer contaminação de dados entre empresas clientes.

## Acceptance Criteria

### Integridade dos Dados & Determinismo
- [ ] O dashboard do Super App exibe os valores exatos de notas, faturamentos e extratos da empresa selecionada (ex: se a empresa faturou R$ 5.000, o faturamento exibe R$ 5.000,00; se tem saldo 0, exibe R$ 0,00).
- [ ] Nenhuma constante estática ou número fictício permanece no código do frontend ou backend.

### Guias Fiscais Reais
- [ ] A aba de guias de impostos exibe apenas as guias e provisões cadastradas para o CNPJ da empresa ativa.

### Build & Testes
- [ ] Compilação de client e server com 0 erros de tipagem TypeScript.
- [ ] Testes de isolamento multi-tenant validados.

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

