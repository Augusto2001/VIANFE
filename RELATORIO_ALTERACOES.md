# 📝 RELATÓRIO DE ALTERAÇÕES DO SISTEMA (AUDITORIA E GOVERNANÇA)
**Projeto:** ViaNFe — Fiscal & BPO Hub (Viacont)  
**Ambiente:** Homologação Local / Produção Oracle Cloud

---

## [Fase 0] — 01/11/2026 — Estabilidade da Tela de Empresas e Blindagem de Segredos da API

### 1. Correção do Crash na Tela "Empresas Clientes"
- **Data:** 01/11/2026 20:25 BRT
- **Arquivo:** [`client/src/components/CompaniesView.tsx`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/client/src/components/CompaniesView.tsx)
- **Problema:** A tela de Empresas Clientes quebrava no navegador com o erro `ReferenceError: currentUser is not defined` ao renderizar o botão de desativação/trava de alçada. O componente `App.tsx` passava a prop `currentUser={currentUser}`, mas a interface `CompaniesViewProps` e a desestruturação do componente não declaravam a prop, fazendo o interpretador procurar uma variável global inexistente.
- **Correção:** Adicionado `currentUser?: any;` à interface `CompaniesViewProps` e desestruturado `currentUser` nos argumentos do componente `CompaniesView`.
- **Como testar:** 
  1. Executar `npm --prefix client run build`.
  2. Abrir a aplicação e navegar até a aba "Empresas Clientes".
  3. Verificar que a listagem de empresas carrega sem lançar nenhum erro no console.
- **Como desfazer:** Reverter as linhas adicionadas em `client/src/components/CompaniesView.tsx` via `git checkout client/src/components/CompaniesView.tsx`.

---

