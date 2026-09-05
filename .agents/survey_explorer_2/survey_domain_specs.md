# ESPECIFICAÇÃO DE DOMÍNIO COMPLETA: SUPER APP VIACONT (ÁREA DO CLIENTE)
## Plataforma Integrada ViaNfe ERP/BPO • Requisitos R1 a R5

---

### Sumário Executivo
Este documento estabelece a especificação formal de domínio, arquitetura de software, contratos de dados, regras de validação, diagramas de fluxo e tratamento de casos de borda para os requisitos **R1 a R5** do **Super App Viacont (Área do Cliente)**.

A plataforma opera como um ecossistema integrado que conecta o cliente da contabilidade (micro, pequeno e médio empresário) com o back-office do BPO Financeiro e Fiscal da Viacont, oferecendo uma experiência de altíssima velocidade em celulares (Mobile PWA) e produtividade expandida em computadores (Desktop).

---

## 1. REQUISITO R1: ARQUITETURA RESPONSIVA HÍBRIDA & NAVEGAÇÃO SPA

### 1.1. Visão Geral da Arquitetura de Interface
O sistema implementa uma arquitetura **Single Page Application (SPA)** sem recarregamento de página (`window.location.reload` ou full-page navigation), mantendo o estado em memória com persistência reativa em `localStorage` e sincronização assíncrona com o backend Node.js/SQLite.

```
+-----------------------------------------------------------------------------------+
|                              SUPER APP VIACONT SPA                                |
|  [Estado Global: activeCompany, activeTab, authSession, offlineDrafts, theme]      |
+---------------------------------------------------------+-------------------------+
|                    MOBILE PWA (< 768px)                 |  DESKTOP EXPANDIDO      |
|  - Dock Inferior Fixo (Thumb Zone 48px min)             |  (>= 768px / 1024px)    |
|  - Drawer / Bottom-Sheets com animação CSS              |  - Sidebar lateral fixa |
|  - Gestos de toque e suporte a câmera nativa            |  - Grade multi-colunas  |
|  - Listas colapsáveis e cartões compactos               |  - Visualizador DANFE   |
|  - Offline fallback para rascunhos de notas/recibos     |  - Tabelas ordenáveis   |
+---------------------------------------------------------+-------------------------+
|                                NAVEGAÇÃO DE ABAS MESTRES                          |
|  [Tab 1: Início/Finanças] [Tab 2: Emitir Notas] [Tab 3: Guias/Impostos] [Tab 4: Recibos] |
+-----------------------------------------------------------------------------------+
```

### 1.2. Mapeamento das 4 Abas Mestres
1. **`inicio_financas` (Início & Diagnóstico Financeiro)**:
   - Resumo do dia: Saldo em bancos, Contas a Pagar Hoje, Contas a Receber Hoje.
   - Termômetro do Simples Nacional (RBT12 vs Limite Estadual R$ 3.6M e Teto Federal R$ 4.8M).
   - Fluxo de caixa previsto para os próximos 7/15/30 dias.
   - Atalhos de 1-toque para ações urgentes (Emitir Nota, Pagar Guia, Escanear Recibo).
2. **`emitir_notas` (Emissor Relâmpago em 3 Passos)**:
   - Emissão guiada de NFS-e (Serviços) e NF-e (Produtos).
   - Catálogo de Favoritos (Serviços e Produtos recorrentes).
   - Espelho visual em tempo real (DANFE / RPS preview).
   - Compartilhamento instantâneo via WhatsApp + PIX Copia-e-Cola.
3. **`guias_impostos` (Central de Guias & Impostos com 1-Clique PIX)**:
   - Listagem consolidada de obrigações tributárias: DAS, ICMS/DAE, FGTS Digital, INSS/DARF, ISS.
   - Status visual (Pendente, Vencendo Hoje, Vencido, Pago).
   - Botão de 1-toque para copiar código PIX ou Linha Digitável.
   - Upload de comprovante de pagamento com baixa automática.
4. **`recibos_scanner` (Captura & Scanner OCR de Recibos)**:
   - Disparo direto da câmera do smartphone (`capture="environment"`) ou arrastar/soltar no Desktop.
   - Processamento de imagem e extração OCR inteligente de valores, datas, CNPJ e itens.
   - Cruzamento automático (auto-match) com contas a pagar e transações de extrato.

