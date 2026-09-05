# Plano Arquitetural de Controladores, Rotas e Verificação de Build (M1)
## Super App Viacont (Área do Cliente) • Backend Express REST API

**Autor:** M1 Explorer 3 (Controllers, Routes & Build Verification)  
**Data:** 27 de Agosto de 2026  
**Status:** Concluído / Pronto para Implementação  
**Alvo:** `server/src/controllers/portalController.ts`, `server/src/routes/api.ts`, `server/src/types/portal.ts`

---

## 1. Sumário Executivo & Diagnóstico do Estado Atual

O backend do ecossistema ViaNfe ERP (`server/`) é estruturado em **Node.js 22 + Express 4 + TypeScript 5** com banco de dados embarcado de alta performance **SQLite 3 nativo (`DatabaseSync` em modo WAL)**. A compilação atual via `tsc` (`npm run build --prefix server`) compila de forma estrita e limpa com zero erros.

O objetivo do Milestone 1 (M1) nesta frente é:
1. Estruturar a camada completa de controladores em `server/src/controllers/portalController.ts` para atender a todos os requisitos do Super App Viacont (**R1 a R5**).
2. Definir o mapeamento exaustivo de rotas no roteador central `server/src/routes/api.ts` sob o prefixo `/api/portal/*`.
3. Estabelecer contratos de tipagem TypeScript rigorosos (`server/src/types/portal.ts`), envelope padronizado de resposta (`ApiResponse<T>` / `ApiErrorResponse`), validações de entrada e tratamento robusto de exceções.
4. Definir o protocolo de verificação de build contínua para assegurar compilação sem falhas no TypeScript e Vite.

---

## 2. Mapeamento Geral de Endpoints `/api/portal/*`

A tabela abaixo resume todos os endpoints do Super App Viacont, métodos HTTP, permissões, parâmetros e finalidade de negócio:

| # | Método | Rota | Autenticação / Permissão | Finalidade & Requisito |
|---|---|---|---|---|
| **1** | `GET` | `/api/portal/dashboard/summary` | JWT (`verifyJwtAndTenant`) | **R5**: Painel Financeiro em Tempo Real (Saldo, a pagar hoje, a receber hoje, fluxo 7/15/30d) e Termômetro Simples Nacional (RBT12 vs R$ 3,6M / R$ 4,8M). |
| **2** | `POST` | `/api/portal/invoices/emit-fast` | JWT (`verifyJwtAndTenant`) | **R2**: Emissor Relâmpago em 3 Passos (NFS-e / NF-e, tomador, item favorito, PIX e WhatsApp). |
| **3** | `GET` | `/api/portal/invoices/:id/pdf` | JWT Opcional (`optionalJwtOrPublicDoc`) | **R2 / R6**: Espelho visual oficial da nota / DANFSe / DANFE gerado em PDF para download ou envio. |
| **4** | `GET` | `/api/portal/invoices/recent` | JWT (`verifyJwtAndTenant`) | **R2**: Listagem das últimas notas emitidas pelo cliente no portal com status e links rápidos. |
| **5** | `GET` | `/api/portal/favorites` | JWT (`verifyJwtAndTenant`) | **R2**: Catálogo de itens/serviços favoritos para emissão em 1 toque. |
| **6** | `POST` | `/api/portal/favorites` | JWT (`verifyJwtAndTenant`) | **R2**: Cadastro de novo item/serviço favorito no catálogo. |
| **7** | `PUT` | `/api/portal/favorites/:id` | JWT (`verifyJwtAndTenant`) | **R2**: Atualização de item/serviço favorito existente. |
| **8** | `DELETE`| `/api/portal/favorites/:id` | JWT (`verifyJwtAndTenant`) | **R2**: Exclusão de item/serviço favorito do catálogo. |
| **9** | `GET` | `/api/portal/recurring-clients` | JWT (`verifyJwtAndTenant`) | **R2**: Catálogo de tomadores/clientes recorrentes para autopreenchimento no Passo 1. |
| **10**| `POST` | `/api/portal/recurring-clients` | JWT (`verifyJwtAndTenant`) | **R2**: Salvar/atualizar tomador no catálogo de clientes frequentes. |
| **11**| `DELETE`|`/api/portal/recurring-clients/:id`| JWT (`verifyJwtAndTenant`) | **R2**: Excluir tomador do catálogo de clientes frequentes. |
| **12**| `GET` | `/api/portal/tax-guides` | JWT (`verifyJwtAndTenant`) | **R3**: Central de Guias & Impostos (DAS, ICMS, Folha/INSS, FGTS) com status e vencimento. |
| **13**| `GET` | `/api/portal/tax-guides/:id` | JWT (`verifyJwtAndTenant`) | **R3**: Detalhes de uma guia tributária específica. |
| **14**| `GET` | `/api/portal/tax-guides/:id/pdf` | JWT Opcional (`optionalJwtOrPublicDoc`) | **R3**: Stream do PDF oficial da guia de recolhimento tributário com código de barras e PIX. |
| **15**| `GET` | `/api/portal/tax-guides/:id/pix` | JWT (`verifyJwtAndTenant`) | **R3**: Recuperação do código PIX Copia-e-Cola (EMV) e linha digitável em 1 clique. |
| **16**| `POST`| `/api/portal/tax-guides/:id/pay` | JWT (`verifyJwtAndTenant`) | **R3**: Registro de quitação da guia pelo cliente (anexo de comprovante ou confirmação de pagamento). |
| **17**| `PATCH`|`/api/portal/tax-guides/:id/status`| JWT (`verifyJwtAndTenant`) | **R3**: Atualização direta do status da guia (`PENDENTE`, `PAGO`, `VENCIDO`). |
| **18**| `POST`| `/api/portal/receipts/scan` | JWT (`verifyJwtAndTenant`) | **R4**: Upload de foto/comprovante com extração OCR e motor de Auto-Match com Contas a Pagar. |
| **19**| `GET` | `/api/portal/receipts` | JWT (`verifyJwtAndTenant`) | **R4**: Histórico de recibos escaneados com status de conciliação. |
| **20**| `POST`| `/api/portal/receipts/:id/confirm` | JWT (`verifyJwtAndTenant`) | **R4**: Confirmação da conciliação do recibo com baixa na duplicata/parcela a pagar. |
| **21**| `DELETE`|`/api/portal/receipts/:id` | JWT (`verifyJwtAndTenant`) | **R4**: Exclusão de registro de recibo OCR escaneado. |
| **22**| `POST`| `/api/portal/manifest` | JWT (`verifyJwtAndTenant`) | *Existente*: Manifestação do Destinatário SEFAZ (Ciência, Confirmação, Desconhecimento). |
| **23**| `GET` | `/api/portal/manifestations/:invoiceId` | JWT (`verifyJwtAndTenant`) | *Existente*: Histórico de eventos de manifestação da NF-e. |

---

## 3. Especificação Detalhada das Ações do Controlador (`portalController.ts`)

### 3.1 `portalController.getDashboardSummary` (Requisito R5)
- **Método**: `GET /api/portal/dashboard/summary`
- **Query Parameters**:
  - `company_id` (obrigatório, string): ID UUID da empresa cliente.
- **Regras de Validação**:
  1. `company_id` deve estar presente na query. Se ausente, retorna HTTP `400 Bad Request`.
  2. Valida se a empresa existe na tabela `companies`. Se não existir, retorna HTTP `404 Not Found`.
  3. Usuário autenticado (`req.user`) deve possuir permissão para visualizar a empresa (Tenant Master ou empresa designada em `user_companies`). Caso contrário, retorna HTTP `403 Forbidden`.
- **Lógica de Processamento**:
  - Consulta saldo bancário consolidado em `bank_accounts` (`SUM(saldo_atual)`).
  - Consulta contas a pagar com vencimento no dia atual em `invoice_installments` (`tipo = 'pagar' AND data_vencimento = date('now') AND status != 'pago'`).
  - Consulta contas a receber com vencimento no dia atual em `invoice_installments` (`tipo = 'receber' AND data_vencimento = date('now') AND status != 'pago'`).
  - Projeta fluxo de caixa para 7, 15 e 30 dias agrupado por data com `inflow`, `outflow` e `net`.
  - Aciona o motor do Simples Nacional (`portalService.calculateSimplesNacionalGauge(company_id)`):
    - Soma o faturamento das notas de saída dos últimos 12 meses (`invoices` com `tipo = 'saida'` e `nfse_issued`).
    - Compara com o Sublimite Estadual do Simples Nacional (R$ 3.600.000,00) e Teto Federal (R$ 4.800.000,00).
    - Determina faixa do anexo, alíquota efetiva estimada e nível de alerta (`normal` < 75%, `atencao` 75-90%, `critico` > 90%).
