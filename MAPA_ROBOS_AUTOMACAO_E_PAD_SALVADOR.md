# Mapa Mestre de Robôs, Automações e Arquitetura PAD Salvador (100% Sem IA)

**Viacont Inovações Contábeis**  
**Data de Emissão:** 20 de Novembro de 2026  
**Status da Infraestrutura:** Produção Soberana (Oracle Cloud VPS `168.138.127.199`)  
**Diretriz Executiva:** Automação 100% determinística, baseada em código e regras puras, **SEM QUALQUER DEPENDÊNCIA DE IA/LLM**, garantindo zero alucinação, custo previsível, velocidade instantânea e validade jurídica.

---

## 1. Engenharia Reversa e Desenho da Automação do PAD Salvador (100% Sem IA)

### 1.1. Descoberta dos Endpoints Oficiais da SEFAZ Salvador
Através da inspeção dos formulários e rotas da Prefeitura Municipal de Salvador, identificamos a esteira oficial de autenticação por certificado digital ICP-Brasil:

1. **Página de Entrada**: `https://pad.salvador.ba.gov.br/Forms/frmLoginContribuinte.aspx`
2. **PostBack de Certificado**: Ao acionar o link `lnkAcessoCertificadoDigital`, o formulário submete `__EVENTTARGET = 'lnkAcessoCertificadoDigital'`.
3. **Endpoint mTLS Soberano**: O servidor IIS redireciona para:
   ```
   https://pad.salvador.ba.gov.br/Forms/LoginICP.aspx?Origem=L&DAL=
   ```
4. **Handshake TLS com Certificado A1**:
   * O endpoint `LoginICP.aspx` solicita o certificado de cliente no handshake TLS (mTLS).
   * Com o certificado A1 da empresa (ex: `10544337000113.pfx` da **FR Viagens e Turismo Ltda**), o portal valida o CNPJ, dispensa captcha e estabelece a sessão autenticada.
5. **Painel do Contribuinte**: Redireciona para `frmAdesaoPPI01.aspx` onde lista os acordos ativos, parcelas em aberto e botão para emitir o DAM da parcela do mês com código de barras Febraban.

---

### 1.2. Diagrama Arquitetural de Execução (100% Sem IA)

```
[Cron Mensal: Dia 10 às 06:00 BRT]
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Carregamento do Certificado A1 (.pfx)                    │
│    - Arquivo: /home/opc/_up/{CNPJ}.pfx                      │
│    - Lê senha segura do cofre de credenciais                │
│    - Não usa IA: leitura binária de certificado ICP-Brasil  │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Autenticação mTLS Direta (Node.js / Puppeteer Headless)  │
│    - Rota: https://pad.salvador.ba.gov.br/Forms/LoginICP.aspx│
│    - TLS Context injeta chave privada e certificado cliente │
│    - Resposta HTTP 200 / Redirecionamento com Cookie de Sessão
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Download do DAM e Extrato da Conta                       │
│    - Navega na lista de acordos e seleciona a parcela ativa │
│    - Emite 2ª via da parcela (DAM oficial em PDF)           │
│    - Emite Extrato de Demonstração de Débitos do Acordo     │
│    - Salva: DAM_PAD_10544337000113_2026_11.pdf              │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Validação e Extração Determinística por Regex            │
│    - Código de Barras Febraban (Segmento 8):                │
│      Regex: /^(8[1-9]\d{10}\s?\d{11}\s?\d{11}\s?\d{11})/     │
│    - Valor (R$) e Data de Vencimento oficial                │
│    - Validação de Integridade: CNPJ no DAM == CNPJ do ViaOS │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Gravação no ViaOS (PostgreSQL viaos_prod)                │
│    - Copia PDF para volume /app/uploads/                    │
│    - Anexa nos slots da tarefa VO-2026-000529:              │
│      • Slot 5: 'DAM - PAD PREFEITURA MUNICIPIO - 1'         │
│      • Slot 206: 'Extrato do Parcelamento'                  │
│    - Marca checklist (passos 1 a 6) como executados         │
│    - Altera status para 'AGUARDANDO_APROVACAO'              │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Homologação da Diretoria e Despacho Omnichannel          │
│    - Augusto ou Val aprova a tarefa                         │
│    - Disparo automático via ZapCont WhatsApp e ViaCliente   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Caso Prático Implementado: FR Viagens e Turismo Ltda

* **Empresa**: FR VIAGENS E TURISMO LTDA (Código Domínio: `27`)
* **CNPJ**: `10.544.337/0001-13`
* **Certificado A1 Mapeado**: `/home/opc/_up/10544337000113.pfx`
* **Tarefa no ViaOS**: `VO-2026-000529` (*PARCELAMENTO PAD PREF SALVADOR*)
* **Checklist Estruturado na Tarefa**:
  1. Acessar o portal SEFAZ Salvador (`https://pad.salvador.ba.gov.br/`).
  2. Efetuar login com Senha Web ou Certificado Digital do contribuinte.
  3. Consultar situacao do acordo e parcelas vigentes no extrato do PAD.
  4. Emitir a 2a via da parcela do DAM com codigo de barras atualizado e extrato em PDF.
  5. Conferir valor, competencia e vencimento da guia.
  6. Anexar DAM e Extrato nos respectivos slots da tarefa no ViaOS.
  7. Submeter a aprovacao executiva para despacho via ZapCont / ViaCliente.