### 1.3. Especificações Técnicas de PWA
- **Manifest PWA (`manifest.json`)**:
  - `name`: "Viacont Super App - Área do Cliente"
  - `short_name`: "Viacont"
  - `display`: "standalone"
  - `start_url`: "/"
  - `theme_color`: "#06110d"
  - `background_color`: "#040d0a"
  - `orientation`: "portrait-primary"
  - `icons`: Ícones 192x192 e 512x512 com suporte a maskable icons.
- **Service Worker & Caching**:
  - Estratégia `NetworkFirst` para APIs e `CacheFirst` para assets estáticos (ícones, fontes, estilos).
  - Cache de rascunhos em `localStorage` para continuidade mesmo com instabilidade de 4G/5G.
- **Responsividade & Touch Targets**:
  - Altura mínima de botões e áreas de toque: 44px (padrão WCAG AAA 48px em mobile).
  - Sem quebra de layout em telas de 320px até 3840px (Ultra-wide 4K).

---

## 2. REQUISITO R2: EMISSOR RELÂMPAGO DE NOTAS FISCAIS (NFS-e & NF-e)

### 2.1. O Fluxo Guiado em 3 Passos

```
+--------------------------------------------------------------------------------+
| PASSO 1: TOMADOR / CLIENTE                                                    |
|  - Digitação de CPF (11 dígitos) ou CNPJ (14 dígitos)                         |
|  - Autopreenchimento instantâneo via Receita Federal / Histórico Local         |
|  - Botão "Escolher dos Favoritos" (1 toque)                                   |
|  - Campos: Nome/Razão Social, E-mail, Celular WhatsApp, Endereço e Município    |
+--------------------------------------------------------------------------------+
                                       ↓
+--------------------------------------------------------------------------------+
| PASSO 2: PRODUTO / SERVIÇO & VALORES                                          |
|  - Seleção de Tipo: [ NFS-e Serviços ] ou [ NF-e Mercadorias ]                 |
|  - Seleção em 1 toque do Catálogo de Favoritos (ex: "Honorários", "Consultoria")|
|  - Descrição detalhada do serviço / item                                       |
|  - Valor Bruto (R$), Alíquota de ISS/ICMS, Indicador de Retenção na Fonte       |
|  - Condição de Pagamento: À Vista, Boleto, PIX ou Parcelado                    |
+--------------------------------------------------------------------------------+
                                       ↓
+--------------------------------------------------------------------------------+
| PASSO 3: REVISÃO, EMISSÃO & COMPARTILHAMENTO WHATSAPP                          |
|  - Espelho visual prévio da nota fiscal antes de autorizar                     |
|  - Transmissão com 1 toque (Prefeitura / SEFAZ / ADN Nacional)                 |
|  - Geração imediata do DANFE/DANFSE em PDF + XML assinado                      |
|  - Geração do PIX Copia-e-Cola + QR Code EMV vinculado ao valor exato          |
|  - Botão "Enviar no WhatsApp do Cliente" com mensagem formatada + Link PDF     |
+--------------------------------------------------------------------------------+
```

### 2.2. Modelo de Dados de Domínio (TypeScript & SQLite)

#### Entidade: `FavoriteCatalogItem` (Catálogo de Favoritos)
```typescript
export interface FavoriteCatalogItem {
  id: string;
  company_id: string;
  tipo: 'servico' | 'produto';
  nome_atalho: string;          // Ex: "Manutenção Mensal de Servidores"
  descricao_padrao: string;     // Discriminação do serviço ou texto do produto
  item_lista_servico?: string;  // Ex: "17.01", "01.07" (LC 116/03)
  cnae?: string;                // Ex: "6202-3/00"
  codigo_tributacao_municipio?: string;
  ncm?: string;                 // Para NF-e de produto (8 dígitos)
  cfop?: string;                // Ex: "5.102", "5.933"
  unidade_medida?: string;      // "UN", "HORA", "MES", "SV"
  valor_padrao: number;         // Valor monetário sugerido
  aliquota_iss_padrao: number;  // Ex: 2.0%, 5.0%
  iss_retido_padrao: boolean;   // true / false
  aliquota_icms_padrao?: number;
  created_at: string;
  updated_at: string;
}
```