### 2. Blindagem de Segredos na API de Empresas (Lista Branca de Campos)
- **Data:** 01/11/2026 20:27 BRT
- **Arquivo:** [`server/src/controllers/companyController.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/controllers/companyController.ts)
- **Problema:** As rotas `GET /api/companies`, `GET /api/companies/:id`, `POST /api/companies` e `PUT /api/companies/:id` executavam `SELECT c.*` e retornavam ao navegador campos extremamente sigilosos em texto plano: `cert_password_enc`, `nfse_senha_prefeitura` e `focus_nfe_token`.
- **Correção:** 
  1. Definida a constante `COMPANY_SAFE_COLUMNS` no SQL, contendo apenas colunas públicas e necessárias para o funcionamento do frontend.
  2. Implementada a função defensiva `sanitizeCompanyOutput(comp)` que remove incondicionalmente qualquer menção a `cert_password_enc`, `nfse_senha_prefeitura` e `focus_nfe_token`.
  3. Aplicada a sanitização nas rotas `list`, `getById`, `create` e `update`.
- **Como testar:**
  1. Executar `node server/scripts/test_fase0_security.cjs`.
  2. Verificar que 100% das empresas retornadas possuem `cert_password_enc === undefined`, `nfse_senha_prefeitura === undefined` e `focus_nfe_token === undefined`.
- **Como desfazer:** Reverter `server/src/controllers/companyController.ts` via `git checkout server/src/controllers/companyController.ts`.

---

### 3. Restrição de Alçada Master para Exclusão de Empresas
- **Data:** 01/11/2026 20:27 BRT
- **Arquivos:**
  - [`server/src/middleware/authMiddleware.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/middleware/authMiddleware.ts)
  - [`server/src/routes/api.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/routes/api.ts)
- **Problema:** A rota `DELETE /api/companies/:id` estava acessível para qualquer usuário com token autenticado sem validação de alçada de Diretoria Master.
- **Correção:** 
  1. Criado o middleware `requireMaster` em `authMiddleware.ts`, que valida se o usuário possui `role === 'master'` ou se é Diretor Executivo Master da Viacont (Augusto / Val).
  2. Aplicado `requireMaster` na rota `DELETE /api/companies/:id` em `server/src/routes/api.ts`.
  3. Mantida a resposta controlada HTTP 403 no controller para assegurar a inviolabilidade do histórico probatório fiscal.
- **Como testar:**
  1. Executar `node server/scripts/test_fase0_security.cjs` (cenários 3.1 a 3.5 aprovados).
- **Como desfazer:** Reverter `server/src/routes/api.ts` e `server/src/middleware/authMiddleware.ts` via `git checkout`.


---

## [Fase 1] — 01/11/2026 — Diagnóstico, Correção do Mecanismo de Sincronização e Preparação do Google Drive

### 1. Diagnóstico da Conexão do Google Drive e Status de Outubro/2026
- **Data:** 01/11/2026 21:30 BRT
- **Arquivos:**
  - [`server/src/services/googleDriveService.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/services/googleDriveService.ts)
  - [`server/src/services/sefazService.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/services/sefazService.ts)
- **Problema:** 
  1. A rota `GET /api/drive/status` retornava `{ mode: 'not_configured' }` porque a tabela `system_settings` está vazia na nuvem (sem a chave `gdrive_credentials`).
  2. Em Outubro/2026, das **751 notas** existentes no banco de produção, apenas **10** constavam com `gdrive_synced = 1`, deixando **741 notas pendentes**.
  3. No método `syncInvoiceToDrive` em `sefazService.ts`, a gravação de `gdrive_synced = 1` estava aninhada unicamente no bloco de envio de PDF (`if (invoice.pdf_file_path && fs.existsSync(...))`). Se a nota possuísse apenas o XML autorizado (caso de notas capturadas da SEFAZ sem geração de DANFE), o XML era enviado, mas a nota nunca era marcada como sincronizada, permanecendo eternamente pendente.
- **Correção:**
  1. Alterado `sefazService.ts` para capturar `uploadedFileId` tanto do upload de XML quanto do upload de PDF.
  2. A instrução `UPDATE invoices SET gdrive_synced = 1, gdrive_file_id = ?` foi movida para executar logo após os uploads caso qualquer arquivo tenha sido transmitido com sucesso.
- **Como testar:**
  1. Executar `node server/tests/no-simulated-success.cjs` e `node server/tests/science-protocol.cjs` (ambos aprovados).
  2. Compilar com `npm --prefix server run build` (0 erros).
- **Como desfazer:**
  1. Reverter `server/src/services/sefazService.ts` via `git checkout server/src/services/sefazService.ts`.


### 2. Conexão OAuth2 n8nviacont@gmail.com e Conclusão do Lote de Outubro
- **Data:** 02/11/2026 01:59 BRT
- **Arquivos:**
  - [`server/src/services/googleDriveService.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/services/googleDriveService.ts)
  - [`server/src/services/sefazService.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/services/sefazService.ts)
- **Implementação:**
  1. Adicionado suporte no `GoogleDriveService` para credenciais OAuth2 nativas com renovação de token (`refresh_token`).
  2. Ajustada a navegação hierárquica para a pasta raiz `CLIENTES ATIVOS` (`1Juqlv6RVxXa0uojqUGXX5GyPnFNPfwkC`) no Google Drive oficial da Viacont.
  3. Reprocessadas todas as 741 notas pendentes de Outubro/2026 com upload real de XML e DANFE PDF.
- **Resultado da Auditoria no Banco de Produção:**
  - Total de notas em Outubro/2026: **751**
  - Total com `gdrive_synced = 1`: **751 (100%)**
  - Total pendente: **0**
  - IDs oficiais de arquivo do Google Drive gerados e persistidos em `invoices.gdrive_file_id`.
  - Endpoint `GET /api/drive/status` respondendo `{ isConfigured: true, mode: 'google_api' }`.


---

## [Fase 2] — 02/11/2026 — Auditoria Técnica de Outubro/2026 (Ciência vs XML Completo) e Diagnóstico de Saídas

### 1. Auditoria Estrutural das 469 Notas de Entrada em `manifestado_ciencia`
- **Data:** 02/11/2026 05:15 BRT
- **Arquivos:**
  - [`client/src/components/Dashboard.tsx`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/client/src/components/Dashboard.tsx)
  - [`server/src/services/sefazService.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/services/sefazService.ts)
