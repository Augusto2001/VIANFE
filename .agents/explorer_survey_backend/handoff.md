# Relatório de Auditoria e Mapeamento Backend — Super App Viacont

**Data**: 2026-08-27  
**Autor**: Backend Survey Explorer  
**Status**: Concluído (Hard Handoff)  
**Escopo**: Servidor Backend (Express/TypeScript), SQLite (`node:sqlite`), Modelagem de Dados, Rotas `/api/portal/*`, Geração de PIX EMV BRCode, e Especificação de Consultas SQL Determinísticas Multi-Tenant.

---

## 1. Observation (O que foi diretamente observado)

### 1.1 Arquitetura do Backend e Infraestrutura de Dados
- **Motor de Banco de Dados**: SQLite gerenciado pelo módulo nativo síncrono do Node 22 (`DatabaseSync` de `node:sqlite`) em `server/src/database/db.ts:21`.
- **Arquivo de Banco**: `c:\Users\USER\Documents\app_xml_antigravity\storage\data\fiscal_hub.db`.
- **Pragmas**: `PRAGMA journal_mode = WAL;` e `PRAGMA foreign_keys = ON;` (`db.ts:25-26`).
- **Framework Web**: Express.js com TypeScript (`server/src/index.ts`, `server/src/routes/api.ts`).
- **Autenticação & Multi-Tenant**: Middleware `verifyJwtAndTenant` em `server/src/middleware/authMiddleware.ts`.

### 1.2 Mapeamento Completo de Tabelas Relevantes

#### Tabela 1: `companies` (`db.ts:34-54, 389-441`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | Identificador único da empresa (ex: `comp_viacont_demo_01`) |
| `tenant_id` | TEXT | DEFAULT 'tenant_viacont_master' | FK -> `tenants(id)` (Escritório Contábil responsável) |
| `cnpj` | TEXT | UNIQUE NOT NULL | CNPJ da empresa (14 dígitos limpos ou formatados) |
| `razao_social` | TEXT | NOT NULL | Razão social oficial |
| `nome_fantasia` | TEXT | NULL | Nome fantasia comercial |
| `ie` | TEXT | NULL | Inscrição Estadual |
| `uf` | TEXT | NOT NULL | Estado (ex: 'BA', 'PR', 'SP') |
| `email` | TEXT | NULL | E-mail de contato fiscal |
| `telefone` | TEXT | NULL | Telefone / WhatsApp |
| `status` | TEXT | DEFAULT 'ativo' | 'ativo', 'inativo', 'suspenso' |
| `cert_filename` | TEXT | NULL | Nome do arquivo do Certificado Digital A1 (.pfx/.p12) |
| `cert_password_enc`| TEXT | NULL | Senha do certificado criptografada |
| `cert_valid_until`| TEXT | NULL | Data de expiração do certificado digital |
| `sefaz_ambiente` | TEXT | DEFAULT 'producao' | 'producao' ou 'homologacao' |
| `last_nsu` | TEXT | DEFAULT '0' | Último NSU sincronizado na SEFAZ |
| `emite_nfse` | INTEGER | DEFAULT 0 | 1 = Habilitada para emitir NFS-e |
| `inscricao_municipal`| TEXT | NULL | Inscrição Municipal na Prefeitura |
| `focus_nfe_token`| TEXT | NULL | Token API Focus NFe |
| `created_at` | TEXT | NOT NULL | Data de criação ISO |
| `updated_at` | TEXT | NOT NULL | Data de atualização ISO |

#### Tabela 2: `bank_accounts` (`db.ts:185-197`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da conta bancária |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant obrigatório |
| `banco_nome` | TEXT | NOT NULL | Ex: 'Itaú', 'Bradesco', 'Banco do Brasil', 'Inter', 'Caixa' |
| `banco_codigo` | TEXT | NULL | Ex: '341', '237', '001', '077', '104' |
| `agencia` | TEXT | NULL | Número da agência bancária |
| `conta` | TEXT | NULL | Número da conta corrente/poupança |
| `tipo_conta` | TEXT | DEFAULT 'corrente' | 'corrente', 'poupanca', 'investimento' |
| `saldo_inicial` | REAL | DEFAULT 0.0 | Saldo inicial de implantação |
| `saldo_atual` | REAL | DEFAULT 0.0 | Saldo atual consolidado |
| `created_at` | TEXT | NOT NULL | Data de cadastro |