#### Entidade: `RecurringClient` (Cadastro de Clientes / Tomadores Frequentes)
```typescript
export interface RecurringClient {
  id: string;
  company_id: string;
  tipo_pessoa: 'PJ' | 'PF';
  cnpj_cpf: string;             // Sanitizado (apenas números)
  razao_social: string;
  nome_fantasia?: string;
  email?: string;
  telefone_whatsapp?: string;   // DDI + DDD + Número (ex: 5571999999999)
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigo_ibge_municipio?: string;
  uf: string;
  inscricao_municipal?: string;
  inscricao_estadual?: string;
  iss_retido_padrao: boolean;
  total_notas_emitidas: number;
  valor_acumulado_emitido: number;
  ultimo_servico_utilizado?: string;
  created_at: string;
  updated_at: string;
}
```

#### Entidade: `QuickInvoiceEmissionRequest` (Contrato de Emissão)
```typescript
export interface QuickInvoiceEmissionRequest {
  company_id: string;
  tipo_documento: 'NFSE' | 'NFE';
  
  // Dados do Tomador / Destinatário
  tomador: {
    cnpj_cpf: string;
    razao_social: string;
    email?: string;
    telefone_whatsapp?: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      municipio: string;
      codigo_ibge?: string;
      uf: string;
      cep: string;
    };
    inscricao_municipal?: string;
    salvar_como_favorito?: boolean;
  };

  // Dados do Serviço / Produto
  itens: Array<{
    item_numero: number;
    codigo_item?: string;
    descricao: string;
    ncm_ou_servico: string;       // NCM (8 dígitos) ou Item LC 116 (ex: 17.01)
    cfop?: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    desconto?: number;
    aliquota_iss?: number;
    iss_retido?: boolean;
  }>;

  // Totais & Financeiro
  valor_total: number;
  forma_pagamento: 'PIX' | 'BOLETO' | 'CARTAO' | 'A_VISTA' | 'A_PRAZO';
  gerar_chave_pix: boolean;
  pix_chave_customizada?: string;
  observacoes_internas?: string;
}
```

### 2.3. Especificação do Gerador de PIX Copia-e-Cola (Padrão EMV Bacen)
O sistema calcula a string estática ou dinâmica no padrão **EMV QRCPS-MPM (Banco Central do Brasil)**:
- Payload Format Indicator: `000201`
- Merchant Account Information (GUI `br.gov.bcb.pix`, chave PIX, info adicional): `26...`
- Merchant Category Code: `52040000`
- Transaction Currency: `5303986` (BRL 986)
- Transaction Amount: `540{len}{valor_formatado}`
- Country Code: `5802BR`
- Merchant Name: `59{len}{nome_empresa_sem_acentos_max_25}`
- Merchant City: `60{len}{municipio_sem_acentos_max_15}`
- Additional Data Field Template (TxID): `62...`
- CRC16-CCITT (Polinômio 0x1021): `6304{HEX}`

### 2.4. Template de Mensagem WhatsApp
```text
Olá, *{{NOME_CLIENTE}}*! 👋

Aqui está a sua Nota Fiscal emitida por *{{NOME_EMPRESA}}*:

📄 *Nota Fiscal:* Nº {{NUMERO_NOTA}} (Série {{SERIE_NOTA}})
💰 *Valor Total:* R$ {{VALOR_TOTAL}}
📅 *Data de Emissão:* {{DATA_EMISSAO}}

📥 *Visualizar / Baixar PDF Oficial:*
{{URL_PDF_DIRETA}}

💠 *Pague via PIX Copia-e-Cola:*
`{{CODIGO_PIX_COPIA_E_COLA}}`

_Agradecemos a sua parceria e preferência!_
```

---

## 3. REQUISITO R3: CENTRAL DE GUIAS & IMPOSTOS COM 1-CLIQUE PIX

### 3.1. Visão Geral da Central de Tributos
A Central de Guias consolida todas as obrigações tributárias apuradas pela contabilidade da Viacont, eliminando o envio manual de PDFs desorganizados em e-mails ou conversas avulsas de WhatsApp.