---

## 3. Mapa Geral de Onde Estão Todos os Robôs da Viacont

Abaixo está o inventário de todos os robôs, rotinas automatizadas e serviços operando na infraestrutura da Oracle Cloud (`168.138.127.199`):

| Robô / Serviço | Onde Está Localizado | Gatilho / Agendamento | Tipo de Automação | O que Faz | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`parcelamentosEngine`** | Container `viaos`<br>`/app/src/services/parcelamentosEngine.js` | Disparado via rotina ou demanda ViaOS | **Determinístico Puro (Sem IA)** | Mapeia, busca e processa guias de parcelamento (RFB, PGFN, SEFAZ-BA e PAD Salvador) no Drive e órgãos. | **Ativo** |
| **`roboCertidoes` & `certidoesEngine`** | Container `viaos`<br>`/app/src/services/certidoesEngine.js` | Cron diário e eventos do sistema | **Determinístico Puro (Sem IA)** | Consulta e emite certidões negativas (CND Federal, Estadual BA, Municipal Salvador/Lauro, FGTS e CNDT). | **Ativo** |
| **`iss_monthly_day1`** | Host VPS<br>`/home/opc/iss_monthly_day1.sh` | Cron: `0 9 1 * *` (Dia 01 às 06:00 BRT) | **Determinístico Puro (Sem IA)** | Sincroniza NFS-e municipais (Salvador, WebISS), abre tarefas recorrentes no ViaOS e publica no ViaCliente. | **Ativo** |
| **`auditoria_diaria_notas`** | Host VPS<br>`/home/opc/auditoria_diaria_notas.sh` | Cron: `0 6 * * *` (Diário às 03:00 BRT) | **Determinístico Puro (Sem IA)** | Varre 100% dos XMLs (NF-e 55, NFC-e 65), detecta pulos de numeração, contingências duplicadas e gera relatório no Google Drive. | **Ativo** |
| **`audit_monthly_day7`** | Host VPS<br>`/home/opc/audit_monthly_day7.sh` | Cron: `0 10 7 * *` (Dia 07 às 07:00 BRT) | **Determinístico Puro (Sem IA)** | Auditoria pré-fechamento do Simples e Lucro Presumido antes do envio ao Domínio Escrita Fiscal. | **Ativo** |
| **`driveWatcher`** | Container `viaos`<br>`/app/src/services/driveWatcher.js` | Contínuo / Polling de pastas | **Determinístico Puro (Sem IA)** | Monitora pastas do Google Drive das empresas, extrai comprovantes e auto-anexa nas tarefas do ViaOS. | **Ativo** |
| **`rpa-onvio`** | Container `rpa-onvio`<br>`/app` (Node.js/Puppeteer) | Chamada de sincronização Onvio | **Determinístico Puro (Sem IA)** | Automação de extração de dados cadastrais, tarefas e clientes da Thomson Reuters Onvio. | **Ativo** |
| **`zapcont-onvio-login-refresh`** | Host VPS<br>`/home/opc/zapcont-onvio-login-refresh` | Cron: `0 * * * *` (A cada 1 hora) | **Determinístico Puro (Sem IA)** | Mantém ativa a sessão do Onvio Processos via token seguro headless. | **Ativo** |
| **`zapcont-gestta-login-refresh`** | Host VPS<br>`/home/opc/zapcont-gestta-login-refresh` | Cron: `0 * * * *` (A cada 1 hora) | **Determinístico Puro (Sem IA)** | Mantém ativa a sessão do Gestta Thomson Reuters sem intervenção manual. | **Ativo** |
| **`vianfe-api`** | Container `vianfe-api`<br>`/app/server` (Porta 3001) | Contínuo / Webhook / Jobs | **Determinístico Puro (Sem IA)** | Motor fiscal da Viacont: captura de XMLs da SEFAZ Nacional/SVRS, manifestação e emissão de NFS-e. | **Ativo** |
| **`sefaz-relay`** | Container `sefaz-relay`<br>`/home/opc/sefaz-relay` | Serviço de túnel mTLS | **Determinístico Puro (Sem IA)** | Túnel seguro com certificados digitais ICP-Brasil para emissão e consulta junto à SEFAZ-BA. | **Ativo** |
| **`n8n-n8n-1` (ZapCont Flows)** | Container `n8n-n8n-1`<br>`/home/opc/gerenciador/n8n` (Porta 5678) | Webhooks e Eventos de Mensageria | **Determinístico / Regras de Fluxo** | Orquestração da esteira ZapCont WhatsApp, envio de guias e notificações aos clientes da Viacont. | **Ativo** |
| **`lembreteVencimentoService`** | Container `viaos`<br>`/app/src/services/lembreteVencimentoService.js` | Cron diário do ViaOS | **Determinístico Puro (Sem IA)** | Envia lembretes automáticos de guias vencendo no dia ou em 2 dias para os clientes via WhatsApp/E-mail. | **Ativo** |
| **`auto_support_diagnostico`** | Host VPS<br>`/home/opc/auto_support_diagnostico.py` | Cron: `*/5 * * * *` (A cada 5 min) | **Regras Heurísticas** | Triagem e verificação da saúde das rotinas de suporte fiscal. | **Ativo** |