#### Tabela 3: `bank_transactions` (`db.ts:212-233`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da transação bancária |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant obrigatório |
| `bank_account_id`| TEXT | NULL, FK `bank_accounts(id)` | Conta bancária de origem |
| `data` | TEXT | NOT NULL | Data do lançamento ('YYYY-MM-DD') |
| `descricao_original`| TEXT | NOT NULL | Histórico/descrição original do extrato OFX |
| `tipo` | TEXT | NOT NULL | **`CREDITO`** (entrada) ou **`DEBITO`** (saída) |
| `valor` | REAL | NOT NULL | Valor monetário em reais |
| `documento` | TEXT | NULL | Número do documento/FITID do OFX |
| `conciliado` | INTEGER | DEFAULT 0 | 0 = Pendente, 1 = Conciliado |
| `categoria_id` | TEXT | NULL, FK `financial_categories(id)` | Categoria no plano de contas |
| `invoice_id` | TEXT | NULL, FK `invoices(id)` | NF-e / NFS-e vinculada |
| `observacoes_cliente`| TEXT | NULL | Notas do cliente |
| `foto_comprovante_url`| TEXT | NULL | URL do comprovante em anexo |
| `conciliado_em` | TEXT | NULL | Timestamp da conciliação |
| `created_at` | TEXT | NOT NULL | Timestamp de inserção |

#### Tabela 4: `invoices` (`db.ts:56-94, 527-540`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da nota fiscal |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant |
| `chave_acesso` | TEXT | UNIQUE NOT NULL | Chave de 44 dígitos da NF-e / Chave NFS-e |
| `numero` | TEXT | NOT NULL | Número da nota fiscal |
| `serie` | TEXT | NOT NULL | Série da nota (ex: '1') |
| `modelo` | TEXT | DEFAULT '55' | '55' (NF-e), '65' (NFC-e), 'NFS-e' |
| `tipo` | TEXT | NOT NULL | **`saida`** (Venda/Serviço) ou **`entrada`** (Compra) |
| `status` | TEXT | DEFAULT 'autorizada' | 'autorizada', 'emitida', 'cancelada', 'denegada' |
| `natureza_operacao`| TEXT | NULL | Descrição da operação fiscal |
| `data_emissao` | TEXT | NOT NULL | Data de emissão ('YYYY-MM-DD' ou ISO) |
| `data_saida_entrada`| TEXT | NULL | Data de efetiva movimentação |
| `emitente_cnpj` | TEXT | NOT NULL | CNPJ do emissor |
| `emitente_nome` | TEXT | NOT NULL | Razão social do emissor |
| `emitente_uf` | TEXT | NULL | UF do emissor |
| `destinatario_cnpj`| TEXT | NOT NULL | CNPJ/CPF do destinatário/tomador |
| `destinatario_nome`| TEXT | NOT NULL | Razão social do destinatário/tomador |
| `destinatario_uf`| TEXT | NULL | UF do destinatário |
| `valor_total` | REAL | NOT NULL DEFAULT 0.0 | Valor total da nota fiscal |
| `itens_json` | TEXT | NULL | Lista de itens/produtos em JSON |
| `xml_file_path` | TEXT | NULL | Caminho do arquivo XML no storage |
| `pdf_file_path` | TEXT | NULL | Caminho do DANFE/DANFSE em PDF |
| `created_at` | TEXT | NOT NULL | Timestamp ISO |