```
+------------------------------------------------------------------------------------+
|                         CENTRAL DE GUIAS & IMPOSTOS VIACONT                        |
+------------------------------------------------------------------------------------+
| Filtros Rápidos: [ Todas ] [ A Vencer (3) ] [ Vencidas (0) ] [ Pagas (12) ]       |
+------------------------------------------------------------------------------------+
|  CARD DA GUIA:                                                                     |
|  +------------------------------------------------------------------------------+  |
|  | [DAS SIMPLES NACIONAL]       Competência: 08/2026        Vencimento: 20/09   |  |
|  | Valor: R$ 3.842,50           Status: [🟡 Vence em 3 dias]                    |  |
|  |                                                                              |  |
|  |  [ 📋 Copiar Código PIX ]    [ 📄 Ver Guia PDF ]    [ 📲 Enviar no Zap ]     |  |
|  |  [ ✓ Marcar como Paga / Anexar Comprovante ]                                 |  |
|  +------------------------------------------------------------------------------+  |
|  +------------------------------------------------------------------------------+  |
|  | [FGTS DIGITAL]               Competência: 08/2026        Vencimento: 20/09   |  |
|  | Valor: R$ 1.250,00           Status: [🟡 Vence em 3 dias]                    |  |
|  |  [ 📋 Copiar Código PIX ]    [ 📄 Ver Guia PDF ]    [ 📲 Enviar no Zap ]     |  |
|  +------------------------------------------------------------------------------+  |
+------------------------------------------------------------------------------------+
```

### 3.2. Tipos de Guias Suportadas e Regras de Apuração
1. **`DAS_SIMPLES`**: Guia do Simples Nacional apurada mensalmente via PGDAS-D. Vencimento padrão: dia 20 do mês seguinte (ou dia útil subsequente).
2. **`ICMS_DAE`**: Documento de Arrecadação Estadual (Antecipação tributária, Diferencial de Alíquota - DIFAL, Substituição Tributária - ST).
3. **`FGTS_DIGITAL`**: Guia oficial do FGTS via PIX emitida pela Caixa / Portal FGTS Digital. Vencimento: dia 20.
4. **`INSS_DARF_PREVIDENCIARIO`**: DARF Previdenciário gerado pelo eSocial/DCTFWeb. Vencimento: dia 20.
5. **`DARF_IRRF_PRO_LABORE`**: Retenção de imposto de renda sobre folha/pró-labore.
6. **`ISS_PROPRIO_OU_RETIDO`**: Imposto sobre serviços municipal.

### 3.3. Modelo de Dados de Domínio

#### Tabela SQLite: `tax_guides`
```sql
CREATE TABLE IF NOT EXISTS tax_guides (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  tipo_tributo TEXT NOT NULL,         -- 'DAS_SIMPLES', 'ICMS_DAE', 'FGTS_DIGITAL', 'INSS_DARF', 'ISS_MUNICIPAL', 'IRRF_FOLHA', 'OUTROS'
  titulo TEXT NOT NULL,               -- Ex: 'DAS - Simples Nacional - 08/2026'
  competencia TEXT NOT NULL,          -- 'MM/YYYY' (ex: '08/2026')
  data_vencimento TEXT NOT NULL,      -- 'YYYY-MM-DD'
  valor_principal REAL NOT NULL,
  valor_multa_juros REAL DEFAULT 0.0,
  valor_total REAL NOT NULL,
  codigo_barras_linha_digitavel TEXT, -- 47 ou 48 dígitos
  pix_copia_e_cola TEXT,              -- String EMV PIX Copia-e-Cola oficial da guia
  pix_qr_code_url TEXT,               -- Link da imagem do QR Code
  pdf_file_path TEXT,                 -- Caminho relativo no storage
  status TEXT DEFAULT 'pendente',     -- 'pendente', 'pago', 'vencido', 'cancelado'
  data_pagamento TEXT,
  comprovante_file_path TEXT,         -- Comprovante de pagamento anexado
  origem_apuracao TEXT DEFAULT 'contabilidade_viacont',
  notificado_whatsapp INTEGER DEFAULT 0,
  notificado_em TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tax_guides_comp_venc ON tax_guides(company_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tax_guides_status ON tax_guides(company_id, status);
```

### 3.4. Regras de Notificação & Ação Rápida
- **Cópia do PIX em 1 Clique**: Ação via `navigator.clipboard.writeText(guide.pix_copia_e_cola)` com feedback háptico (vibração no mobile) e toast animado "Código PIX Copiado com Sucesso! Cole no App do seu Banco".
- **Semáforo de Vencimento**:
  - `Vencido` (Data < Hoje e Status != Pago): Badge Vermelho Intenso (`bg-rose-500/20 text-rose-300 border-rose-500/40`).
  - `Vence Hoje` (Data == Hoje): Badge Âmbar Pulsante (`bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse`).
  - `A Vencer` (Data > Hoje e Data <= Hoje + 5 dias): Badge Amarelo (`bg-yellow-500/20 text-yellow-300`).
  - `Pago`: Badge Esmeralda Suave (`bg-emerald-500/20 text-emerald-300`).

