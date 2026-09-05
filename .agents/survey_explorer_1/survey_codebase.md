# RELATÓRIO DE RECONHECIMENTO COMPLETO DO CODEBASE (SURVEY EXPLORER 1)
## Super App Viacont (Área do Cliente) • Plataforma ViaNfe ERP & BPO Fiscal

---

### 1. Resumo Executivo
Este relatório apresenta o mapeamento detalhado da estrutura do repositório, dependências, configurações de build (TypeScript, Vite, Tailwind), arquitetura do frontend e backend, esquemas de banco de dados SQLite, rotas de API, e o diagnóstico comparativo entre o estado atual do código e os requisitos **R1 a R5** do **Super App Viacont (Área do Cliente)** definidos em `ORIGINAL_REQUEST.md`.

---

### 2. Estrutura do Workspace & Raiz do Projeto

#### 2.1. Estrutura de Diretórios
```
c:\Users\USER\Documents\app_xml_antigravity\
├── .agents/                               # Metadados e relatórios dos agentes
│   ├── orchestrator/
│   ├── sentinel/
│   ├── survey_explorer_1/ (este agente)
│   └── survey_explorer_2/
├── client/                                # Frontend React 18 + Vite + Tailwind
│   ├── public/                            # Assets públicos (logo.jpg, vianfe_logo.jpg)
│   ├── src/
│   │   ├── components/                    # Componentes e views do sistema
│   │   ├── services/                      # Camada de comunicação API (api.ts)
│   │   ├── types/                         # Interfaces TypeScript (index.ts)
│   │   ├── App.tsx                        # Componente raiz da aplicação
│   │   ├── main.tsx                       # Ponto de entrada React + ErrorBoundary
│   │   └── index.css                      # Estilos globais Tailwind + temas
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
├── server/                                # Backend Node.js + Express + TypeScript + SQLite
│   ├── src/
│   │   ├── controllers/                   # Controladores REST API
│   │   ├── database/                      # Conexão SQLite (db.ts) e migrações
│   │   ├── jobs/                          # Cron jobs e agendador (scheduler.ts)
│   │   ├── middleware/                    # Autenticação JWT e Multi-Tenant
│   │   ├── routes/                        # Definição de endpoints (routes/api.ts)
│   │   ├── services/                      # Motores de negócio (SEFAZ, NFS-e, DANFE, OCR, BPO)
│   │   │   ├── nfse/                      # Adaptadores municipais de NFS-e
│   │   │   └── ...
│   │   ├── utils/                         # Criptografia, carregadores de certificado PFX
│   │   └── index.ts                       # Entrada do servidor Express
│   ├── storage/                           # Armazenamento local persistente (DB, certs, xmls, pdfs)
│   ├── package.json
│   └── tsconfig.json
├── docs/                                  # Manuais e especificações de BPO e contabilidade
├── scratch/                               # Arquivos temporários e backups
├── ORIGINAL_REQUEST.md                    # Especificação do usuário dos requisitos R1-R5
├── package.json                           # Root package.json (orquestração de scripts)
├── Dockerfile                             # Container Docker de produção
├── docker-compose.yml                     # Orquestração de containers
├── deploy_oracle_cloud.sh                 # Script de implantação Oracle Cloud
└── README.md                              # Documentação geral do projeto
```

#### 2.2. Root `package.json` & Scripts
- **Gerenciador**: npm / Node.js
- **Scripts**:
  - `dev`: `concurrently "npm.cmd run dev:server" "npm.cmd run dev:client"`
  - `dev:server`: `npm.cmd run --prefix server dev`
  - `dev:client`: `npm.cmd run --prefix client dev`
  - `build`: `npm.cmd run --prefix server build && npm.cmd run --prefix client build`
  - `start`: `npm.cmd run --prefix server start`
- **DevDependencies na raiz**: `concurrently` (^9.1.2)

---

### 3. Stack Tecnológico & Dependências

#### 3.1. Frontend (`client/package.json`)
- **Framework Core**: React `^18.3.1` + React-DOM `^18.3.1`
- **Build Tool / Bundler**: Vite `^6.1.0` (`@vitejs/plugin-react` `^4.3.4`)
- **Linguagem**: TypeScript `^5.7.3`
- **Estilização**: Tailwind CSS `^3.4.17` + PostCSS `^8.5.2` + Autoprefixer `^10.4.20`
- **Utilitários de UI & Estilo**: `clsx` (^2.1.1), `tailwind-merge` (^3.0.1)
- **Ícones**: `lucide-react` (`^0.475.0`)
- **Manipulação de Datas**: `date-fns` (`^4.1.0`)
- **Exportação / Download de Arquivos**: `file-saver` (`^2.0.5`), `jszip` (`^3.10.1`)
- **Efeitos de Gamificação**: `canvas-confetti` (`^1.9.4`)