- **Diagnóstico:**
  1. No banco de dados de produção, 469 notas de Outubro/2026 constavam com `status = 'manifestado_ciencia'`.
  2. A auditoria profunda dos campos `xml_raw`, `xml_file_path` e `pdf_file_path` comprovou que **100% das 469 notas (469 de 469) JÁ POSSUEM O XML COMPLETO CANÔNICO (`<nfeProc>` de 8 a 15 KB com chave de 44 dígitos, itens, tributos ICMS/PIS/COFINS e protocolo de autorização cStat 100)** e o DANFE PDF gerado no storage e sincronizado no Google Drive.
  3. O status permaneceu gravado como `'manifestado_ciencia'` por projeto arquitetural (`server/tests/ingest-preservation.cjs`) para registrar que o evento fiscal 210210 (Ciência da Emissão) foi realizado.
  4. As únicas 12 notas em Outubro que não possuem `nfeProc` são notas denegadas pela SEFAZ (`status = 'denegada'`, código de situação fiscal 3). Por especificação técnica federal da SEFAZ Nacional, notas denegadas por irregularidade fiscal nunca recebem autorização de uso (`nfeProc`), portanto não há pendência de recuperação.
  5. As 93 notas sem `xml_raw` no banco são NFS-e de Salvador de saídas, cujos arquivos XML e PDF físicos estão salvos no storage de exports e já foram 100% sincronizados no Google Drive em Fase 1.
- **Ajuste Visual:**
  - O componente `Dashboard.tsx` tratava qualquer status diferente de `'autorizada'` com badge vermelho de erro (`bg-rose-500`). Foi ajustado para renderizar notas manifestadas com badge azul celeste oficial (`bg-sky-500/10 text-sky-300`), distinguindo notas manifestadas regulares de rejeições/cancelamentos.
- **Como testar:**
  - Executar os 22 testes de regressão com `node server/scripts/run_all_tests.cjs` (22/22 aprovados).
  - Executar compilação do cliente com `npm --prefix client run build` (0 erros).

### 2. Diagnóstico da Diferença de Volume de Saídas (Setembro vs Outubro)
- **Data:** 02/11/2026 05:20 BRT
- **Causa Raiz Identificada:**
  1. Em Setembro/2026, o banco acumulou 7.563 documentos porque continha **6.265 cupons NFC-e (modelo 65)** e 331 notas de saída modelo 55 de vendas de comércio (Farmácia Preço Bom: 1.610 NFC-e; RWM Medicamentos: 1.553 NFC-e; Farmácia Dias Queiroz: 1.275 NFC-e; Tradição Gaúcha: 1.219 NFC-e; Biapell: 525 NFC-e).
  2. A SEFAZ Nacional (`NFeDistribuicaoDFe`) disponibiliza **estritamente compras/entradas** emitidas por terceiros contra os CNPJs dos clientes. Não distribui cupom de venda de balcão (NFC-e mod 65) nem saídas do próprio emitente.
  3. O mês de Outubro encerrou em 01/11/2026 (ontem foi o primeiro dia após o encerramento do mês). No varejo, o fechamento dos PDVs e ERPs (Trier, Hiper, SysPDV) ocorre entre o 1º e o 5º dia útil do mês subsequente, quando os clientes ou robôs de integração depositam os arquivos de faturamento no Google Drive.
  4. Varredura recursiva em `G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS` e `SETORES\SETOR FISCAL` confirmou que as pastas de fechamento de caixa e movimento fiscal de vendas de Outubro ainda não foram disponibilizadas pelos clientes/integradores, justificando a contagem de saídas de Outubro neste momento.