---

## 4. REQUISITO R4: CAPTURA & SCANNER OCR DE RECIBOS E COMPROVANTES

### 4.1. Visão Geral do Módulo de Scanner OCR
Permite ao empresário fotografar recibos de papel, tíquetes de caixa, notas de balcão e comprovantes de transferência diretamente na loja ou no escritório, eliminando comprovantes perdidos e despesas sem comprovação fiscal.

```
+------------------------------------------------------------------------------------+
|                         SCANNER OCR & CAPTURA DE RECIBOS                           |
+------------------------------------------------------------------------------------+
|                                                                                    |
|    +--------------------------------------------------------------------------+    |
|    |                      ÁREA DE CAPTURA / UPLOAD                            |    |
|    |                                                                          |    |
|    |   📷 [ Tirar Foto do Recibo com a Câmera ] (Ambiente Mobile)             |    |
|    |   📁 [ Selecionar Imagem ou PDF da Galeria / Computador ]                |    |
|    +--------------------------------------------------------------------------+    |
|                                         ↓                                          |
|    +--------------------------------------------------------------------------+    |
|    |                   MOTOR DE EXTRAÇÃO OCR (PARSER VIACONT)                 |    |
|    |                                                                          |    |
|    |   🏢 Estabelecimento: POSTO SHELL DA BAHIA LTDA (CNPJ: 00.123.456/0001-00)|    |
|    |   📅 Data da Despesa:  27/08/2026                                        |    |
|    |   💵 Valor Detectado:  R$ 250,00                                         |    |
|    |   🏷️ Categoria Sugerida: Combustíveis e Lubrificantes                   |    |
|    |   📑 Itens Detectados: 42,4 Litros Gasolina Comum                        |    |
|    +--------------------------------------------------------------------------+    |
|                                         ↓                                          |
|    +--------------------------------------------------------------------------+    |
|    |                 MOTOR DE AUTO-MATCHING COM CONTAS A PAGAR                |    |
|    |                                                                          |    |
|    |   🎯 VÍNCULO ENCONTRADO NO EXTRATO BANCÁRIO / CONTAS A PAGAR:            |    |
|    |      → Transação Bancária de R$ 250,00 em 27/08 (Débito Cartão Shell)    |    |
|    |      [ ✓ Confirmar Vínculo & Conciliar Automaticamente ]                  |    |
|    +--------------------------------------------------------------------------+    |
+------------------------------------------------------------------------------------+
```

### 4.2. Modelo de Dados de Domínio

#### Tabela SQLite: `receipt_scans`
```sql
CREATE TABLE IF NOT EXISTS receipt_scans (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'tenant_viacont_master',
  arquivo_nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_tamanho INTEGER,
  mime_type TEXT,
  
  -- Dados Extraídos pelo OCR
  fornecedor_nome_detectado TEXT,
  fornecedor_cnpj_detectado TEXT,
  data_despesa_detectada TEXT,
  valor_total_detectado REAL,
  categoria_sugerida_id TEXT,
  itens_detectados_json TEXT,         -- Array serializado de itens do cupom
  raw_ocr_text TEXT,                  -- Texto bruto lido do OCR
  ocr_confidence_score REAL,          -- Pontuação de confiança 0.0 a 1.0
  
  -- Campos Editáveis / Validados pelo Usuário
  descricao_final TEXT,
  valor_final REAL,
  data_final TEXT,
  forma_pagamento TEXT,               -- 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'PIX'
  observacoes_cliente TEXT,
  
  -- Vínculo Contábil & BPO
  status_match TEXT DEFAULT 'pendente', -- 'pendente', 'sugerido', 'conciliado', 'ignorado'
  matched_transaction_id TEXT,
  matched_installment_id TEXT,
  matched_provision_id TEXT,
  matched_at TEXT,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_sugerida_id) REFERENCES financial_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (matched_transaction_id) REFERENCES bank_transactions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_comp_date ON receipt_scans(company_id, data_final);
CREATE INDEX IF NOT EXISTS idx_receipts_match_status ON receipt_scans(company_id, status_match);
```

### 4.3. Algoritmo de Auto-Matching com Contas a Pagar & Extrato
O algoritmo de conciliação automática do recibo pontua os registros existentes com base em 4 critérios ponderados:

$$\text{Score Match} = (P_{\text{valor}} \times 0.40) + (P_{\text{data}} \times 0.30) + (P_{\text{nome}} \times 0.20) + (P_{\text{doc}} \times 0.10)$$