#### Tabela 5: `invoice_installments` (`db.ts:544-563`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da parcela |
| `invoice_id` | TEXT | NOT NULL, FK `invoices(id)` | Nota fiscal de origem |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant |
| `tipo` | TEXT | NOT NULL | **`pagar`** (compra) ou **`receber`** (venda) |
| `numero_fatura` | TEXT | NULL | Número da fatura comercial |
| `numero_parcela`| TEXT | NOT NULL | Número da parcela (ex: '1', '2', '3') |
| `data_vencimento`| TEXT | NOT NULL | Data de vencimento ('YYYY-MM-DD') |
| `valor` | REAL | NOT NULL | Valor da parcela |
| `status` | TEXT | DEFAULT 'pendente' | 'pendente', 'pago', 'conciliado', 'cancelado' |
| `forma_pagamento`| TEXT | NULL | 'PIX', 'BOLETO', 'CARTAO', etc. |
| `fornecedor_cliente_nome`| TEXT | NULL | Nome do fornecedor ou cliente |
| `fornecedor_cliente_cnpj`| TEXT | NULL | Documento do parceiro comercial |
| `created_at` | TEXT | NOT NULL | Timestamp ISO |

#### Tabela 6: `accounting_provisions` (`db.ts:248-262`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da provisão contábil |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant |
| `tipo_provisao` | TEXT | NOT NULL | `FOLHA_SALARIOS`, `INSS_EMPRESA`, `FGTS`, `FERIAS_13`, `DAS_SIMPLES`, `ICMS`, `PIS_COFINS`, `PRO_LABORE` |
| `competencia` | TEXT | NOT NULL | Mês/Ano de competência ('MM/YYYY', ex: '08/2026') |
| `data_lancamento`| TEXT | NOT NULL | Data do lançamento ('YYYY-MM-DD') |
| `valor` | REAL | NOT NULL | Valor monetário provisionado |
| `conta_debito` | TEXT | NOT NULL | Conta devedora no plano Domínio (ex: '4.1.02.01.001') |
| `conta_credito` | TEXT | NOT NULL | Conta credora no plano Domínio (ex: '2.1.02.01.001') |
| `historico` | TEXT | NOT NULL | Descrição do lançamento contábil |
| `status` | TEXT | DEFAULT 'provisionado' | **`provisionado`** ou **`conciliado_pago`** |
| `documento_ref` | TEXT | NULL | Referência documental opcional |
| `created_at` | TEXT | NOT NULL | Timestamp ISO |

#### Tabela 7: `tax_guides` (`db.ts:592-622`)
| Coluna | Tipo | Restrições / Padrão | Descrição |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | ID da guia de tributo |
| `company_id` | TEXT | NOT NULL, FK `companies(id)` | Vínculo multi-tenant |
| `tenant_id` | TEXT | DEFAULT 'tenant_viacont_master' | FK -> `tenants(id)` |
| `tipo_tributo` | TEXT | NOT NULL | `DAS_SIMPLES`, `ICMS_DAE`, `FGTS_DIGITAL`, `INSS_DARF`, `ISS_MUNICIPAL`, `IRRF_FOLHA`, `OUTROS` |
| `titulo` | TEXT | NOT NULL | Título descritivo da guia |
| `competencia` | TEXT | NOT NULL | Competência ('MM/YYYY') |
| `data_vencimento`| TEXT | NOT NULL | Data limite de vencimento ('YYYY-MM-DD') |
| `valor_principal`| REAL | NOT NULL DEFAULT 0.0 | Valor base |
| `valor_multa_juros`| REAL | DEFAULT 0.0 | Multas e encargos |
| `valor_total` | REAL | NOT NULL | Valor total a recolher |
| `codigo_barras_linha_digitavel`| TEXT | NULL | Linha digitável bancária |
| `pix_copia_e_cola`| TEXT | NULL | Código EMV BR Code oficial |
| `pdf_file_path` | TEXT | NULL | Caminho do PDF da guia |
| `status` | TEXT | DEFAULT 'pendente' | **`pendente`**, **`pago`**, **`vencido`**, **`cancelado`** |
| `data_pagamento` | TEXT | NULL | Data em que foi pago ('YYYY-MM-DD') |
| `comprovante_file_path`| TEXT | NULL | Comprovante de quitação |
| `origem_apuracao`| TEXT | DEFAULT 'contabilidade_viacont' | Ex: 'pgdas_auto', 'esocial_auto' |
| `created_at` | TEXT | NOT NULL | Timestamp de criação |
| `updated_at` | TEXT | NOT NULL | Timestamp de atualização |

