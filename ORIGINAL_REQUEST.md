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