1. **Similaridade de Valor ($P_{\text{valor}}$)**:
   - Diferença = R$ 0,00 $\rightarrow 1.0$
   - Diferença $\le 0.5\%$ (tolerância de juros/desconto) $\rightarrow 0.8$
   - Diferença $> 0.5\% \rightarrow 0.0$
2. **Proximidade Temporal ($P_{\text{data}}$)**:
   - Mesma data $\rightarrow 1.0$
   - Diferença de $\pm 1$ dia útil $\rightarrow 0.85$
   - Diferença de $\pm 3$ dias úteis $\rightarrow 0.50$
   - Diferença $> 5$ dias $\rightarrow 0.0$
3. **Correspondência de Estabelecimento ($P_{\text{nome}}$)**:
   - CNPJ exato $\rightarrow 1.0$
   - Similaridade de texto Levenshtein/Jaro-Winkler $\ge 0.85 \rightarrow 0.90$
   - Palavras-chave no MEMO bancário (ex: "SHELL", "ATACADAO", "KALUNGA") $\rightarrow 0.80$
4. **Decisão Automática**:
   - $\text{Score} \ge 0.85$: **Match Perfeito** (Apresenta card verde com botão "Confirmar Baixa").
   - $0.60 \le \text{Score} < 0.85$: **Sugestão Provável** (Apresenta lista de 3 opções mais prováveis).
   - $\text{Score} < 0.60$: **Novo Lançamento** (Permite criar nova saída diretamente no Contas a Pagar).

---

## 5. REQUISITO R5: PAINEL FINANCEIRO & DIAGNÓSTICO EM TEMPO REAL

### 5.1. Visão Geral do Painel Executivo
O Painel Financeiro combina dados em tempo real provenientes das NF-e/NFC-e capturadas na SEFAZ, das NFS-e emitidas nas prefeituras, dos extratos bancários conciliados e dos parâmetros fiscais do Simples Nacional.

```
+-----------------------------------------------------------------------------------+
|                        DIAGNÓSTICO FINANCEIRO & FISCAL                            |
+-----------------------------------------------------------------------------------+
|  [ TERMÔMETRO DO SIMPLES NACIONAL - RBT12 ]                                       |
|                                                                                   |
|           . - ~ ~ ~ - .                                                           |
|       . '       |       ' .        Faturamento 12 Meses (RBT12): R$ 2.450.000,00  |
|     /        \  |          \       Teto Sublimite Estadual:      R$ 3.600.000,00  |
|    |      \     |           |      Teto Geral Simples Nacional:  R$ 4.800.000,00  |
|    | - - - - - - - - - - - -|      Consumo do Sublimite:         68,0% (Faixa 5)  |
|     \                      /       Alíquota Efetiva Atual:       10,85%           |
|       ' .               . '                                                       |
|           ' - . _ . - '            [ 🟢 ZONA SEGURA: R$ 1.150.000 até o limite ]  |
+-----------------------------------------------------------------------------------+
|  [ FLUXO DE CAIXA DO DIA & PROJEÇÃO A CURTO PRAZO ]                               |
|                                                                                   |
|  Saldo Disponível em Bancos:  R$ 84.320,00                                        |
|  Contas a Pagar Hoje:         R$ 12.450,00  (3 títulos)                           |
|  Contas a Receber Hoje:       R$ 18.900,00  (5 clientes)                          |
|  Saldo Projetado Final do Dia: R$ 90.770,00  (▲ +R$ 6.450,00)                     |
+-----------------------------------------------------------------------------------+
|  [ CRONOGRAMA DE OBRIGAÇÕES & ENVELHECIMENTO (AGING) ]                            |
|  • Vencidos: R$ 0,00  |  • Hoje: R$ 12.450  |  • 7 dias: R$ 34.100  | • 30d: R$ 78.500 |
+-----------------------------------------------------------------------------------+
```

### 5.2. Regras de Cálculo do Termômetro Simples Nacional (RBT12)

#### Fórmula da Receita Bruta Total Acumulada (RBT12)
Para a competência do mês $m$ do ano $A$:

$$\text{RBT12} = \sum_{k=1}^{12} \text{Receita Bruta Total do Mês } (m - k)$$