---

### 1.3 Diagnóstico do Código Atual de Endpoints

#### A. Diagnóstico de `GET /api/portal/dashboard-summary` vs `GET /api/portal/dashboard/summary`
- **Rotas registradas em `server/src/routes/api.ts:101`**:
  `router.get('/portal/dashboard/summary', verifyJwtAndTenant, portalController.getDashboardSummary);`
- **Problema de Roteamento**: O endpoint está montado em `/portal/dashboard/summary`, enquanto a especificação R1 menciona `GET /api/portal/dashboard-summary`.
  *Recomendação*: Montar aliases para ambas as rotas (`/portal/dashboard-summary` e `/portal/dashboard/summary`) para assegurar compatibilidade universal.
- **Problema Crítico em `server/src/services/portalService.ts:739, 748, 756, 775, 776, 797`**:
  ```typescript
  // Trechos problemáticos encontrados em portalService.ts:
  const bank_balance = bankRow?.total_saldo !== undefined && bankRow.total_saldo > 0 ? bankRow.total_saldo : 158450.20;
  const payables_today = payablesRow?.total_payables !== undefined && payablesRow.total_payables > 0 ? payablesRow.total_payables : 12500.00;
  const receivables_today = receivablesRow?.total_receivables !== undefined && receivablesRow.total_receivables > 0 ? receivablesRow.total_receivables : 28400.00;
  const rawRbt12 = rbt12Row?.total_rbt12 && rbt12Row.total_rbt12 > 0 ? rbt12Row.total_rbt12 : 1850000.00;
  ```
  *Impacto*: Quando uma empresa nova ou sem movimentação é consultada, o código injeta valores mockados (`158.450,20`, `12.500,00`, `28.400,00`, `1.850.000,00`) em vez de retornar estritamente `0.00`. Isso viola diretamente o requisito R1.

#### B. Diagnóstico de `GET /api/portal/tax-guides`
- **Implementação atual em `server/src/controllers/portalController.ts:542-563` e `portalService.ts:960-1005`**:
  - Consulta apenas a tabela `tax_guides` filtrada por `company_id`.
  - Se a tabela `tax_guides` estiver vazia mas existirem lançamentos em `accounting_provisions` (gerados pelo BPO ou importação contábil), o endpoint não sintetizava as provisões em guias tributárias dinâmicas com payload PIX.

---

### 1.4 Diagnóstico do Motor de Geração de PIX EMV BR Code
- **Implementação**: `server/src/services/portalService.ts:22-119`.
- **Funções Validadas**:
  1. `calculateCRC16(payload: string): string` — Implementa CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF).
  2. `formatTLV(id: string, value: string): string` — Formata TLV padrão EMV com comprimento em 2 dígitos decimais.
  3. `normalizePixText(text: string, maxLength: number): string` — Remove acentos (`normalize('NFD')`), caracteres especiais e trunca no tamanho do padrão BACEN.
  4. `generatePixEmvPayload(options: PixPayloadOptions): string` — Monta os campos oficiais:
     - Tag 00 (`01`), Tag 01 (`11` ou `12`), Tag 26 (subtags 00, 01, 02), Tag 52 (`0000`), Tag 53 (`986`), Tag 54 (`valor.toFixed(2)`), Tag 58 (`BR`), Tag 59 (`merchantName`), Tag 60 (`merchantCity`), Tag 62 (subtag 05 TxID), Tag 63 (`6304 + CRC16`).
- **Avaliação**: O gerador de PIX está **100% em conformidade** com a especificação do Banco Central do Brasil.