#### 3.2. Backend (`server/package.json`)
- **Runtime**: Node.js v22+
- **Framework Web**: Express `^4.21.2`
- **Banco de Dados**: `node:sqlite` nativo (`DatabaseSync`) em modo WAL
- **Transpilação / Execução**: `tsx` (`^4.19.3`) para desenvolvimento, `tsc` (`^5.7.3`) para compilação
- **Criptografia & Autenticação**: `jsonwebtoken` (`^9.0.3`), `bcryptjs` (`^3.0.3`), `node-forge` (`^1.4.0`)
- **Geração & Manipulação de Documentos**:
  - `pdfkit` (`^0.16.0`) para geração de DANFE e DANFSe
  - `fast-xml-parser` (`^4.5.3`) para parser bidirecional de XMLs fiscais NF-e/NFS-e
  - `archiver` (`^7.0.1`) para empacotamento de ZIPs em lote
- **Upload de Arquivos**: `multer` (`^1.4.5-lts.1`)
- **Agendamento em Background**: `node-cron` (`^3.0.3`)
- **Integrações de Nuvem & OCR**:
  - `googleapis` (`^144.0.0`) para sincronização com Google Drive
  - `tesseract.js` (`^7.0.0`) para OCR de recibos e capturas de imagem
  - `puppeteer-core` (`^25.8.0`) para automação de prefeituras
  - `uuid` (`^11.1.0`) para identificadores únicos universais

---

### 4. Configurações de Compilação & Tooling

#### 4.1. Configuração Vite (`client/vite.config.ts`)
- **Alias de Caminho**: `@` mapeado para `./src`
- **Proxy de Desenvolvimento**: `/api` redirecionado para `http://127.0.0.1:3001`
- **Otimização de Build**:
  - `sourcemap: false` (Zero SourceMaps em produção)
  - `minify: 'esbuild'`, `cssMinify: true`, `target: 'es2020'`
  - `manualChunks`: `vendor: ['react', 'react-dom']`, `icons: ['lucide-react']`
- **Cabeçalhos de Segurança Embutidos**:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

#### 4.2. Configuração TypeScript (`tsconfig.json`)
- **Client**: `target: ES2020`, `module: ESNext`, `jsx: react-jsx`, `strict: true`, `moduleResolution: bundler`.
- **Server**: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `outDir: ./dist`, `rootDir: ./src`, `strict: true`.

---

### 5. Arquitetura do Frontend (Client)

#### 5.1. Ponto de Entrada & Estado Global
- **`main.tsx`**: Inicializa o React 18 no elemento `#root`, envolvido por uma classe `ErrorBoundary` para captura graciosa de exceções em tempo de execução com opção de reiniciar sessão limpa.
- **`App.tsx`**: Gerencia o estado central da aplicação:
  - `companies`: Lista de empresas clientes autorizadas.
  - `selectedCompany`: Empresa ativa selecionada no contexto do usuário (persistida em `localStorage` via chave `df_hub_selected_company`).
  - `activeTab`: Aba atualmente exibida (`dashboard`, `bpo`, `business_success`, `tax_audit`, `client_portal`, `companies`, `drive`, `import`, `analytics`, `nfse`).
  - `currentUser`: Usuário logado (`vianfe_user` e `vianfe_jwt_token`).
  - `isSyncing`: Indicador de processamento em segundo plano da SEFAZ.
- **`Header.tsx`**: Cabeçalho fixo com seletor pesquisável de empresas em tempo real, botão de sincronização SEFAZ instantânea, alternador de tema Claro/Escuro (persistido via `vianfe_theme`), botão de usuários, tenants e logout.
- **`Sidebar.tsx`**: Barra lateral retrátil (desktop fixa / mobile gaveta slide-in) dividida em 3 macro-categorias:
  - *Fiscal*: Notas & SEFAZ, NFS-e & Serviços, Importador XMLs, Auditoria Tributária.
  - *Financeiro*: BPO & Conciliação.
  - *Gestão*: Empresas Clientes, Painel do Sucesso, Área do Cliente (Mobile PWA), Drive & Logs.