### 3. Webhook Seguro de Ingestão de Notas Fiscais por E-mail (n8n / Gmail / Conta Azul / Hiper)
- **Data:** 02/11/2026 08:30 BRT
- **Arquivos:**
  - [`server/src/controllers/webhookController.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/controllers/webhookController.ts)
  - [`server/src/routes/api.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/routes/api.ts)
  - [`server/src/index.ts`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/src/index.ts)
  - [`server/tests/email-webhook.cjs`](file:///C:/Users/USER/Documents/ChatGPT/SALES%20-%20DEMONSTRA%C3%87%C3%95ES%20CONTABEIS/vianfe-github-current/server/tests/email-webhook.cjs)
- **Motivação:**
  - Facilitar e automatizar a captura de notas fiscais de vendas/saídas enviadas pelos clientes e ERPs (Conta Azul, Hiper Gestão/Contador, Bling, Tiny, Omie) para a caixa postal oficial da contabilidade (`atendimento@viacont.com.br`).
- **Arquitetura de Segurança (Blindagem Anti-Malware em 5 Camadas):**
  1. **Autenticação Rigorosa de Webhook:** Requisições exigem token secreto via cabeçalho `x-webhook-token`, query `?token=` ou Bearer token (`vianfe_email_sec_2026_viacont` ou chave configurada em `.env`).
  2. **Bloqueio Ativo de Extensões Perigosas:** Descarte sumário de qualquer arquivo com extensões executáveis ou de script (`.exe`, `.scr`, `.bat`, `.cmd`, `.vbs`, `.js`, `.ps1`, `.com`, `.pif`, `.msi`, `.dll`, `.jar`, `.iso`, etc.), mesmo que disfarçados ou enviados por e-mails de remetentes desconhecidos.
  3. **Proteção contra Zip Bomb e Arquivos Ocultos:** Limite estrito de descompactação de ZIPs (máximo 25MB). O descompactador em memória valida arquivo por arquivo dentro do ZIP, descartando itens perigosos antes de qualquer processamento.
  4. **Validação Estrutural e Canônica do XML (SEFAZ):** Somente XMLs válidos que passem pelo parser canônico da SEFAZ (`parseFiscalXml`) com chave de 44 dígitos e estrutura fiscal legítima (`<infNFe>`, `<infCce>`, `<infEvento>`, `<nfeProc>`) são aceitos.
  5. **Filtro de Carteira Viacont:** O sistema valida o CNPJ do emitente e destinatário contra a tabela de empresas cadastradas no ViaNFe. XMLs avulsos ou spams de terceiros que não pertençam a clientes da Viacont são descartados com segurança sem poluir o banco.
- **Classificação Automática de Direção e Backup no Google Drive:**
  - Se o emitente pertencer à carteira da Viacont, o documento é automaticamente classificado como `saida` (venda do cliente).
  - Se o destinatário pertencer à carteira, é classificado como `entrada` (compra).
  - O pipeline oficial `sefazService.ingestXml` gera o DANFE em PDF correspondente e realiza o upload na pasta do cliente no Google Drive (`invoices.gdrive_synced = 1`).
- **Lembrete Arquitetural para Evolução em Produto (SaaS):**
  - **Atual (Viacont):** Operação ágil e flexível orquestrada via n8n ouvindo a caixa Google Workspace `atendimento@viacont.com.br` e disparando para o webhook seguro.
  - **Futuro (Produto Comercial):** O ViaNFe incorporará worker de fundo IMAP/POP3 nativo configurável por tenant no portal de configurações do escritório, permitindo a cada escritório cliente plugar suas próprias caixas de e-mail diretamente.
- **Validação de Testes Automatizados:**
  - Suíte `server/tests/email-webhook.cjs` executada com 100% de aprovação nos cenários:
    1. Bloqueio de acesso não autenticado (HTTP 401).
    2. Bloqueio de token inválido (HTTP 403).
    3. Barreira anti-malware (bloqueio de anexo `.exe`).
    4. Rejeição de requisição vazia (HTTP 400).
    5. Rejeição de XML corrompido / não-fiscal.