Onde a Receita Bruta Total de cada mês é composta por:
1. **Vendas de Mercadorias / Produtos**: Soma do valor total das notas modelo 55 (NF-e) e modelo 65 (NFC-e) de emissão própria (`tipo = 'saida'`, `status = 'autorizada'`), deduzidas as devoluções de vendas.
2. **Prestação de Serviços**: Soma do valor dos serviços de todas as NFS-e emitidas nas prefeituras e no ADN Nacional.

#### Tabela de Faixas e Sublimites (Lei Complementar 123/2006)
- **Sublimite Estadual para ICMS/ISS**: **R$ 3.600.000,00**
  - Empresas cujo RBT12 ultrapasse R$ 3.600.000,00 recolhem os impostos federais no DAS e o ICMS/ISS por fora, no regime normal (Conta Corrente Fiscal / Regime Periódico de Apuração).
  - Alerta de Margem: Ao atingir 80% (R$ 2.880.000,00), o sistema aciona alerta amarelo de planejamento tributário.
- **Teto Máximo Nacional**: **R$ 4.800.000,00**
  - Ao ultrapassar R$ 4.800.000,00, a empresa é desenquadrada do Simples Nacional no ano-calendário subsequente (ou no mês seguinte caso ultrapasse em mais de 20%).

#### Alíquota Efetiva do Simples Nacional
$$\text{Alíquota Efetiva} = \frac{(\text{RBT12} \times \text{Alíquota Nominal da Faixa}) - \text{Parcela a Deduzir}}{\text{RBT12}}$$

### 5.3. Contrato de Dados do Diagnóstico Financeiro (API)
```typescript
export interface FinancialDiagnosticsResponse {
  company_id: string;
  referencia_data: string;
  
  // 1. Termômetro do Simples Nacional
  simples_nacional: {
    rbt12: number;
    faturamento_mes_atual_estimado: number;
    teto_sublimite_estadual: number;       // 3600000.00
    teto_geral_nacional: number;           // 4800000.00
    percentual_sublimite_consumido: number;// Ex: 68.05%
    percentual_teto_consumido: number;     // Ex: 51.04%
    faixa_atual: number;                   // 1 a 6
    aliquota_nominal: number;              // Ex: 14.30%
    parcela_a_deduzir: number;             // Ex: 87300.00
    aliquota_efetiva_estimada: number;     // Ex: 10.74%
    status_risco: 'seguro' | 'alerta_amarelo' | 'risco_critico_desenquadramento';
    margem_reais_restante: number;         // R$ restante até o sublimite
    mensagem_consultoria: string;
  };

  // 2. Fluxo de Caixa do Dia & Disponibilidades
  fluxo_caixa_hoje: {
    saldo_bancario_consolidado: number;
    total_a_pagar_hoje: number;
    total_a_receber_hoje: number;
    saldo_projetado_fim_do_dia: number;
    variacao_dia: number;
  };

  // 3. Projeção de Caixa & Aging de Títulos
  projecao_periodo: {
    proximos_7_dias: { a_pagar: number; a_receber: number; saldo_previsto: number };
    proximos_15_dias: { a_pagar: number; a_receber: number; saldo_previsto: number };
    proximos_30_dias: { a_pagar: number; a_receber: number; saldo_previsto: number };
  };

  // 4. Indicadores de Saúde Financeira
  saude_operacional: {
    dias_caixa_cobertura: number;          // Saldo / Média de Saídas Diárias
    inadimplencia_clientes_taxa: number;   // % de títulos de clientes vencidos
    guias_impostos_pendentes_total: number;
    recibos_sem_conciliacao_total: number;
  };
}
```

---

## 6. MATRIZ DE CONTRATOS DE DADOS E APIs (BACKEND / CLIENT)

### 6.1. Novos Endpoints REST da Camada do Super App