#### 5.2. Inventário de Componentes Existentes
| Componente | Função |
| :--- | :--- |
| `Dashboard.tsx` | Visualização de notas fiscais NF-e modelo 55/65 com filtros de período, busca de emitente/destinatário, download de XML/PDF e ZIP em lote |
| `ClientPortalView.tsx` | Área do cliente existente focada em manifestação de notas SEFAZ e formulário rápido de despesas/saídas |
| `NfseView.tsx` | Gestão de notas fiscais de serviços para prefeituras (Salvador, Feira de Santana, Lauro de Freitas, S. Gonçalo, Curitiba, ADN) e tomadores recorrentes |
| `BankReconciliationView.tsx` | BPO financeiro com upload de extrato OFX e conciliação lado a lado |
| `BusinessSuccessDashboard.tsx` | Painel contábil executivo com DRE gerencial, +30 KPIs, radar de risco fiscal e top fornecedores/clientes |
| `TaxAuditView.tsx` | Auditoria tributária de créditos PIS/COFINS monofásicos e conformidade NCM/CFOP |
| `XmlImporterView.tsx` | Importação em lote de arquivos XML ou arquivos ZIP de notas fiscais |
| `CompaniesView.tsx` | Cadastro de empresas, upload de certificado digital A1 (.pfx) com validação OpenSSL/node-forge |
| `DriveSchedulerView.tsx` | Configuração de pastas do Google Drive e agendamento de backups |
| `SupportWidget.tsx` | Widget flutuante de abertura de chamados e suporte via WhatsApp |
| `UsersModal.tsx` & `TenantsManagementModal.tsx` | Gestão de multi-tenancy e permissões de usuários (Admin Contábil vs Cliente) |

---

### 6. Arquitetura do Backend (Server)

#### 6.1. Servidor Express & Middleware (`index.ts`)
- Configurado na porta 3001 (ou `process.env.PORT`).
- Servidor estático integrado: serve `/storage` e a pasta `client/dist` compilada com fallback SPA para `index.html`.
- Middleware `verifyJwtAndTenant`: extrai o token Bearer, valida a assinatura JWT e injeta `req.user` e `req.tenant_id`.

#### 6.2. Esquema do Banco de Dados SQLite (`database/db.ts`)
O banco de dados SQLite local (`storage/data/fiscal_hub.db`) utiliza `node:sqlite` com modo WAL e contém as seguintes tabelas principais:
1. `tenants`: Escritórios contábeis cadastrados na plataforma SaaS.
2. `users`: Usuários e operadores (roles: `admin` para contabilidade, `client` para clientes).
3. `companies`: Cadastro de empresas clientes (CNPJ, razão social, IE, UF, credenciais SEFAZ, certificado PFX, configurações NFS-e).
4. `invoices`: Notas fiscais eletrônicas capturadas (NF-e modelo 55/65) com chaves de acesso, itens, duplicatas e status de sync com Google Drive.
5. `invoice_installments`: Parcelas e duplicatas de compras/vendas (Contas a Pagar e a Receber).
6. `bank_accounts`: Contas bancárias da empresa (Itaú, Bradesco, BB, Inter, Nubank, Sicoob, etc.).
7. `bank_transactions`: Transações do extrato bancário importadas via OFX/PDF com vínculos de conciliação.
8. `financial_categories`: Categorias financeiras e vínculo com o Plano de Contas da Domínio Sistemas.
9. `dominio_chart_of_accounts`: Plano de contas importado da contabilidade Domínio.
10. `accounting_provisions`: Provisões contábeis automáticas de folha de pagamento (salários, FGTS, INSS) e impostos (DAS, ICMS, ISS).
11. `financial_attachments`: Anexos e comprovantes arrastados ou enviados por celular.
12. `nfse_issued`: Histórico de NFS-e emitidas para prefeituras e Portal Nacional ADN.
13. `nfse_recurring_clients`: Cadastro de tomadores de serviços frequentes.
14. `nfe_manifestations`: Registro de manifestações do destinatário enviadas para a SEFAZ.
15. `support_tickets`: Chamados de suporte técnico integrados ao WhatsApp.
16. `system_settings`: Configurações globais (chaves 2Captcha, webhooks, credenciais).
17. `sefaz_audit_logs`: Auditoria de requisições e carência da SEFAZ Nacional.

---

### 7. Diagnóstico e Mapeamento dos Requisitos R1 a R5