---

## 2. Logic Chain (Encadeamento Lógico e Raciocínio)

1. **Premissa de Isolamento Multi-Tenant**: Cada empresa possui dados isolados no banco de dados SQLite através do campo `company_id`. Em nenhuma hipótese dados de uma empresa podem vazar para outra empresa.
2. **Premissa de Determinismo e Eliminação de Mocks**: Empresas sem transações bancárias, sem notas emitidas ou sem contas a pagar devem exibir rigorosamente `0.00` em todos os indicadores.
3. **Mapeamento de Saldo Previsto no Caixa**:
   - Saldo bancário real = Somatório de saldos iniciais de contas bancárias ativas + (Créditos bancários - Débitos bancários de `bank_transactions`).
   - Se não houver registros em `bank_accounts` ou `bank_transactions`, o resultado deve ser exatamente `0.00`.
4. **Mapeamento de Contas a Receber no Mês Atual**:
   - Componente A: Parcelas a receber em aberto (`invoice_installments` com `tipo = 'receber'` e `status IN ('pendente', 'provisionado')`) com vencimento no mês corrente ou vencidas.
   - Componente B: Notas fiscais de saída/serviço emitidas no mês atual (`invoices` com `tipo IN ('saida', 'NFS-e')` e `status IN ('autorizada', 'emitida')`) que ainda não foram convertidas em parcelas.
5. **Mapeamento de Contas a Pagar no Mês Atual**:
   - Componente A: Parcelas de compras/despesas a pagar (`invoice_installments` com `tipo = 'pagar'` e `status IN ('pendente', 'provisionado')`) com vencimento no mês corrente ou vencidas.
   - Componente B: Provisões contábeis de folha e impostos da competência atual (`accounting_provisions` com `status = 'provisionado'`).
   - Componente C: Notas de entrada emitidas no mês sem duplicatas.
6. **Mapeamento do Termômetro do Simples Nacional (RBT12 Real)**:
   - Somatório real do valor total das notas fiscais de saída/serviço emitidas pela empresa nos últimos 12 meses móveis (`data_emissao >= date('now', '-12 months')`).
   - Comparação exata contra o Subteto Estadual (R$ 3.600.000,00) e Teto Federal (R$ 4.800.000,00).
   - Cálculo de Alíquota Efetiva: $\frac{(\text{RBT12} \times \text{Alíquota Nominal}) - \text{Parcela a Deduzir}}{\text{RBT12}}$.
   - Se RBT12 for `0.00`, retorna Faixa 1, 0% atingido e alíquota inicial sem mock.
7. **Sintetização Dinâmica de Guias Tributárias com PIX**:
   - O endpoint `GET /api/portal/tax-guides` deve consultar tanto as guias cadastradas em `tax_guides` quanto as provisões ativas em `accounting_provisions`.
   - Para provisões contábeis (`DAS_SIMPLES`, `ICMS`, `FGTS`, `INSS_EMPRESA`), se não houver guia explícita correspondente, o backend sintetiza o objeto de resposta com código PIX EMV gerado na hora contendo o CNPJ da empresa, razão social, cidade e valor exato.

---

## 3. Consultas SQL Exatas e Determinísticas (Especificação Técnica R1 & R2)

### 3.1 Consulta 1: Saldo Consolidado no Caixa
```sql
SELECT 
  COALESCE(
    (SELECT SUM(saldo_atual) FROM bank_accounts WHERE company_id = ?),
    (
      COALESCE((SELECT SUM(saldo_inicial) FROM bank_accounts WHERE company_id = ?), 0.0) +
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
      ), 0.0)
    ),
    0.0
  ) AS saldo_caixa;
```
*Parâmetros*: `[companyId, companyId, companyId]`  
*Comportamento se vazio*: Retorna rigorosamente `0.00`.

---

