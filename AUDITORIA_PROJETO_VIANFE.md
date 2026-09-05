# 📑 RELATÓRIO TÉCNICO PARA AUDITORIA DE PROJETO — VIANFE POR VIACONT

**Instruções para o Auditor (ChatGPT / Claude / IA Auditora)**:
Este documento contém a especificação técnica completa, arquitetura, stack tecnológico, banco de dados, recursos concluídos e próximos módulos da plataforma **ViaNfe por Viacont**. Por favor, realize a auditoria geral do projeto com base nas informações abaixo.

---

## 🏛️ 1. IDENTIFICAÇÃO DO PROJETO
- **Nome Oficial**: ViaNfe por Viacont
- **Empresa Mantenedora**: Viacont Inovações Contábeis
- **Propósito**: Plataforma de Inteligência Fiscal, Automação SEFAZ DFe, Gestão Multi-Empresa/Multi-Escritório, Emissão de NFS-e Municipal e BPO Financeiro.

---

## 💻 2. STACK TECNOLÓGICO & INFRAESTRUTURA
- **Frontend**: React 18, Vite 6, TailwindCSS v3, TypeScript v5, Lucide Icons, Canvas Confetti.
- **Backend API**: Node.js 24 LTS, Express.js, TypeScript, Multer, `jsonwebtoken`, `bcryptjs`.
- **Banco de Dados**: SQLite em Modo WAL (`node:sqlite` nativo), desacoplado em SQL relacional padrão para migração transparente para PostgreSQL.
- **Criptografia e Certificados A1**: `node-forge` PKCS#12 loader para descriptografia de certificados A1 legados (Serpro, Soluti, Certisign RC2/3DES) no Node 24.
- **Geração de Documentos**: Engine interna de PDFKit para geração de DANFE e NFS-e em PDF.
- **Segurança & Hardening**:
  - `build.sourcemap: false` (Zero SourceMaps no Vite build, impedindo F12 DevTools de inspecionar código-fonte).
  - Middleware Rate Limiting Anti-Brute Force no login por IP.
  - HTTP Security Headers (HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- **Automações**: Integrado a Webhooks do n8n / Evolution API para recepção e resposta via WhatsApp.

---

## 🏢 3. ARQUITETURA MULTI-TENANT (MULTI-ESCRITÓRIO CONTÁBIL)
- **Tabela `tenants`**: Suporta múltiplos escritórios contábeis independentes (Tenant Master: `tenant_viacont_master`).
- **Tabela `users`**: Usuários vinculados por `tenant_id` com papéis `admin` (Escritório) vs `client` (Cliente Final da Empresa).
- **Tabela `user_companies`**: Matriz de permissão limitando estritamente quais empresas cada usuário cliente pode acessar.

---

## 🟢 4. LISTA DO QUE JÁ TEMOS 100% CONCLUÍDO E ATIVO (✅)

1. ✅ **Captura SEFAZ DFe em Loop por NSUs**: Varredura sequencial até 90 dias atrás sem travar nos limites da SEFAZ.
2. ✅ **Organização Nativa no Google Drive `G:`**:
   `G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\[CLIENTE]\SETOR FISCAL\NFe\[ANO]\[MÊS]\`
   - Divisão em subpastas `Entradas\XMLs` & `PDFs` e `Saidas\XMLs` & `PDFs`.
   - Renomeação automática de pastas antigas `NF` para `NFe`.
3. ✅ **Geração Automática de DANFE em PDF**: Salvos nativamente na estrutura do Drive.
4. ✅ **Manifestação do Destinatário SEFAZ**: Ciência (`210210`), Confirmação (`210200`), Desconhecimento (`210220`) e Recusa (`210240` com justificativa).
5. ✅ **Tela de Login JWT & Gestão de Logins**: Interface de acesso seguro e modal de atribuição de permissões aos clientes (`UsersModal`).
6. ✅ **Painel ViaAnalytics & Radar Fiscal**:
   - Ticker em tempo real do processamento de XMLs (`⚡ 1.450 docs/min`).
   - Radar de Omissão de Receitas (alerta preventivo de malha fina SEFAZ).
   - Curva ABC 80/20 de fornecedores e suprimentos.
   - Indicadores de Lucro no Estoque e Estoque Descoberto (Risco de Ruptura).
   - Envio de Convites de Acesso por E-mail com Token de Definição de Senha.
7. ✅ **Emissão & Ingestão de NFS-e Municipal**:
   - Prefeituras de Salvador, Feira de Santana, Lauro de Freitas, São Gonçalo dos Campos, Curitiba e Portal Nacional ADN (`nfse.gov.br`).
8. ✅ **Integração n8n / WhatsApp Webhook**:
   - Endpoint `POST /api/portal/nfse/webhook-whatsapp` para receber solicitações de emissão via WhatsApp e devolver o PDF e confirmação.
9. ✅ **Blindagem de Segurança (Prioridade 1)**: Zero SourceMaps, Anti-DevTools, Anti-Brute Force e HTTP Headers.
10. ✅ **Automação de Deploy na Nuvem (Prioridade 2)**: Script `deploy_oracle_cloud.sh` e guia para Oracle Cloud Always Free com Nginx, PM2 e SSL/HTTPS Grátis.

---

## 🔴 5. LISTA DO QUE TEREMOS (PRÓXIMAS ETAPAS DO ROADMAP) (❌)

1. ❌ **Execução do Deploy na Nuvem (Prioridade 2)**: Colocar em produção 24/7 na Oracle Cloud com HTTPS.
2. ❌ **Módulo Financeiro Estilo Conta Azul (Prioridade 3)**:
   - Contas a Pagar e Contas a Receber vinculados às NF-e.
   - Fluxo de Caixa Diário / Semanal / Mensal.
   - Importador de Extratos OFX e PDF bancários com Motor de Match Score (%).
   - Importador de Folha de Pagamento & Encargos Sociais.
3. ❌ **Exportação Contábil para o Domínio Sistemas (Prioridade 4)**:
   - Gerador de arquivo `.TXT` no layout oficial de Lançamentos Contábeis Thomson Reuters.
   - Demonstrativos Contábeis (Balancete de Verificação, Balanço Patrimonial e DRE).
4. ❌ **Inteligência Contábil Estilo Nucont (Prioridade 5)**:
   - Análise Vertical e Horizontal, Índices de Liquidez Corrente, Capital de Giro Líquido e EBITDA.
   - Importação de relatórios contábeis retornados do Domínio Sistemas.
5. ❌ **App Mobile PWA & BPO Financeiro (Prioridade 6)**:
   - App Mobile PWA do cliente com captura por foto de recibos/despesas (OCR).
   - Portal do Operador de BPO Financeiro e Trava de Fechamento Freemium.

---

## 📂 6. LOCALIZAÇÃO DOS ARQUIVOS DO PROJETO
- **Código-Fonte Completo**: `C:\app_xml_antigravity`
- **Backup de Segurança**: `C:\Users\USER\.gemini\antigravity\backups\app_xml_antigravity`
- **Script de Backup Diário**: `npm.cmd run backup`
- **Arquivo de Workflow n8n**: `C:\app_xml_antigravity\vianfe_n8n_whatsapp_workflow.json`
- **Script de Deploy Oracle Cloud**: `C:\app_xml_antigravity\deploy_oracle_cloud.sh`