| Requisito | Título | Estado Atual no Código | Gaps e O que Precisa ser Implementado |
| :--- | :--- | :--- | :--- |
| **R1** | **Área do Cliente Híbrida (Mobile PWA & Desktop Expandido)** | Existe uma versão inicial de `ClientPortalView.tsx` com 2 sub-abas (Manifestação SEFAZ e Lançamento de Caixa) e visual desktop padrão | **Falta implementar**: A casca completa de Super App com suporte híbrido responsivo avançado: barra de navegação inferior estilo nativo mobile (Bottom Navigation Dock com touch targets $\ge 44$px), alternância fluida entre as 4 abas mestres (`Início/Finanças`, `Emitir Notas`, `Guias/Impostos`, `Recibos`), drawer retrátil e PWA `manifest.json`. |
| **R2** | **Emissor Relâmpago de Notas Fiscais Integrado (NFS-e & NF-e)** | Existe `NfseView.tsx` com formulário modal tradicional para prefeituras e cadastro de tomadores | **Falta implementar**: Formulário guiado em **3 passos otimizado para celular e desktop**: (Passo 1: Autopreenchimento instantâneo por CNPJ/CPF com consulta à Receita Federal e catálogo de clientes favoritos; Passo 2: Seleção de Produto/Serviço a partir do catálogo de favoritos em 1 toque; Passo 3: Emissão instantânea com espelho visual da nota, geração de PDF, cálculo de PIX Copia-e-Cola e botão de envio direto no WhatsApp com mensagem formatada). |
| **R3** | **Central de Guias & Impostos com 1-Clique PIX** | As tabelas `financial_categories` e `accounting_provisions` possuem códigos de impostos, mas não há tela dedicada para o cliente visualizar guias fiscais e copiar PIX | **Falta implementar**: Tabela de banco de dados `tax_guides`, endpoints de backend (`/api/portal/tax-guides`), visualização categorizada de guias (DAS Simples Nacional, ICMS, Guias de Folha: FGTS/INSS), semáforo de vencimento, botão de 1-toque "Copiar Código PIX" (com feedback háptico/toast) e download do PDF da guia. |
| **R4** | **Captura & Scanner OCR de Recibos e Comprovantes** | Existe `tesseract.js` instalado no backend e campo de input de câmera básico em `ClientPortalView.tsx`, mas sem motor OCR e auto-match integrado | **Falta implementar**: Tabela `receipt_scans`, endpoint de backend `/api/portal/receipts/scan` que processa a imagem com OCR e extrai CNPJ, data, valor e itens, motor de **auto-match** ponderado com as parcelas a pagar (`invoice_installments`) e transações bancárias (`bank_transactions`), e interface no client com visualização de foto, edição de campos detectados e confirmação de baixa em 1 clique. |
| **R5** | **Painel Financeiro & Diagnóstico em Tempo Real** | O backend possui `bpoController.getBusinessSuccessKpis` e `BusinessSuccessDashboard.tsx`, focados na visão gerencial da contabilidade | **Falta implementar**: Painel do cliente simplificado e direto na **Aba Início**: Fluxo de caixa do dia (saldo disponível, a pagar hoje, a receber hoje, saldo projetado), previsão para 7/15/30 dias, e **Termômetro do Simples Nacional** calculando o RBT12 acumulado dos últimos 12 meses frente ao sublimite estadual (R$ 3.6M) e teto geral (R$ 4.8M) com alíquota efetiva estimada e margem de segurança. |

---

### 8. Plano de Verificação & Critérios de Aceite

Para garantir a total conformidade com o `ORIGINAL_REQUEST.md`, o desenvolvimento deve validar:
1. **Experiência de Usuário & Responsividade**:
   - Funcionamento responsivo sem quebras em telas móveis (320px a 768px) e expansão rica em telas desktop ($\ge 1024px$).
   - Navegação SPA instantânea entre as 4 abas mestres sem nenhum recarregamento de página.
2. **Emissão Guiada em 3 Passos**:
   - Busca de CNPJ com autopreenchimento funcional.
   - Catálogo de favoritos de produtos e serviços.
   - Espelho da nota gerado com opção de compartilhamento no WhatsApp e código PIX Copia-e-Cola EMV válido.
3. **Central de Guias & PIX**:
   - Listagem com valor, competência, status e botão funcional de cópia de PIX.
4. **Scanner OCR & Auto-match**:
   - Processamento de recibo com extração de dados e sugestão de conciliação.
5. **Integridade de Build**:
   - Compilação estrita do cliente (`npm run build --prefix client`) sem erros de TypeScript ou Vite.
   - Compilação estrita do servidor (`npm run build --prefix server`) sem erros de TypeScript (`tsc`).

---

### 9. Conclusão do Reconhecimento
O repositório possui uma base sólida e limpa, com todas as bibliotecas necessárias instaladas (`react`, `vite`, `tailwindcss`, `lucide-react`, `express`, `node:sqlite`, `pdfkit`, `tesseract.js`, `fast-xml-parser`).

A arquitetura atual permite a implementação fluida e modular dos requisitos R1-R5 através de novos componentes especializados no cliente (ou aprimoramento do `ClientPortalView.tsx`) e a inclusão das rotas de apoio no backend (`api.ts`, `bpoController.ts`, novos controladores e tabelas auxiliares), mantendo 100% de compatibilidade e estabilidade.