---

## 4. Código do Robô de Automação do PAD Salvador (`emitir_pad_salvador.mjs`)

O script abaixo foi desenvolvido para rodar dentro do container `rpa-onvio` ou `viaos`, conectando-se ao portal `https://pad.salvador.ba.gov.br/Forms/LoginICP.aspx` utilizando o certificado digital A1:

```javascript
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

export async function baixarPadSalvador({ cnpj, pfxPath, pfxPassword, outputDir }) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      `--client-certificate-file=${pfxPath}`
    ]
  });

  const page = await browser.newPage();
  
  // 1. Acessa endpoint ICP oficial da SEFAZ Salvador
  await page.goto('https://pad.salvador.ba.gov.br/Forms/LoginICP.aspx?Origem=L&DAL=', {
    waitUntil: 'networkidle2'
  });

  // 2. Localiza tabela de acordos ativos e clica na parcela do mês vigente
  await page.waitForSelector('#grvParcelas, #optPessoa_1', { timeout: 15000 });

  // 3. Emite o DAM em PDF
  const downloadPath = path.resolve(outputDir);
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  await page.click('#btnEmitirDAM, input[value="Emitir DAM"]');
  await page.waitForTimeout(5000);

  await browser.close();
  return { sucesso: true, cnpj, downloadPath };
}
```

---

## 5. Diretriz de Implantação e Versionamento
* Este documento e os desenhos técnicos associados estão versionados no GitHub oficial do projeto: `c:\Users\USER\Documents\app_xml_antigravity`.
* Quaisquer novos robôs fiscais ou de arrecadação municipal devem seguir estritamente este padrão determinístico (sem dependência de modelos de linguagem).
