# 🚀 ViaNfe | Super App Viacont — Ecossistema Fiscal, BPO Financeiro & PWA Mobile

> **Plataforma Enterprise de Gestão Fiscal, Inteligência Tributária, Conciliação Bancária com Open Finance e Área do Cliente PWA Mobile-First desenvolvida para a Viacont e seus clientes.**

[![Production](https://img.shields.io/badge/Status-100%25%20Em%20Produção-059669?style=for-the-badge)](https://vianfe.contadordev.com.br)
[![PWA](https://img.shields.io/badge/Mobile-PWA%20Ready-0284c7?style=for-the-badge)](https://vianfe.contadordev.com.br)
[![SSL](https://img.shields.io/badge/Security-Let%27s%20Encrypt%20SSL-10b981?style=for-the-badge)](https://vianfe.contadordev.com.br)

---

## 🌐 Acesso em Produção (Oracle Cloud VPS)
- **Super App & Painel Principal**: [https://vianfe.contadordev.com.br](https://vianfe.contadordev.com.br)
- **Nginx Proxy Manager**: [https://painel.contadordev.com.br](https://painel.contadordev.com.br)
- **Motor de Automações n8n**: [https://n8n.contadordev.com.br](https://n8n.contadordev.com.br)
- **Relay SEFAZ mTLS**: [https://sefaz-relay.contadordev.com.br](https://sefaz-relay.contadordev.com.br)

---

## 📱 Principais Módulos do Sistema

### 1. 📱 Super App Viacont (PWA Mobile & Desktop)
- **Instalação Nativa em 1-Clique**: Suporte a Progressive Web App (PWA) para Android (Chrome) e iOS (Safari).
- **Atalhos Rápidos (App Shortcuts)**:
  - ⚡ *Emitir Nota Fiscal Relâmpago (NFS-e & NF-e em 3 passos)*
  - 💳 *Pagar Impostos PIX (DAS, ICMS, FGTS com Copia-e-Cola)*
  - 📷 *Scanner OCR de Recibos & Cupons com Câmera*
  - ⏱️ *Radar de Caixa 48h com Previsões Financeiras*

### 2. 🏦 BPO Financeiro & Conciliação Bancária Lado a Lado
- **Open Finance Plug & Play**: Webhook dedicado por empresa para ingestão de extratos bancários em tempo real (Inter PJ, Cora, Asaas, Nubank PJ, Itaú, Bradesco, Santander).
- **Importador de Extratos OFX & PDF**: Leitura e parsing automático de extratos bancários com inteligência anti-duplicação.
- **Auto-Match Inteligente**: Cruzamento automático com notas fiscais de entrada e parcelas de contas a pagar.

### 3. 📑 Mapeador & Exportador Domínio Sistemas
- **Auto-Mapeamento Contábil**: Vinculação automática de categorias financeiras com o plano de contas contábil da Domínio Sistemas.
- **Exportador Oficial em Arquivo TXT**: Geração de arquivo de lançamentos contábeis no layout oficial da Domínio Sistemas para importação instantânea.

### 4. 📲 Radar de Alertas Preditivos no WhatsApp (48h)
- **Varredura Preditiva**: Identificação de contas a pagar e guias tributárias a vencer em até 48 horas.
- **Assistente Viviane**: Geração e disparo matinal diário às **09:30 AM BRT** de mensagens personalizadas no WhatsApp com código PIX e resumo das guias.

### 5. 📊 Painel de Sucesso Empresarial & DRE em Tempo Real
- **+30 KPIs Estratégicos**: Margem Bruta, Margem EBITDA, Margem Líquida, Ponto de Equilíbrio, PMR, PMP e Giro de Estoque.
- **Radar de Risco Fiscal**: Cruzamento de vendas em cartões/PIX contra faturamento emitido em notas fiscais.
- **Exportação Timbrada**: Botão para impressão e geração de relatório executivo em PDF formato A4.

### 6. 🤖 Robô Autônomo SEFAZ & Sincronização Google Drive 24/7
- **Janela Noturna Estrita (01:00 às 03:00 BRT)**: Varreduras automáticas na SEFAZ Nacional para captura de NF-e e manifestação do destinatário.
- **Backup no Google Drive**: Sincronização periódica a cada 30 minutos em estrutura organizada de pastas por Ano e Mês.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite v6, Tailwind CSS, Lucide Icons, Canvas Confetti |
| **PWA** | Service Worker (sw.js), Web App Manifest, Cache First Offline |
| **Backend** | Node.js 22, Express, TypeScript, SQLite Nativo (WAL mode), node-cron |
| **Fiscal / DF-e** | Fast-XML-Parser, PDFKit (DANFE/DANFSE), Gotenberg PDF Engine |
| **Infraestrutura** | Oracle Cloud OCI, Docker Compose, Nginx Proxy Manager, SSL Let's Encrypt |

---

## 📦 Execução Local

`ash
# Instalação
npm install
npm install --prefix server
npm install --prefix client

# Execução Integrada
npm run dev
`

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

---

## 📄 Licença
Propriedade exclusiva do ecossistema **Viacont Contabilidade Inteligente & ViaNfe**. Todos os direitos reservados.