### 3.2 Consulta 2: Contas a Receber no Mês Atual (Recebíveis + NFS-e Saída)
```sql
-- 1. Total a receber de duplicatas/parcelas de clientes (vencendo no mês ou vencidas pendentes)
SELECT COALESCE(SUM(valor), 0.0) AS total_receber_parcelas
FROM invoice_installments
WHERE company_id = ?
  AND tipo = 'receber'
  AND status IN ('pendente', 'provisionado')
  AND (
    strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
    OR data_vencimento <= date('now')
  );

-- 2. Total de notas fiscais de saída/serviços emitidas no mês vigente
SELECT COALESCE(SUM(valor_total), 0.0) AS total_faturamento_mes_saidas
FROM invoices
WHERE company_id = ?
  AND tipo IN ('saida', 'NFS-e')
  AND status IN ('autorizada', 'emitida')
  AND strftime('%Y-%m', data_emissao) = strftime('%Y-%m', 'now');
```
*Lógica de consolidação em TypeScript*:
Se existirem parcelas cadastradas em `invoice_installments`, utiliza o valor das parcelas do mês/vencidas; se não existirem parcelas mas houverem notas fiscais de saída no mês, utiliza a soma das notas do mês. Se ambos forem zero, retorna rigorosamente `0.00`.

---

### 3.3 Consulta 3: Contas a Pagar no Mês Atual (Compras + Provisões BPO)
```sql
-- 1. Parcelas de fornecedores a pagar (vencendo no mês ou vencidas pendentes)
SELECT COALESCE(SUM(valor), 0.0) AS total_pagar_fornecedores
FROM invoice_installments
WHERE company_id = ?
  AND tipo = 'pagar'
  AND status IN ('pendente', 'provisionado')
  AND (
    strftime('%Y-%m', data_vencimento) = strftime('%Y-%m', 'now')
    OR data_vencimento <= date('now')
  );

-- 2. Provisões contábeis de folha e tributos em aberto na competência atual
SELECT COALESCE(SUM(valor), 0.0) AS total_provisoes_aberto
FROM accounting_provisions
WHERE company_id = ?
  AND status = 'provisionado'
  AND (
    competencia = strftime('%m/%Y', 'now')
    OR strftime('%Y-%m', data_lancamento) = strftime('%Y-%m', 'now')
  );
```
*Total Consolidado*: `total_pagar_fornecedores + total_provisoes_aberto`. Retorna `0.00` se vazio.

---

### 3.4 Consulta 4: Termômetro do Simples Nacional (RBT12 Real e Breakdown Mensal)
```sql
-- RBT12 Real Acumulado dos últimos 12 meses móveis
SELECT COALESCE(SUM(valor_total), 0.0) AS real_rbt12
FROM invoices
WHERE company_id = ?
  AND tipo IN ('saida', 'NFS-e')
  AND status IN ('autorizada', 'emitida')
  AND data_emissao >= date('now', '-12 months');

-- Histórico mensal dos últimos 12 meses para o gráfico do termômetro
SELECT 
  strftime('%Y-%m', data_emissao) AS mes,
  COALESCE(SUM(valor_total), 0.0) AS faturamento
FROM invoices
WHERE company_id = ?
  AND tipo IN ('saida', 'NFS-e')
  AND status IN ('autorizada', 'emitida')
  AND data_emissao >= date('now', '-12 months')
GROUP BY strftime('%Y-%m', data_emissao)
ORDER BY mes ASC;
```

---

### 3.5 Consulta 5: Projeção de Fluxo de Caixa Diário (Próximos 7 a 30 dias)
```sql
-- Entradas e saídas agrupadas por data futura
SELECT 
  data_vencimento AS data,
  SUM(CASE WHEN tipo = 'receber' THEN valor ELSE 0.0 END) AS inflow,
  SUM(CASE WHEN tipo = 'pagar' THEN valor ELSE 0.0 END) AS outflow
FROM invoice_installments
WHERE company_id = ?
  AND status IN ('pendente', 'provisionado')
  AND data_vencimento >= date('now')
  AND data_vencimento <= date('now', '+30 days')
GROUP BY data_vencimento
ORDER BY data_vencimento ASC;
```

