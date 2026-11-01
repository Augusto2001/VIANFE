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
