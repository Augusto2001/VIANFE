# Relatório Oficial de Auditoria: Automação do Fluxo de Renovação de Certificados Digitais A1

**Data:** 18 de Novembro de 2026  
**Empresa Cedente da Cobrança:** AG7 CONSULTORIA EDUCACAO E MARKETING LTDA (CNPJ: 49.216.709/0001-18)  
**Escritório Contábil:** Viacont Soluções Contábeis  
**Alçada Financeira:** Val (Diretoria Financeira)  
**Alçada Técnica & Emissão TI:** Eduardo dos Santos (TI Viacont)  
**Motor de Inteligência & Mensageria:** Viviane AI (ZapCont Meta Cloud API Oficial)  
**Ambiente de Produção:** Oracle VPS (168.138.127.199) • Container `viaos` (https://entregas.viacont.com.br)

---

## 1. Visão Geral da Arquitetura do Fluxo Integrado

Foi desenhado e implementado um **Fluxo de Ordem de Serviço em Duas Etapas Conectadas (2 tarefas em 1)** para a renovação de Certificados Digitais A1:

```
[ Viviane AI Detecta Vencimento <= 30 dias ]
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: FINANCEIRO (Responsável: Val)                       │
│ - Viviane AI emite cobrança/boleto/PIX via conta AG7       │
│ - Valor Padrão: R$ 179,00 (Certificado A1 PJ)               │
│ - Disparo automático no WhatsApp do cliente                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
                    [ Cliente Paga Boleto/PIX ]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TRANSIÇÃO AUTOMÁTICA (Gatilho de Liquidação)                │
│ - Val / Webhook confirma o recebimento na conta AG7         │
│ - Sistema transfere a OS imediatamente para o TI           │
│ - Notifica Eduardo dos Santos no WhatsApp com dados da OS  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: TI (Responsável: Eduardo dos Santos)                │
│ - Eduardo agenda videoconferência de validação com o cliente│
│ - Emissão do arquivo .pfx do Certificado Digital A1         │
│ - Guarda segura no Google Drive oficial do Setor Legal      │
│ - Atualização da validade no sistema (+365 dias)            │
│ - Tarefa finalizada com status CONCLUIDA                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Componentes Técnicos Implementados

1. **`app/src/services/renovacaoCertificadosFluxo.js`**:
   - `iniciarFluxoRenovacao()`: Gera a OS no banco `core.tarefas`, atribui a **Val** no Financeiro, formata a linha digitável e o PIX Copia-e-Cola da **AG7**, e dispara o WhatsApp para o cliente.
   - `confirmarPagamentoCliente()`: Registra a liquidação, transita o fluxo para a Fase 2, transfere a titularidade para **Eduardo dos Santos** (TI) e dispara notificação em seu WhatsApp para agendamento da emissão.
   - `concluirEmissaoTI()`: Registra a videoconferência, o arquivo `.pfx`, calcula a nova validade de 1 ano (+365 dias) e transita a tarefa para `CONCLUIDA`.
   - `listarFluxos()`: Consulta e sumariza as OSs ativas e seus respectivos estágios.

2. **`app/src/routes/renovacaoCertificados.js`**:
   - `POST /api/certificados/iniciar`: Disparo da abertura do fluxo.
   - `POST /api/certificados/confirmar-pagamento`: Confirmação da liquidação pela Val ou webhook bancário da AG7.
   - `POST /api/certificados/concluir-emissao`: Conclusão técnica e arquivamento pelo Eduardo (TI).
   - `GET /api/certificados/fluxos-ativos`: Listagem em tempo real das ordens de serviço.

3. **`app/src/routes/fluxos.js`**:
   - Cadastro canônico do `FLUXO_CERTIFICADO_DIGITAL_A1` no catálogo de fluxos do ViaOS.

4. **`app/src/routes/auth.js` & `app/src/server.js`**:
   - Liberação de rotas de webhook com proteção via secret (`X-ViaOS-Secret`) e montagem do router `/api/certificados`.

---

## 3. Evidência de Teste Ponta a Ponta em Produção (Oracle VPS)

O teste de validação real executado no container `viaos` contra o banco PostgreSQL `viaos_prod` apresentou o seguinte resultado:

* **OS Aberta:** `VO-2026-CERT-1325`
* **Empresa:** `RWM FARMACIA PRECO CERTO` (CNPJ: `18.397.669/0001-44`)
* **Fase 1 (Financeiro):**
  - Responsável: **Val**
  - Cedente: **AG7 CONSULTORIA EDUCACAO E MARKETING LTDA** (CNPJ: `49.216.709/0001-18`)
  - Valor: **R$ 179,00**
  - Chave PIX: `49216709000118`
  - Código PIX Copia-e-Cola e Linha Digitável gerados e validados.
* **Transição (Gatilho de Pagamento):**
  - Confirmado por: `Val (Diretoria Financeira)`
  - Novo Responsável: **Eduardo dos Santos (TI)**
  - Nova Fase: `TI_AGENDAMENTO_E_EMISSAO`
  - Notificação WhatsApp para Eduardo dos Santos disparada.
* **Fase 2 (Conclusão TI):**
  - Emitido por: **Eduardo dos Santos**
  - Nova Validade: **18/11/2027** (+365 dias)
  - Arquivo PFX: `CERTIFICADO_A1_RWM_PRECO_CERTO_2026_2027.pfx`
  - Status Final: **`CONCLUIDA`**

---

## 4. Diretórios de Guarda Oficial no Google Drive

* **Certificados Válidos:** `G:\Meu drive\SETORES\SETOR LEGAL\CERTIFICADOS DIGITAIS\CERTIFICADOS VÁLIDOS\<EMPRESA>`
* **Relatórios de Automação:** `G:\Meu drive\SETORES\SETOR AUTOMACAO`
* **Sigilo e Senhas:** As senhas dos certificados permanecem protegidas por criptografia AES-256 no banco e **nunca** são expostas em texto puro.