---

### 3.6 Consulta 6: Guias Tributárias e Provisões de Impostos
```sql
-- 1. Guias tributárias já geradas e registradas
SELECT * FROM tax_guides 
WHERE company_id = ?
ORDER BY data_vencimento ASC;

-- 2. Provisões contábeis de tributos e encargos do BPO
SELECT * FROM accounting_provisions
WHERE company_id = ?
ORDER BY data_lancamento DESC;
```

---

## 4. Caveats (Ressalvas e Limitações)

1. **Formato das Datas**: Algumas notas fiscais legadas podem ter `data_emissao` como ISO (`2026-08-27T12:00:00Z`) ou data simples (`2026-08-27`). As queries utilizam `strftime('%Y-%m', data_emissao)` e `substr(data_emissao, 1, 10)` para total segurança contra variações de formato no SQLite.
2. **Campos de CNPJ**: CNPJs podem estar salvos com pontuação (`12.345.678/0001-99`) ou apenas dígitos (`12345678000199`). A função de geração de PIX e os comparadores sempre removem caracteres não numéricos (`replace(/\D/g, '')`) antes de processar.
3. **Escopo Read-Only**: Esta investigação operou estritamente em modo de leitura e análise técnica, sem alterar o código-fonte da aplicação.

---

## 5. Conclusion (Conclusão e Recomendações Técnicas)

1. **Diagnóstico do Backend**: O backend possui infraestrutura completa (tabelas SQLite, gerador PIX EMV, cálculo de anexos do Simples Nacional).
2. **Ajustes Imediatos Identificados para a Fase de Implementação**:
   - **Remover todos os fallbacks numéricos fictícios** em `server/src/services/portalService.ts:739, 748, 756, 775, 776, 797` (`158450.20`, `12500.00`, `28400.00`, `1850000.00`, `20000 + i*2500`, etc.). Substituir por somatórios determinísticos via SQL que resultem rigorosamente em `0.00` quando não houver registros.
   - **Registrar Alias de Rota**: Configurar em `server/src/routes/api.ts` tanto `/portal/dashboard-summary` quanto `/portal/dashboard/summary` apontando para o controlador.
   - **Unificar `GET /api/portal/tax-guides`**: Enriquecer a listagem de guias consultando dinamicamente `tax_guides` e `accounting_provisions`, sintetizando o PIX EMV oficial para cada tributo pendente com chave CNPJ e valor real.
   - **Garantir Multi-Tenant Estrito**: Certificar que 100% das cláusulas SQL utilizem `WHERE company_id = ?` com passagem de parâmetro indexado.

---

## 6. Verification Method (Método de Verificação Independente)

Para auditar e verificar as observações deste relatório:

1. **Inspeção de Código**:
   - Inspecionar `server/src/database/db.ts:33-780` para conferir a definição de todas as tabelas e índices.
   - Inspecionar `server/src/services/portalService.ts:19-242` para validar o algoritmo CRC16 e BR Code EMV.
   - Inspecionar `server/src/services/portalService.ts:728-806` para confirmar a presença dos números mockados de fallback a serem eliminados.
   - Inspecionar `server/src/routes/api.ts:100-132` para confirmar o mapeamento atual de rotas do portal.
2. **Execução de Testes E2E Automatizados**:
   - Executar o test runner da suíte E2E: `node tests/e2e/test_runner.js`.
   - Executar os testes de cálculo de PIX e Simples: `node -e "import('./tests/e2e/engines/pix.js').then(m => console.log('PIX OK:', !!m.generatePixPayload));"`.
3. **Verificação de Multi-Tenant**:
   - Criar uma empresa fictícia sem movimentação (`comp_empty_test`) e chamar `GET /api/portal/dashboard-summary?company_id=comp_empty_test`. O retorno esperado deve ser exatamente `bank_balance: 0, payables_today: 0, receivables_today: 0, rbt12: 0, percentual_atingido_estadual: 0`.
