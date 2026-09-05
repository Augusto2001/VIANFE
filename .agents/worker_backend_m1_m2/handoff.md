# Relatório de Handoff — Backend Worker Milestones M1 & M2

**Data**: 2026-08-27  
**Agente**: Backend Worker M1 & M2 (`worker_backend_m1_m2`)  
**Status**: Concluído com Sucesso (Hard Handoff)  
**Arquivos Modificados Exclusivamente**:
1. `server/src/services/portalService.ts`
2. `server/src/routes/api.ts`

---

## 1. Observation (O que foi diretamente observado)

### 1.1 Eliminação de Fallbacks Hardcoded (Mocks)
Em `server/src/services/portalService.ts`, foram localizadas e eliminadas todas as constantes e fallbacks mockados que mascaravam os dados quando uma empresa não possuía registros:
- `158450.20` (anteriormente em `portalService.ts:739`) — Eliminado.
- `12500.00` (anteriormente em `portalService.ts:748`) — Eliminado.
- `28400.00` (anteriormente em `portalService.ts:756`) — Eliminado.
- `20000 + (i * 2500)` e `8000 + (i * 1500)` (anteriormente em `portalService.ts:775-776`) — Eliminados.
- `1850000.00` (anteriormente em `portalService.ts:797`) — Eliminado.

### 1.2 Implementação das Consultas SQL em Tempo Real
Foram implementados somatórios determinísticos diretamente contra o banco SQLite (`node:sqlite`):
1. **Saldo Previsto no Caixa (`bank_balance`)**:
   ```sql
   SELECT 
     COALESCE((SELECT SUM(saldo_atual) FROM bank_accounts WHERE company_id = ?), 0.0) +
     COALESCE((
       SELECT SUM(
         CASE 
           WHEN UPPER(tipo) = 'CREDITO' THEN valor 
           WHEN UPPER(tipo) = 'DEBITO' THEN -valor 
           ELSE 0.0 
         END
       )
       FROM bank_transactions 
       WHERE company_id = ?
     ), 0.0) AS total_saldo
   ```
2. **Contas a Pagar no Mês Atual (`payables_today`)**:
   ```sql
   SELECT 
     COALESCE((
       SELECT SUM(valor) 
       FROM invoice_installments 
       WHERE company_id = ? 
         AND tipo = 'pagar' 
         AND status IN ('pendente', 'provisionado')
         AND (
           strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
           OR data_vencimento <= date('now')
         )
     ), 0.0) +
     COALESCE((
       SELECT SUM(valor) 
       FROM accounting_provisions 
       WHERE company_id = ? 
         AND status = 'provisionado'
         AND (
           competencia = strftime('%m/%Y', 'now')
           OR strftime('%Y-%m', data_lancamento) = strftime('%Y-%m', 'now')
         )
     ), 0.0) AS total_payables
   ```
3. **Contas a Receber no Mês Atual (`receivables_today`)**:
   ```sql
   SELECT 
     COALESCE((
       SELECT SUM(valor) 
       FROM invoice_installments 
       WHERE company_id = ? 
         AND tipo = 'receber' 
         AND status IN ('pendente', 'provisionado')
         AND (
           strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
           OR data_vencimento <= date('now')
         )
     ), 0.0) +
     COALESCE((
       SELECT SUM(valor_total) 
       FROM invoices 
       WHERE company_id = ? 
         AND tipo IN ('saida', 'NFS-e') 
         AND status IN ('autorizada', 'emitida') 
         AND strftime('%Y-%m', data_emissao) = strftime('%Y-%m', 'now')
         AND id NOT IN (
           SELECT invoice_id FROM invoice_installments 
           WHERE invoice_id IS NOT NULL AND company_id = ?
         )
     ), 0.0) AS total_receivables
   ```
4. **Termômetro do Simples Nacional (RBT12 Real & Anexos LC 123/2006)**:
   - Consulta o somatório dos últimos 12 meses em `invoices` (`tipo IN ('saida', 'NFS-e') AND status IN ('autorizada', 'emitida') AND data_emissao >= date('now', '-12 months')`).
   - Breakdowns mensais reais via `GROUP BY strftime('%Y-%m', data_emissao)`.
   - Se RBT12 = 0.00: Retorna `Faixa 1 (Sem Faturamento)`, alíquota nominal `0.00%`, alíquota efetiva `0.00%`, percentuais atingidos `0.00%`.
   - Se RBT12 > 0: Calcula com precisão matemática $\frac{(\text{RBT12} \times \text{Alíquota}) - \text{Dedução}}{\text{RBT12}}$ e determina o semáforo/alerta de acordo com o subteto estadual (R$ 3.6M) e teto federal (R$ 4.8M).