- **Formato da Resposta (HTTP 200)**:
```json
{
  "success": true,
  "data": {
    "bank_balance": 158450.20,
    "payables_today": 12500.00,
    "receivables_today": 28400.00,
    "cash_flow_forecast": [
      { "date": "2026-08-27", "inflow": 28400.00, "outflow": 12500.00, "net": 15900.00 },
      { "date": "2026-08-28", "inflow": 15000.00, "outflow": 4200.00, "net": 10800.00 }
    ],
    "simples_nacional": {
      "rbt12": 1850000.00,
      "teto_estadual": 3600000.00,
      "teto_federal": 4800000.00,
      "percentual_atingido_estadual": 51.38,
      "percentual_atingido_federal": 38.54,
      "faixa_atual": "Faixa 4 - Alíquota Efetiva ~10.45%",
      "alerta": "normal"
    }
  }
}
```

---

### 3.2 `portalController.emitFastInvoice` (Requisito R2)
- **Método**: `POST /api/portal/invoices/emit-fast`
- **Request Body (`EmitFastInvoicePayload`)**:
```json
{
  "company_id": "c1f7b0a8-...",
  "tipo": "NFS-e",
  "tomador": {
    "cnpj_cpf": "12.345.678/0001-90",
    "razao_social": "Cliente Exemplo Serviços LTDA",
    "email": "financeiro@clienteexemplo.com.br",
    "whatsapp": "71999887766",
    "logradouro": "Av. Tancredo Neves",
    "numero": "1632",
    "bairro": "Caminho das Árvores",
    "municipio": "Salvador",
    "uf": "BA",
    "cep": "41820-020"
  },
  "item": {
    "descricao": "Assessoria e Consultoria em Gestão Financeira",
    "valor": 2500.00,
    "aliquota_iss": 2.0,
    "iss_retido": false,
    "item_servico": "17.01",
    "ncm": ""
  },
  "condicao_pagamento": "PIX"
}
```
- **Regras de Validação Estritas**:
  1. `company_id`, `tipo`, `tomador`, `item` são obrigatórios. Falhas retornam HTTP `400 Bad Request`.
  2. `tomador.cnpj_cpf`: Após remover caracteres não numéricos, deve conter 11 (CPF) ou 14 (CNPJ) dígitos.
  3. `tomador.razao_social`: Obrigatório, mínimo de 3 caracteres.
  4. `item.descricao`: Obrigatório, mínimo de 5 caracteres.
  5. `item.valor`: Obrigatório, deve ser número estritamente maior que 0.00.
  6. `tipo`: Deve ser exclusivamente `'NFS-e'` ou `'NF-e'`.
- **Lógica de Processamento**:
  - Salva/atualiza automaticamente o tomador na tabela `recurring_clients` (ou `nfse_recurring_clients`) para agilizar futuras emissões.
  - Gera numeração sequencial de RPS/Nota para a empresa de forma atômica.
  - Gera código de verificação alfanumérico único.
  - Aciona o gerador de BR Code PIX EMV oficial (`portalService.generatePixEmvPayload(...)`) com chave da empresa e valor da nota.
  - Formata link de compartilhamento direto no WhatsApp (`portalService.generateWhatsAppShareLink(...)`).
  - Persiste a nota em `nfse_issued` (ou `invoices`).
  - Cria parcela em `invoice_installments` como conta a receber (`tipo: 'receber'`).
