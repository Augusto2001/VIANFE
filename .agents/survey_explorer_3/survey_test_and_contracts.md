# Relatório de Auditoria: Ecossistema de Build, Contratos de API e Estratégia de Testes E2E (Tiers 1-4)
**Projeto:** Super App Viacont (Área do Cliente) & Ecossistema Fiscal ViaNfe  
**Data:** 27 de Agosto de 2026  
**Auditor:** Survey Explorer 3  
**Status:** Concluído  

---

## 1. Sumário Executivo & Visão Geral do Ecossistema

O repositório `app_xml_antigravity` é uma plataforma fullstack híbrida (Web & Mobile PWA) voltada para automação fiscal, emissão de notas (NFS-e / NF-e), inteligência contábil (BPO Financeiro), conciliação bancária lado a lado, auditoria de monofásicos e integração com a SEFAZ Nacional, Prefeituras e Google Drive.

O ecossistema divide-se em:
1. **Frontend (`client/`)**: Aplicação SPA React 18 + Vite 6 + TailwindCSS 3 + TypeScript 5, com suporte responsivo híbrido (Mobile PWA e Área do Cliente Expandida para Desktop).
2. **Backend (`server/`)**: API REST Express 4 + TypeScript 5 (`tsx` em desenvolvimento e `tsc` em produção), banco de dados embarcado ultra-rápido SQLite 3 nativo (`node:sqlite` DatabaseSync do Node.js 22), segurança com JWT e Bcrypt Salt 12, geradores de DANFE/PDFKit, analisadores de XML fiscal e agendador cron de background.

---

## 2. Auditoria do Sistema de Build e Dependências

### 2.1 Configurações de Scripts no `package.json` Raiz
- **`npm run dev`**: Executa concorrentemente `npm run dev:server` e `npm run dev:client` via pacote `concurrently ^9.1.2`.
- **`npm run build`**: Executa `npm.cmd run --prefix server build && npm.cmd run --prefix client build`.
- **`npm run start`**: Inicia o backend compilado com `node dist/index.js`.
- **`npm run backup`**: Aciona script PowerShell de snapshot de segurança (`save_daily_backup.ps1`).

### 2.2 Client (`client/package.json` e `vite.config.ts`)
- **Dependências Principais**:
  - `react`: `^18.3.1`, `react-dom`: `^18.3.1`
  - `lucide-react`: `^0.475.0` (Ícones e indicadores visuais)
  - `clsx`: `^2.1.1`, `tailwind-merge`: `^3.0.1` (Utilidades CSS)
  - `canvas-confetti`: `^1.9.4` (Feedback gamificado de conciliação e emissão)
  - `date-fns`: `^4.1.0` (Manipulação de datas e competências)
  - `file-saver`: `^2.0.5`, `jszip`: `^3.10.1` (Exportação e downloads de pacotes de XML/PDF)