| Método | Rota | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/portal/client-hub/summary` | JWT Client/Admin | Resumo consolidado para a Aba Início (Fluxo de Caixa + Simples RBT12 + Alertas) |
| `GET` | `/api/portal/quick-invoice/favorites`| JWT Client/Admin | Lista os serviços e produtos favoritos da empresa |
| `POST`| `/api/portal/quick-invoice/favorites`| JWT Client/Admin | Cria ou atualiza item no catálogo de favoritos |
| `DELETE`| `/api/portal/quick-invoice/favorites/:id` | JWT Client/Admin | Remove item do catálogo de favoritos |
| `POST`| `/api/portal/quick-invoice/emit` | JWT Client/Admin | Emissão relâmpago de NFS-e ou NF-e em 3 passos |
| `GET` | `/api/portal/tax-guides` | JWT Client/Admin | Lista todas as guias de impostos (com filtros por status e competência) |
| `POST`| `/api/portal/tax-guides` | JWT Admin | Escritório contábil insere nova guia apurada (PDF + PIX) |
| `POST`| `/api/portal/tax-guides/:id/pay` | JWT Client/Admin | Marca guia como paga e anexa comprovante |
| `POST`| `/api/portal/receipts/scan` | JWT Client/Admin | Upload de imagem/recibo com execução de OCR e auto-matching |
| `GET` | `/api/portal/receipts` | JWT Client/Admin | Lista recibos escaneados e status de conciliação |
| `POST`| `/api/portal/receipts/:id/confirm-match` | JWT Client/Admin | Confirma vínculo com lançamento bancário ou contas a pagar |
| `GET` | `/api/portal/diagnostics/simples-nacional` | JWT Client/Admin | Retorna cálculo detalhado do RBT12, faixas e alertas |

---

## 7. MATRIZ DE CASOS DE BORDA & TRATAMENTO DE ERROS

| Requisito | Cenário de Borda | Causa Provável | Ação de Mitigação do Sistema |
| :--- | :--- | :--- | :--- |
| **R1** | Perda de conexão 4G/5G no celular durante navegação | Falha de sinal de operadora móvel | Service Worker serve a casca SPA e formulários salvam rascunho em `localStorage`. Notificação visual de "Modo Offline - Seus dados serão sincronizados ao reconectar". |
| **R2** | CNPJ digitado é inválido ou CPF tem menos de 11 dígitos | Erro de digitação do cliente | Validação local instantânea por algoritmo de dígitos verificadores com feedback visual vermelho e bloqueio do botão "Avançar". |
| **R2** | Timeout ou indisponibilidade no webservice da Prefeitura na NFS-e | Servidor municipal fora do ar | O sistema gera e armazena o Recibo Provisório de Serviços (RPS) offline, salva o espelho e agenda retentativa automática a cada 5 minutos via fila de jobs. |
| **R2** | Descrição do serviço com caracteres especiais ou quebras inadequadas | Incompatibilidade de schema XML | Sanitização automática com substituição de tags perigosas (`<`, `>`, `&`) e conversão para entidades XML seguras. |
| **R3** | Guia emitida não possui código PIX no PDF da SEFAZ/Prefeitura | Guia antiga ou prefeitura sem suporte a PIX | O sistema gera automaticamente o código de barras tradicional (Linha Digitável de 47/48 dígitos) e oferece botão alternativo "Copiar Código de Barras". |
| **R3** | Cliente marca guia como paga sem anexar comprovante | Esquecimento do usuário | Permite a marcação como "Pago Provisório" e emite lembrete suave solicitando o upload do comprovante bancário para auditoria. |
| **R4** | Foto do recibo borrada, escura ou com papel amassado | Condição ruim da câmera | O sistema exibe índice de confiança OCR (ex: 45%). Os campos detectados são pré-preenchidos e destacados em amarelo com aviso "Confirme os valores antes de salvar". |
| **R4** | Recibo de valor idêntico a dois lançamentos do mesmo dia | Compras repetidas no mesmo fornecedor | O sistema exibe o diálogo de desambiguação para o usuário selecionar qual dos dois lançamentos bancários corresponde ao recibo em questão. |
| **R5** | Empresa iniciou atividades no ano corrente (menos de 12 meses de operação) | Falta de histórico para RBT12 | Aplica a regra de proporcionalização da Receita Federal (Art. 5º da Resolução CGSN nº 140/2018): Multiplica a média dos meses decorridos por 12. |
| **R5** | NF-e cancelada posteriormente pelo fornecedor ou cliente | Evento de cancelamento na SEFAZ | O motor de diagnóstico recalcula instantaneamente o RBT12 excluindo notas canceladas ou denegadas. |

---

## 8. CONCLUSÃO E DIRETRIZES DE IMPLEMENTAÇÃO

Esta especificação fornece a base completa e formal para a implementação dos módulos R1, R2, R3, R4 e R5 no repositório `c:\Users\USER\Documents\app_xml_antigravity`.

Todas as estruturas definidas são modulares, retrocompatíveis com as tabelas existentes (`companies`, `invoices`, `bank_transactions`, `dominio_chart_of_accounts`) e preparadas para execução de alta performance em ambiente web e mobile.