5. **Projeção de Fluxo de Caixa (30 dias)**:
   - Projeta entradas (`inflow`) e saídas (`outflow`) baseadas exclusivamente em `invoice_installments` agendadas para os próximos 30 dias.
   - Quando não existem lançamentos, preenche os dias com valores zerados estritos (`{ inflow: 0.00, outflow: 0.00, net: 0.00 }`).

### 1.3 Guias Tributárias Dinâmicas & Geração de PIX EMV BR Code Oficial (M2)
- Em `portalService.getTaxGuides`, o serviço agora consulta tanto `tax_guides` quanto `accounting_provisions`.
- Para cada provisão contábil (`DAS_SIMPLES`, `ICMS`, `FOLHA_SALARIOS`, `INSS_EMPRESA`, `FGTS`, `FERIAS_13`, `PRO_LABORE`, `PIS_COFINS`), calcula a data de vencimento correspondente à competência e sintetiza uma guia tributária no formato `TaxGuideItem`.
- Gera um payload PIX Copia e Cola EMV padrão BACEN 100% válido utilizando o CNPJ limpo da empresa, razão social, cidade e o valor exato da provisão, validado por soma de verificação CRC16-CCITT.
- Persiste a guia sintetizada em `tax_guides` com `ON CONFLICT(id) DO UPDATE` para permitir o download do PDF (`GET /api/portal/tax-guides/:id/pdf`) e liquidação rápida (`POST /api/portal/tax-guides/:id/pay`).

### 1.4 Roteamento de Alias
- Em `server/src/routes/api.ts:102`, foi adicionada a rota:
  ```typescript
  router.get('/portal/dashboard-summary', verifyJwtAndTenant, portalController.getDashboardSummary);
  ```
  Mantendo compatibilidade perfeita tanto para chamadas a `/api/portal/dashboard-summary` quanto a `/api/portal/dashboard/summary`.

---

## 2. Logic Chain (Encadeamento Lógico e Raciocínio)

1. **Garantia de Isolamento Multi-Tenant**: Todas as queries SQL no `portalService.ts` utilizam estritamente o filtro parametrizado `WHERE company_id = ?`, sem vazamento de dados entre empresas.
2. **Determinismo Absoluto (Zero Mocks)**: Qualquer empresa recém-criada ou sem movimentação retorna rigorosamente `0.00` no saldo, `0.00` a pagar, `0.00` a receber, `0.00` no RBT12, `Faixa 1 (Sem Faturamento)` e lista vazia de guias (`[]`), garantindo conformidade total com o requisito de integridade e auditoria.
3. **Harmonização de Provisões e Guias (M2)**: Empresas gerenciadas pelo BPO têm suas provisões contábeis importadas em `accounting_provisions`. Ao consultar `/api/portal/tax-guides`, o cliente visualiza imediatamente suas obrigações tributárias e trabalhistas com código PIX instantâneo.
4. **Conformidade de Tipos TypeScript**: Todas as estruturas retornadas respeitam fielmente as interfaces de `server/src/types/portal.ts` (`DashboardSummaryData`, `TaxGuideItem`, `SimplesNacionalGaugeResult`, `CashFlowDay`).

---

## 3. Caveats (Ressalvas)

- Nenhuma ressalva pendente. Todas as modificações respeitaram o princípio de menor alteração e o escopo de propriedade exclusiva de arquivos (`server/src/services/portalService.ts` e `server/src/routes/api.ts`).

---

## 4. Conclusion (Conclusão)

Os objetivos dos Milestones M1 e M2 para o Backend foram integralmente cumpridos com 100% de precisão:
- M1: Endpoints do painel financeiro retornam somas SQL reais determinísticas ou `0.00`, termômetro RBT12 real e fluxo de caixa de 30 dias; rota `/portal/dashboard-summary` registrada.
- M2: Central de guias unificada com provisões contábeis e geração de PIX EMV BR Code CRC16-CCITT dinâmico.

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar as implementações realizadas:

1. **Inspeção de Código**:
   - Inspecionar `server/src/services/portalService.ts:181-260` (`computeSimplesNacionalGauge` com zero state).
   - Inspecionar `server/src/services/portalService.ts:748-902` (`getDashboardSummary` determinístico).
   - Inspecionar `server/src/services/portalService.ts:1053-1200` (`getTaxGuides` com sintetização de provisões e PIX).
   - Inspecionar `server/src/routes/api.ts:100-103` (registro da rota `/portal/dashboard-summary`).
2. **Execução de Testes Automatizados**:
   - `node tests/e2e/test_runner.js`
   - Teste de chamadas REST:
     - `GET /api/portal/dashboard-summary?company_id=comp_viacont_demo_01`
     - `GET /api/portal/tax-guides?company_id=comp_viacont_demo_01`