- **Formato da Resposta (HTTP 201 Created)**:
```json
{
  "success": true,
  "message": "Nota Fiscal emitida com sucesso!",
  "data": {
    "id": "nfse_98234...",
    "numero_nota": "20260012",
    "codigo_verificacao": "A89F-771B",
    "status": "AUTORIZADA",
    "pdf_url": "/api/portal/invoices/nfse_98234.../pdf",
    "pix_code": "00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-42661417400052040000530398654072500.005802BR5925VIACONT INOVACOES CONTAB6008SALVADOR62070503***6304ABCD",
    "pix_qr_base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "whatsapp_share_url": "https://api.whatsapp.com/send?phone=5571999887766&text=Ol%C3%A1%2C%20segue%20sua%20Nota%20Fiscal%20N%C2%BA%2020260012...",
    "issued_at": "2026-08-27T10:45:00.000Z"
  }
}
```

---

### 3.3 `portalController.getInvoicePdf` (Requisitos R2 & R6)
- **Método**: `GET /api/portal/invoices/:id/pdf`
- **Route Parameters**: `id` (UUID ou número da nota/RPS).
- **Lógica de Processamento**:
  - Busca o registro da nota no banco. Se não encontrar, retorna HTTP `404 Not Found`.
  - Constrói documento PDF usando `PDFDocument` (`pdfkit`) com layout profissional padrão nacional:
    1. Canhoto de recebimento destacado no topo com linha tracejada de corte.
    2. Cabeçalho oficial com dados da prefeitura/SEFAZ, número da nota, série e código de verificação.
    3. Quadro do Prestador (Razão Social, CNPJ, Inscrição Municipal, Endereço, Simples Nacional).
    4. Quadro do Tomador (Razão Social, CPF/CNPJ, Endereço, WhatsApp).
    5. Discriminação dos Serviços / Produtos com alíquotas e código de tributação.
    6. Retenções Federais (PIS, COFINS, INSS, IRPJ, CSLL).
    7. Apuração do ISS e Destaque do Valor Líquido em verde `#047857`.
    8. Informações complementares e Chave de Autenticidade Digital.
  - Define os cabeçalhos HTTP:
    - `Content-Type: application/pdf`
    - `Content-Disposition: inline; filename="DANFSE_${numero}.pdf"`
  - Transmite o buffer via pipe para `res`.

---

### 3.4 `portalController.listFavorites` & CRUD (Requisito R2)
- **`GET /api/portal/favorites`**:
  - Query: `company_id` (obrigatório), `tipo` (`'servico'` ou `'produto'`, opcional).
  - Retorna lista ordenada de favoritos em `favorite_catalog_items`.
- **`POST /api/portal/favorites`**:
  - Body: `{ company_id, tipo, titulo, descricao, valor_padrao, aliquota_iss?, ncm?, item_servico?, icone? }`.
  - Validações: `company_id`, `tipo`, `titulo`, `descricao` obrigatórios; `valor_padrao >= 0`.
  - Insere registro com UUID e retorna HTTP `201 Created`.
- **`PUT /api/portal/favorites/:id`**:
  - Params: `id` (UUID).
  - Body: Campos atualizáveis (`titulo`, `descricao`, `valor_padrao`, etc.).
  - Retorna HTTP `200 OK` com dados atualizados.
- **`DELETE /api/portal/favorites/:id`**:
  - Params: `id` (UUID).
  - Remove do banco e retorna `{ success: true, message: 'Item favorito excluído com sucesso.' }`.

---

### 3.5 `portalController.listTaxGuides` & PIX (Requisito R3)
- **`GET /api/portal/tax-guides`**:
  - Query: `company_id` (obrigatório), `status` (`'PENDENTE'`, `'PAGO'`, `'VENCIDO'`), `competencia`.
  - Lógica: Consulta tabela `tax_guides`. Atualiza dinamicamente guias com `vencimento < date('now') AND status = 'PENDENTE'` para `'VENCIDO'`.
  - Retorna lista com valor, competência, vencimento, PIX Copia-e-Cola e linha digitável.
- **`GET /api/portal/tax-guides/:id/pdf`**:
  - Renderiza guia de recolhimento oficial em PDF via `pdfkit` (Guia DAS / ICMS / Folha) com código de barras, PIX QR Code e instruções de pagamento bancário.
- **`GET /api/portal/tax-guides/:id/pix`**:
  - Retorna o código PIX Copia-e-Cola EMV formatado para cópia em 1 clique pelo cliente.