- **Vite Build (`vite.config.ts`)**:
  - Alvo: `es2020`
  - Minificação: `esbuild` + `cssMinify: true`
  - `sourcemap: false` (Zero SourceMaps em produção para proteção do código-fonte contra engenharia reversa no DevTools)
  - Chunks manuais: divisão de vendor (`react`, `react-dom`) e `lucide-react`
  - Proxy local: `/api` -> `http://127.0.0.1:3001`
  - Headers de Segurança integrados: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`
- **TypeScript (`tsconfig.json`)**:
  - Target: `ES2020`, Module: `ESNext`, ModuleResolution: `bundler`, Path aliases `@/*` mapeados para `src/*`.

### 2.3 Server (`server/package.json` e `tsconfig.json`)
- **Dependências Principais**:
  - `express`: `^4.21.2`, `cors`: `^2.8.5`, `dotenv`: `^16.4.7`
  - `jsonwebtoken`: `^9.0.3`, `bcryptjs`: `^3.0.3` (Autenticação JWT Multi-Tenant com Salt 12)
  - `fast-xml-parser`: `^4.5.3` (Leitura de XMLs SEFAZ e ABRASF)
  - `pdfkit`: `^0.16.0` (Geração de espelhos de notas, recibos e DANFE)
  - `node-forge`: `^1.4.0` (Validação e extração criptográfica de certificados digitais PFX A1)
  - `multer`: `^1.4.5-lts.1`, `archiver`: `^7.0.1` (Upload em lote e empacotamento ZIP)
  - `tesseract.js`: `^7.0.0` (Motor OCR de imagem para leitura de recibos e quebra de captchas)
  - `googleapis`: `^144.0.0` (Sincronização em nuvem Google Drive)
  - `node-cron`: `^3.0.3` (Robô agendador automático)
  - `uuid`: `^11.1.0` (Geração de identificadores únicos)
- **TypeScript (`tsconfig.json`)**:
  - Target: `ES2022`, Module: `NodeNext`, ModuleResolution: `NodeNext`, OutDir: `./dist`, RootDir: `./src`.

---

## 3. Mapeamento Exaustivo dos Contratos de API (Endpoints & Payloads)

A tabela abaixo sintetiza todos os contratos de API entre o Cliente e o Servidor, incluindo autenticação, parâmetros, formato de payload e códigos de status HTTP.

| Método | Endpoint | Autenticação / Permissão | Parâmetros de Query / Rota | Payload (Request Body) | Resposta de Sucesso (200/201) | Tratamento de Erro (400/401/404/500) |
|---|---|---|---|---|---|---|
| **POST** | `/api/auth/login` | Pública | N/A | `{ email: string, password: string }` | `{ success: true, token: string, user: { id, tenant_id, name, email, role, assignedCompanyIds } }` | `400` dados ausentes; `401` senha incorreta ou inativo; `500` falha interna |
| **GET** | `/api/auth/me` | JWT Obrigatório | N/A | Vazio (Bearer Token no Header) | `{ success: true, user: { id, tenant_id, name, email, role, assignedCompanyIds } }` | `401` Token expirado ou inválido |
| **POST** | `/api/auth/forgot-password` | Pública | N/A | `{ email: string }` | `{ success: true, message: string, resetToken?: string }` | `400` email não informado; `500` erro interno |
| **POST** | `/api/auth/reset-password` | Pública | N/A | `{ token: string, newPassword: string }` | `{ success: true, message: string }` | `400` token expirado (>30min) ou senha < 6 dígitos |
| **GET** | `/api/tenants` | JWT + Admin | N/A | Vazio | `{ success: true, data: Tenant[] }` | `401/403` Acesso não autorizado; `500` erro interno |
| **POST** | `/api/tenants` | JWT + Admin | N/A | `{ name: string, cnpj?: string, admin_name: string, admin_email: string, admin_password: string, plan?: string }` | `{ success: true, message: string, data: Tenant }` | `400` e-mail já existe ou campos faltantes |
| **GET** | `/api/users` | JWT + Admin | N/A | Vazio | `{ success: true, users: User[] }` | `401/403` Não autorizado; `500` erro no banco |
| **POST** | `/api/users` | JWT + Admin | N/A | `{ name: string, email: string, password: string, role?: string, companyIds?: string[] }` | `{ success: true, message: string, userId: string }` | `400` senha < 4 caracteres ou email duplicado |
| **GET** | `/api/companies` | JWT Obrigatório | N/A | Vazio | `{ success: true, data: Company[] }` (com contadores agregados) | `401` Não autorizado; `500` falha de consulta |
| **GET** | `/api/companies/:id` | JWT Obrigatório | `id` (UUID) | Vazio | `{ success: true, data: Company }` | `404` Empresa não encontrada |
| **POST** | `/api/companies` | JWT Obrigatório | N/A | `{ cnpj, razao_social, uf, ... }` | `{ success: true, data: Company }` | `400` CNPJ inválido ou sem 14 dígitos; `409` CNPJ duplicado |
| **PUT** | `/api/companies/:id` | JWT Obrigatório | `id` (UUID) | `{ razao_social?, nome_fantasia?, uf?, ... }` | `{ success: true, data: Company }` | `404` Empresa não encontrada |
| **DELETE** | `/api/companies/:id` | JWT Obrigatório | `id` (UUID) | Vazio | `{ success: true, message: string }` | `404` Empresa não encontrada |
| **POST** | `/api/companies/:id/certificate` | JWT Obrigatório | `id` (UUID) | Multipart FormData: `certificate` (arquivo .pfx), `password` (string) | `{ success: true, message: string, info: { subject, issuer, validTo } }` | `400` Senha do PFX incorreta ou arquivo corrompido |
| **GET** | `/api/cnpj/lookup/:cnpj` | JWT Obrigatório | `cnpj` (14 dígitos) | Vazio | `{ success: true, data: { cnpj, razao_social, nome_fantasia, logradouro, numero, bairro, municipio, uf, cep, email, telefone } }` | `404/500` CNPJ não localizado na base federal |
| **GET** | `/api/invoices` | JWT Obrigatório | `company_id`, `period`, `startDate`, `endDate`, `tipo`, `status`, `search`, `page`, `limit` | Vazio | `{ success: true, data: Invoice[], summary: InvoiceSummary, pagination: { page, limit, totalPages } }` | `400` company_id obrigatório para isolamento seguro |
| **GET** | `/api/invoices/:id` | JWT Obrigatório | `id` (UUID) | Vazio | `{ success: true, data: InvoiceDetail }` (com itens, parcelas e duplicatas) | `404` Nota não encontrada |
| **GET** | `/api/invoices/:id/xml` | JWT Opcional / Token Query | `id` (UUID) | Vazio | Stream `application/xml` (Anexo .xml) | `404` Arquivo XML não localizado |
| **GET** | `/api/invoices/:id/pdf` | JWT Opcional / Token Query | `id` (UUID) | Vazio | Stream `application/pdf` (DANFE oficial Padrão Nacional) | `404` Não foi possível renderizar DANFE |
| **POST** | `/api/invoices/download-zip` | JWT Obrigatório | N/A | `{ company_id: string, type: 'xml' \| 'pdf', ids?: string[], period?, startDate?, endDate? }` | Stream Binário `application/zip` | `400` Parâmetros ausentes; `404` sem notas |
| **POST** | `/api/invoices/upload-batch` | JWT Obrigatório | N/A | Multipart FormData: `company_id`, `xmlFiles` (até 100 arquivos) | `{ success: true, processed: number, errors?: string[] }` | `400` Nenhum arquivo válido enviado |
| **POST** | `/api/portal/manifest` | JWT Obrigatório | N/A | `{ invoice_id: string, event_type: 'ciencia' \| 'confirmacao' \| 'desconhecimento' \| 'nao_realizada', justificativa?: string }` | `{ success: true, message: string, data: { protocol, eventLabel, eventCode, manifestedAt } }` | `400` Justificativa < 15 caracteres para recusa; `404` Nota inexistente |
| **GET** | `/api/portal/manifestations/:invoiceId` | JWT Obrigatório | `invoiceId` (UUID) | Vazio | `{ success: true, history: ManifestationRecord[] }` | `500` Erro de busca |
| **GET** | `/api/portal/nfse` | JWT Obrigatório | `company_id` | Vazio | Array de `NfseRecord[]` | `400` company_id ausente |
| **POST** | `/api/portal/nfse/emit` | JWT Obrigatório | N/A | `{ company_id, prefeitura, tomador_cnpj, tomador_nome, valor_servicos, aliquota_iss?, discriminacao_servico, whatsapp_phone?, iss_retido?, item_servico?, numero_rps?, serie_rps? }` | `{ success: true, numeroNfse, codigoVerificacao, status, mensagem, pdfUrl?, whatsapp_sent? }` | `400` Campos obrigatórios em branco; `500` Erro no robô/webservice |
| **GET** | `/api/portal/nfse/:id/pdf` | Pública / Token | `id` (UUID) | Vazio | Stream `application/pdf` | `404` RPS / Nota não localizada |
| **GET** | `/api/portal/nfse/clients` | JWT Obrigatório | `company_id` | Vazio | `{ success: true, data: RecurringClient[] }` | `500` Erro de busca |
| **POST** | `/api/portal/nfse/clients` | JWT Obrigatório | N/A | `{ company_id, cnpj_cpf, razao_social, email?, telefone_whatsapp?, cep?, logradouro?, numero?, bairro?, municipio?, uf?, iss_retido?, aliquota_iss?, item_servico?, discriminacao_padrao?, valor_padrao? }` | `{ success: true, message: string, id: string }` | `400` CNPJ/CPF e Razão Social obrigatórios |
| **GET** | `/api/bpo/accounts` | JWT Obrigatório | `company_id` | Vazio | `{ success: true, data: BankAccount[] }` | `400` company_id ausente |
| **POST** | `/api/bpo/accounts` | JWT Obrigatório | N/A | `{ company_id, banco_nome, banco_codigo?, agencia?, conta?, tipo_conta?, saldo_inicial? }` | `{ success: true, data: BankAccount }` | `400` Banco não informado |
| **POST** | `/api/bpo/upload-statement` | JWT Obrigatório | N/A | `{ company_id: string, bank_account_id?: string, ofx_content: string }` | `{ success: true, message: string, insertedCount: number }` | `400` OFX mal formatado |
| **GET** | `/api/bpo/transactions` | JWT Obrigatório | `company_id`, `status` | Vazio | `{ success: true, data: BankTransaction[] }` (com sugestão de auto-match) | `500` Erro ao listar transações |
| **POST** | `/api/bpo/reconcile/:id` | JWT Obrigatório | `id` (UUID) | `{ categoria_id?: string, invoice_id?: string, observacoes_cliente?: string, learn_rule?: boolean }` | `{ success: true, message: string }` | `404` Transação inexistente |
| **GET** | `/api/bpo/categories` | JWT Obrigatório | N/A | Vazio | `{ success: true, data: FinancialCategory[] }` | `500` Erro ao buscar categorias |
| **GET** | `/api/bpo/business-success` | JWT Obrigatório | `company_id`, `month?`, `year?` | Vazio | `{ success: true, data: { dre, kpis, radarFiscal, modalidadesVendas, top5Fornecedores, top5Clientes } }` | `400` company_id ausente |
| **GET** | `/api/bpo/provisions` | JWT Obrigatório | `company_id` | Vazio | `{ success: true, data: AccountingProvision[] }` | `500` Erro ao buscar provisões |
| **POST** | `/api/bpo/provisions/import-payroll` | JWT Obrigatório | N/A | `{ company_id, competencia, salarios_brutos, inss_empresa, fgts, pro_labore }` | `{ success: true, message: string, createdCount: number }` | `400` Competência ausente |
| **POST** | `/api/bpo/provisions/import-taxes` | JWT Obrigatório | N/A | `{ company_id, competencia, valor_das, valor_icms, valor_iss }` | `{ success: true, message: string, createdCount: number }` | `400` Competência ausente |
| **GET** | `/api/tax-audit/summary` | JWT Obrigatório | `company_id` | Vazio | `{ success: true, summary: { totalInvoices, totalRecoverablePisCofins, monofasicosCount, invalidNcmCount, opportunitiesList } }` | `400` company_id ausente |
| **POST** | `/api/notifications/whatsapp-send` | JWT Obrigatório | N/A | `{ phone: string, message: string, pdfUrl?: string, companyName?: string, isManualTrigger?: boolean }` | `{ success: true, messageId: string, message: string }` | `400` Número de telefone inválido |
| **POST** | `/api/support/tickets` | Pública | N/A | `{ solicitante_nome, solicitante_phone, company_id?, company_name?, tipo_demanda, mensagem_erro }` | `{ success: true, message: string, data: { id, protocol } }` | `400` Campos em branco |
| **GET** | `/api/support/tickets` | JWT Obrigatório | N/A | Vazio | `{ success: true, data: SupportTicket[] }` | `500` Erro ao carregar chamados |
| **PUT** | `/api/support/tickets/:id/resolve`| JWT Obrigatório | `id` (UUID) | `{ solucao: string }` | `{ success: true, message: string }` | `400` Solução não preenchida |

---

## 4. Análise de Lacunas (Gap Analysis) para o Super App Viacont Área do Cliente

Ao confrontar o código-fonte atual com os 5 requisitos de `ORIGINAL_REQUEST.md`, identificamos as seguintes necessidades de extensão:

### R1. Área do Cliente Híbrida (Mobile PWA & Desktop Expandido)
- **Estado Atual**: `ClientPortalView.tsx` possui apenas duas abas (`manifest` e `quick_entry`).
- **Necessidade**: Implementar o shell completo do Super App com navegação fluida por abas: `Início / Finanças`, `Emitir Notas`, `Guias & Impostos`, `Recibos & Scanner OCR`. Suporte a layout PWA mobile (barra de navegação inferior nativa, botões de toque com `min-h-[48px]`) e visualização expandida de faturamento para desktop.

### R2. Emissor Relâmpago de Notas Fiscais Integrado (NFS-e & NF-e)
- **Estado Atual**: A emissão de NFS-e existe em `NfseView.tsx` em formato de modal extenso administrativo.
- **Necessidade**: No Portal do Cliente, fornecer um fluxo guiado simplificado em 3 passos (1. Busca CNPJ/CPF com autopreenchimento; 2. Catálogo de serviços/produtos favoritos em 1 toque; 3. Emissão instantânea com espelho da nota gerado em PDF + botão de compartilhamento com QR Code / Link PIX no WhatsApp do cliente).

### R3. Central de Guias & Impostos com 1-Clique PIX
- **Estado Atual**: As provisões de impostos estão salvas em `accounting_provisions`, mas não possuem chave PIX copia-e-cola gerada, código de barras e status visual de quitação/vencimento diretamente acessível ao cliente final.
- **Necessidade**: Adicionar listagem de guias do cliente (DAS Simples Nacional, ICMS, Folha/FGTS) com botão de cópia rápida do código PIX Copia-e-Cola (`00020126...`), data de vencimento e indicador visual de urgência.

### R4. Captura & Scanner OCR de Recibos e Comprovantes
- **Estado Atual**: A captura móvel atual grava apenas um registro básico. O pacote `tesseract.js` está instalado no backend mas só é acionado para captchas.
- **Necessidade**: Integrar serviço de OCR inteligente no envio da foto do comprovante/recibo (`/api/portal/receipts/ocr` ou `/api/bpo/upload-statement`) para extrair automaticamente: Data, Valor Total, CNPJ/Nome do Estabelecimento e vincular ao Contas a Pagar (`invoice_installments`).

### R5. Painel Financeiro & Diagnóstico em Tempo Real
- **Estado Atual**: `BusinessSuccessDashboard.tsx` calcula métricas gerenciais para a contabilidade.
- **Necessidade**: Apresentar na tela inicial da Área do Cliente um painel simplificado com: Fluxo de caixa do dia, Contas a vencer x Contas a receber, e o Termômetro Visual do Simples Nacional (RBT12 acumulado vs Sublimite de R$ 3,6M e Teto de R$ 4,8M).

---

## 5. Estratégia Abrangente de Testes E2E (Tiers 1 a 4)

Propomos uma matriz de testes sem intervenção manual, dividida em quatro níveis rigorosos:

```
+-------------------------------------------------------------------------+
|                  TIER 4: WORKFLOWS DE NEGÓCIO REAL                      |
| (Jornadas completas contabilidade -> cliente -> emissão -> conciliação) |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                TIER 3: TESTES COMBINATÓRIOS (PAIRWISE)                  |
| (Mobile vs Desktop, Admin vs Cliente, Simples vs Presumido, Cidades)    |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|              TIER 2: LIMITES, EXCEÇÕES & CORNER CASES                   |
|  (CNPJs inválidos, timeouts, certificados expirados, concorrência)     |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                 TIER 1: COBERTURA DE RECURSOS BÁSICOS                   |
|   (Happy paths de login, navegação, CRUD empresas, emissão, downloads)  |
+-------------------------------------------------------------------------+
```

---

### 5.1 TIER 1: Cobertura Funcional de Recursos (Feature Coverage)
Garante que todas as funcionalidades principais operem com sucesso nas condições normais de uso.

| ID | Cenário / Funcionalidade | Ação Executada | Resultado Esperado |
|---|---|---|---|
| **T1.01** | Autenticação Master Admin | Enviar POST `/api/auth/login` com credenciais padrão | Retorna status 200, JWT token válido e objeto de usuário com `role: 'admin'`. |
| **T1.02** | Autenticação Usuário Cliente | Enviar POST `/api/auth/login` com usuário restrito | Retorna status 200, JWT contendo lista de empresas autorizadas em `assignedCompanyIds`. |
| **T1.03** | Cadastro e Consulta de Empresa | Cadastrar empresa via POST `/api/companies` e consultar GET `/api/companies/:id` | Status 200/201, dados persistidos no SQLite e disponíveis para seleção. |
| **T1.04** | Autopreenchimento de CNPJ | Executar GET `/api/cnpj/lookup/00000000000191` | Retorna Razão Social, UF, Endereço e CNAE sem erros. |
| **T1.05** | Emissão Rápida NFS-e (Passo 1-3) | Enviar POST `/api/portal/nfse/emit` com dados válidos | Gera número RPS sequencial, código de verificação, status autorizada e URL do espelho PDF. |
| **T1.06** | Consulta e Cópia de PIX de Guias | Acessar listagem de guias tributárias e solicitar código PIX | Retorna string válida formatada no padrão EMVCo do Banco Central com valor e vencimento. |
| **T1.07** | Upload de Recibo e Comprovante | Enviar imagem via POST `/api/bpo/upload-statement` | Imagem recebida, processada e listada na conciliação da empresa. |
| **T1.08** | Navegação SPA sem Recarga | Alternar abas Início, Emitir Notas, Guias e Recibos | Estado atualizado instantaneamente no React sem recarregar a janela do navegador. |
| **T1.09** | Download de DANFE / PDF | Executar GET `/api/invoices/:id/pdf` | Resposta com `Content-Type: application/pdf` e fluxo binário válido. |

---

### 5.2 TIER 2: Limites, Casos Extremos & Exceções (Boundary & Corner Cases)
Valida a resiliência do sistema contra entradas anômalas, ataques e falhas de infraestrutura.

| ID | Cenário de Teste | Condição / Entrada Extrema | Comportamento Esperado |
|---|---|---|---|
| **T2.01** | CNPJ/CPF com formato incorreto | Enviar CNPJ com 13 ou 15 dígitos ou letras em `/api/companies` | Rejeição imediata com HTTP 400 e mensagem clara (`CNPJ inválido`). |
| **T2.02** | Emissão de Nota com Valor Zero ou Negativo | Enviar `valor_servicos: 0` ou `valor_servicos: -500.00` | Rejeição com HTTP 400 informando valor de serviço inválido. |
| **T2.03** | Token JWT Expirado ou Adulterado | Enviar requisição com header `Authorization: Bearer token_falso` | Retorna HTTP 401 (`Sessão expirada. Faça login novamente.`). |
| **T2.04** | Isolamento Multi-Tenant Estrito | Usuário da Empresa A tenta consultar notas da Empresa B (`/api/invoices?company_id=B`) | Retorna HTTP 403 Forbidden ou dados filtrados apenas para sua empresa associada. |
| **T2.05** | Certificado Digital PFX com Senha Incorreta | Upload de arquivo `.pfx` com senha divergente | Retorna HTTP 400 com erro amigável sem derrubar o processo do servidor. |
| **T2.06** | Recusa de Nota sem Justificativa Mínima | Manifestação `desconhecimento` com justificativa de 5 caracteres | Rejeição HTTP 400 exigindo justificativa de pelo menos 15 caracteres. |
| **T2.07** | Upload em Lote de XMLs Inválidos/Corrompidos | Enviar arquivo TXT renomeado para `.xml` | O parser ignora o arquivo com log de aviso e processa os XMLs válidos do lote. |
| **T2.08** | Concorrência de Emissão RPS | Duas requisições simultâneas de emissão para a mesma empresa | Numeração sequencial de RPS é incrementada atomicamente sem gerar duplicidade. |

---

### 5.3 TIER 3: Testes Combinatórios em Matriz (Pairwise Testing)
Garante cobertura total de combinações de fatores de ambiente, perfil e regras fiscais.

| Fator A (Dispositivo / Viewport) | Fator B (Perfil de Usuário) | Fator C (Tipo de Operação) | Fator D (Regime / Município) | Critério de Validação |
|---|---|---|---|---|
| **Mobile (375x667 - iPhone SE)** | Usuário Cliente | Emissão Relâmpago NFS-e | Salvador (Nota Salvador) | Teclado numérico abre corretamente, botões de toque >= 44px, espelho PDF gerado. |
| **Mobile (390x844 - iPhone 14)** | Usuário Cliente | Copiar Código PIX de Guia | Simples Nacional (DAS) | Botão copia string para o Clipboard e exibe feedback de sucesso (Confetti / Toast). |
| **Mobile (412x915 - Android PWA)**| Usuário Cliente | Scanner OCR de Cupom Fiscal | Comprovante de Balcão | Câmera nativa abre pelo input `capture`, OCR extrai total e sugere match. |
| **Desktop (1920x1080 Full HD)** | Admin Viacont | Gestão de Múltiplas Empresas | Geral (Multi-Tenant) | Grid expandido com filtros avançados, relatórios DRE e exportação Domínio TXT. |
| **Desktop (1366x768 Laptop)** | Staff Contábil | Auditoria de Monofásicos | Regime Normal (ICMS/PIS) | Tabela de NCMs/CFOPs renderiza com paginação e sem estouro de largura. |
| **Tablet (768x1024 iPad)** | Usuário Cliente | Painel Financeiro / Termômetro | Simples Nacional (RBT12) | Gráfico do Termômetro adapta largura e exibe faixa de alíquota efetiva. |

---

### 5.4 TIER 4: Workflows de Aplicação no Mundo Real (End-to-End User Journeys)
Simula os fluxos contínuos de trabalho que ocorrem na rotina diária do escritório e do cliente.

#### Workflow 1: Jornada de Abertura de Mês e Apuração de Guias pelo Escritório
1. Contador faz login como Admin no escritório Viacont Master.
2. Importa o Plano de Contas da Domínio Sistemas e as Provisões de Folha/Impostos da competência.
3. As guias do Simples Nacional (DAS) e ICMS são geradas com código PIX Copia-e-Cola e data de vencimento.
4. O cliente acessa o Super App no celular e visualiza a guia em destaque no topo da tela com o valor e badge "A Vencer".
5. O cliente clica em "Copiar Código PIX", abre seu banco e conclui o pagamento.

#### Workflow 2: Emissão Relâmpago de Nota Fiscal de Prestação de Serviço com Envio no WhatsApp
1. Cliente prestador de serviços abre o Super App Viacont pelo celular no local de atendimento.
2. Digita o CNPJ do tomador -> O sistema busca na Receita Federal e preenche Razão Social e Endereço.
3. Toca no serviço favorito do catálogo ("Consultoria em TI - R$ 2.500,00").
4. Clica no botão "Emitir Nota Agora".
5. O sistema emite a NFS-e, gera o PDF oficial e abre o link direto do WhatsApp com mensagem pronta: *"Olá, segue o espelho da sua Nota Fiscal Nº 2026102 e a chave PIX para pagamento."*

#### Workflow 3: Captura de Recibo de Compra no Caixa e Conciliação Automática no BPO
1. O empresário compra materiais para o escritório e recebe o cupom em papel.
2. Abre a aba "Recibos & Scanner" no Super App e fotografa o cupom.
3. O OCR lê o valor (R$ 84,50), data e CNPJ do fornecedor.
4. O backend cruza o valor com a saída pendente no extrato bancário (OFX) e marca a duplicata como conciliada.
5. O DRE e o fluxo de caixa no Painel do Sucesso são atualizados em tempo real.

---

## 6. Arquitetura Proposta para Automação dos Testes E2E

Para garantir que os testes rodem de forma 100% autônoma e repetível na esteira de CI/CD ou localmente, a seguinte estrutura de testes é recomendada:

### 6.1 Estrutura de Diretórios de Teste Proposta
```
app_xml_antigravity/
├── test/
│   ├── e2e/
│   │   ├── tier1_feature_coverage.spec.ts   # Casos T1.01 a T1.09
│   │   ├── tier2_boundary_corner.spec.ts    # Casos T2.01 a T2.08
│   │   ├── tier3_pairwise_matrix.spec.ts    # Casos T3.01 a T3.06
│   │   └── tier4_realworld_workflow.spec.ts # Casos T4.01 a T4.03
│   ├── fixtures/
│   │   ├── sample_nfe.xml
│   │   ├── sample_receipt.jpg
│   │   └── sample_extrato.ofx
│   ├── mocks/
│   │   ├── mockSefazServer.ts
│   │   └── mockPrefeituraApi.ts
│   └── testRunner.ts
```

### 6.2 Comandos de Execução Automatizada
Adicionar ao `package.json` raiz:
```json
"scripts": {
  "test": "tsx test/testRunner.ts",
  "test:tier1": "tsx test/e2e/tier1_feature_coverage.spec.ts",
  "test:tier2": "tsx test/e2e/tier2_boundary_corner.spec.ts",
  "test:tier3": "tsx test/e2e/tier3_pairwise_matrix.spec.ts",
  "test:tier4": "tsx test/e2e/tier4_realworld_workflow.spec.ts",
  "test:all": "tsx test/testRunner.ts --all"
}
```

---

## 7. Checklist de Verificação de Integridade e Build

- [x] **Configurações do Vite Client**: Alias `@/*`, chunks de produção, headers de segurança e proxy `/api` verificados.
- [x] **Configurações do Node Server**: Suporte ESM/NodeNext, engine SQLite nativo (`node:sqlite`), middleware de segurança e autenticação JWT validados.
- [x] **Contratos de API**: Mapeamento completo de 40+ endpoints REST com formatos de request, response e códigos HTTP.
- [x] **Estratégia Tiers 1-4**: Especificação formal de testes de cobertura de recursos, testes de borda, matriz combinatória e jornadas reais de usuário.
- [x] **Sem intervenção manual**: Todos os fluxos projetados para execução e validação via automação de scripts.