- **`POST /api/portal/tax-guides/:id/pay`**:
  - Body: `{ status: 'PAGO', comprovante_url?, paid_at? }`.
  - Marca a guia como paga, registra a data de pagamento e atualiza o fluxo de caixa.

---

### 3.6 `portalController.scanReceiptOcr` & Auto-Match (Requisito R4)
- **Método**: `POST /api/portal/receipts/scan`
- **Request**: Multipart Form Data (`company_id`, arquivo `image`) ou JSON com `image_base64`.
- **Regras de Validação**:
  1. `company_id` deve ser informado.
  2. Arquivo de imagem (`image`) ou `image_base64` deve estar presente. Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Limite de 15MB.
- **Lógica de Processamento**:
  1. Salva arquivo em `storage/receipts/`.
  2. Aciona `portalService.processReceiptOcr(filePath, company_id)`:
     - Executa motor OCR para extração de texto bruto.
     - Extrai expressões regulares: CNPJ do estabelecimento, data de emissão, valor total e itens de compra.
     - Categoriza o gasto com base em palavras-chave (combustível, refeição, material de escritório, etc.).
     - Executa o algoritmo de **Auto-Match** ponderado:
       - Cruza o valor extraído com as parcelas em aberto de `invoice_installments` (`tipo = 'pagar'`).
       - Cruza com transações bancárias pendentes em `bank_transactions` (`tipo = 'DEBITO'`).
       - Atribui índice de confiança (`match_confidence` de 0.00 a 1.00):
         - `match_confidence >= 0.85`: Status `MATCHED`.
         - `0.60 <= match_confidence < 0.85`: Status `POSSIBLE_MATCH`.
         - `< 0.60`: Status `UNMATCHED`.
  3. Insere registro na tabela `receipts_ocr`.
- **Formato da Resposta (HTTP 201/200)**:
```json
{
  "success": true,
  "data": {
    "receipt_id": "rec_09812a...",
    "image_url": "/storage/receipts/rec_09812a.jpg",
    "extracted": {
      "cnpj": "12.345.678/0001-90",
      "fornecedor": "Posto Shell Combustíveis",
      "data_emissao": "2026-08-26",
      "valor_total": 245.80,
      "categoria_sugerida": "Combustíveis & Frotas"
    },
    "matched_payable": {
      "payable_id": "inst_7721a...",
      "descricao": "Fornecimento de Combustível - Frota",
      "valor": 245.80,
      "vencimento": "2026-08-30",
      "match_confidence": 0.95,
      "match_status": "MATCHED"
    }
  }
}
```

---

### 3.7 `portalController.confirmReceiptMatch` (Requisito R4)
- **Método**: `POST /api/portal/receipts/:id/confirm`
- **Request Body**:
```json
{
  "payable_id": "inst_7721a...",
  "bank_transaction_id": "trn_9918b...",
  "categoria_id": "cat_02",
  "valor_ajustado": 245.80,
  "data_ajustada": "2026-08-26",
  "fornecedor_ajustado": "Posto Shell Combustíveis"
}
```
- **Lógica**:
  - Atualiza o registro em `receipts_ocr` com status `CONFIRMADO`.
  - Marca a duplicata correspondente em `invoice_installments` como conciliada/paga.
  - Vincula a foto do comprovante à transação bancária em `bank_transactions`.
  - Retorna confirmação com status HTTP 200.

---

## 4. Contratos de Tipagem TypeScript (`server/src/types/portal.ts`)

Abaixo estão todas as interfaces de dados padronizadas para o ecossistema do Portal:

```typescript
// ==========================================
// SUPER APP VIACONT - CONTRATOS TYPESCRIPT
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// 1. Dashboard & Diagnóstico (R5)
export interface CashFlowDay {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface SimplesNacionalGauge {
  rbt12: number;
  teto_estadual: number;
  teto_federal: number;
  percentual_atingido_estadual: number;
  percentual_atingido_federal: number;
  faixa_atual: string;
  aliquota_efetiva_estimada?: number;
  margem_seguranca_reais?: number;
  alerta: 'normal' | 'atencao' | 'critico';
}

export interface DashboardSummaryData {
  bank_balance: number;
  payables_today: number;
  receivables_today: number;
  cash_flow_forecast: CashFlowDay[];
  simples_nacional: SimplesNacionalGauge;
}

// 2. Emissão Rápida de Notas (R2)
export interface TomadorInvoiceDto {
  cnpj_cpf: string;
  razao_social: string;
  email?: string;
  whatsapp?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

export interface ItemInvoiceDto {
  descricao: string;
  valor: number;
  aliquota_iss?: number;
  iss_retido?: boolean;
  item_servico?: string;
  cnae?: string;
  ncm?: string;
}

export interface EmitFastInvoiceDto {
  company_id: string;
  tipo: 'NFS-e' | 'NF-e';
  tomador: TomadorInvoiceDto;
  item: ItemInvoiceDto;
  condicao_pagamento?: 'PIX' | 'Boleto' | 'A_VISTA' | 'PARCELADO';
}

export interface FastInvoiceResult {
  id: string;
  numero_nota: string;
  codigo_verificacao: string;
  status: 'AUTORIZADA' | 'EMITIDA' | 'PENDENTE';
  pdf_url: string;
  pix_code: string;
  pix_qr_base64?: string;
  whatsapp_share_url: string;
  issued_at: string;
}

// 3. Catálogo de Favoritos (R2)
export interface FavoriteCatalogItem {
  id: string;
  company_id: string;
  tipo: 'servico' | 'produto';
  titulo: string;
  descricao: string;
  valor_padrao: number;
  aliquota_iss?: number;
  ncm?: string;
  item_servico?: string;
  icone?: string;
  created_at: string;
  updated_at?: string;
}

// 4. Central de Guias & Impostos (R3)
export interface TaxGuideItem {
  id: string;
  company_id: string;
  tipo: 'DAS' | 'ICMS' | 'FOLHA_INSS' | 'FGTS' | 'DARF' | 'OUTROS';
  descricao: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO';
  pix_copia_cola: string;
  linha_digitavel: string;
  pdf_url: string;
  comprovante_url?: string;
  paid_at?: string;
  created_at: string;
}

// 5. Scanner OCR de Recibos & Auto-Match (R4)
export interface ExtractedReceiptData {
  cnpj?: string;
  fornecedor?: string;
  data_emissao?: string;
  valor_total?: number;
  categoria_sugerida?: string;
  itens?: Array<{ descricao: string; valor: number }>;
}

export interface MatchedPayableData {
  payable_id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  match_confidence: number;
  match_status: 'MATCHED' | 'POSSIBLE_MATCH' | 'UNMATCHED';
}

export interface ReceiptOcrItem {
  id: string;
  company_id: string;
  image_url: string;
  raw_text?: string;
  extracted: ExtractedReceiptData;
  matched_payable?: MatchedPayableData;
  status: 'PROCESSADO' | 'CONFIRMADO' | 'REJEITADO';
  created_at: string;
}
```

---

## 5. Mapeamento de Rotas no `server/src/routes/api.ts`

Trecho de integração para inclusão no arquivo central de rotas:

```typescript
import { portalController } from '../controllers/portalController.js';
import multer from 'multer';
import path from 'path';
import os from 'os';

const uploadReceipt = multer({ 
  dest: path.join(os.tmpdir(), 'receipt_uploads'),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) REST API ROUTES
// ============================================================================

// R5: Painel Financeiro em Tempo Real & Termômetro Simples Nacional
router.get('/portal/dashboard/summary', verifyJwtAndTenant, portalController.getDashboardSummary);

// R2: Emissor Relâmpago em 3 Passos & Espelho da Nota
router.post('/portal/invoices/emit-fast', verifyJwtAndTenant, portalController.emitFastInvoice);
router.get('/portal/invoices/:id/pdf', optionalJwtOrPublicDoc, portalController.getInvoicePdf);
router.get('/portal/invoices/recent', verifyJwtAndTenant, portalController.getRecentInvoices);

// R2: Catálogo de Produtos & Serviços Favoritos (1-Toque)
router.get('/portal/favorites', verifyJwtAndTenant, portalController.listFavorites);
router.post('/portal/favorites', verifyJwtAndTenant, portalController.createFavorite);
router.put('/portal/favorites/:id', verifyJwtAndTenant, portalController.updateFavorite);
router.delete('/portal/favorites/:id', verifyJwtAndTenant, portalController.deleteFavorite);

// R2: Catálogo de Clientes / Tomadores Recorrentes
router.get('/portal/recurring-clients', verifyJwtAndTenant, portalController.listRecurringClients);
router.post('/portal/recurring-clients', verifyJwtAndTenant, portalController.saveRecurringClient);
router.delete('/portal/recurring-clients/:id', verifyJwtAndTenant, portalController.deleteRecurringClient);

// R3: Central de Guias & Impostos com 1-Clique PIX
router.get('/portal/tax-guides', verifyJwtAndTenant, portalController.listTaxGuides);
router.get('/portal/tax-guides/:id', verifyJwtAndTenant, portalController.getTaxGuideById);
router.get('/portal/tax-guides/:id/pdf', optionalJwtOrPublicDoc, portalController.getTaxGuidePdf);
router.get('/portal/tax-guides/:id/pix', verifyJwtAndTenant, portalController.getTaxGuidePix);
router.post('/portal/tax-guides/:id/pay', verifyJwtAndTenant, portalController.payTaxGuide);
router.patch('/portal/tax-guides/:id/status', verifyJwtAndTenant, portalController.updateTaxGuideStatus);

// R4: Scanner OCR de Recibos & Auto-Match Contas a Pagar
router.post('/portal/receipts/scan', verifyJwtAndTenant, uploadReceipt.single('image'), portalController.scanReceiptOcr);
router.get('/portal/receipts', verifyJwtAndTenant, portalController.listReceipts);
router.post('/portal/receipts/:id/confirm', verifyJwtAndTenant, portalController.confirmReceiptMatch);
router.delete('/portal/receipts/:id', verifyJwtAndTenant, portalController.deleteReceipt);
```

---

## 6. Procedimento e Checklist de Verificação de Build

Para garantir que o comando `npm run build --prefix server` compile 100% limpo sem qualquer erro de tipagem ou transpilação:

### 6.1 Regras Estritas do Compilador TypeScript (`server/tsconfig.json`)
1. **Extensões de Arquivo `.js` em Imports Locais**: Como o `tsconfig.json` do servidor utiliza `"module": "NodeNext"` e `"moduleResolution": "NodeNext"`, todas as importações relativas de código próprio devem conter explicitamente a extensão `.js` (ex: `import { portalService } from '../services/portalService.js'`).
2. **Tipagem de Multer e Arquivos**: O middleware `multer` adiciona `req.file` e `req.files`. Assegurar tratamento com asserção segura de tipo (`req.file as Express.Multer.File | undefined`) e checagem de nulidade antes de acessar `path` ou `buffer`.
3. **Tipagem de Retorno do SQLite**: As chamadas do `node:sqlite` (`db.prepare(...).get(...)` e `.all(...)`) retornam tipo `unknown`. Sempre converter com `as any` ou tipagem explícita (ex: `as TaxGuideItem[]`).
4. **Sem Tipos Circulares**: Evitar importação cruzada entre `portalController`, `portalService`, `routes/api` e `db`.
5. **Tipagem Estrita de Express Handlers**: Todo método do controlador deve possuir a assinatura `async method(req: Request, res: Response): Promise<void | Response>` ou `(req: AuthenticatedRequest, res: Response)`.

### 6.2 Comando de Verificação Automatizada
Para verificar a integridade da compilação:
```bash
# Teste de compilação estrita do backend
npm run build --prefix server

# Ou diretamente via TypeScript Compiler:
npx tsc --project server/tsconfig.json --noEmit
```

---

## 7. Próximos Passos & Handoff para Implementação

Com este plano estrutural e de tipagem finalizado:
1. **M1 Implementer** receberá os 3 planos (M1 Explorer 1 para DDL/Migrations, M1 Explorer 2 para `portalService.ts`, M1 Explorer 3 para `portalController.ts`, `routes/api.ts` e Build).
2. A implementação integrará o controlador e rotas de forma coesa e limpa, validada imediatamente por `npm run build --prefix server`.
