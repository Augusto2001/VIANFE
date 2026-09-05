# VIANFE_ERP_BPO - ROTEIRO DE EVOLUÇÃO EM 10 PROMPTS

## PROMPT 0 — SETUP + DIAGNÓSTICO
Você é um engenheiro de software sênior. Vamos evoluir, em camadas, o sistema vianfe (DF-e Hub) — um capturador de notas fiscais via SEFAZ (certificado A1 / mTLS) com backup no Google Drive — para um ERP de BPO Financeiro multi-cliente chamado VIANFE_ERP_BPO.

REGRAS GLOBAIS:
- Tudo em português do Brasil (código, comentários, telas, relatórios).
- Reaproveite o que já existe e funciona. Não reescreva o que está funcionando.
- Trabalhe uma camada por vez. Ao terminar: teste, escreva um .md de documentação em docs\, e PARE para validação.
- Estude o código antes de escrever qualquer coisa. Nada de suposição.
- Nunca apague dados ou arquivos do cliente. Tudo aditivo e reversível.
- Credenciais (certificado, tokens) sempre em .env, nunca no código.

TAREFA:
1. Crie a pasta C:\VIANFE_ERP_BPO com as subpastas src\, docs\, data\, logs\, exports\.
2. Localize e estude todo o código atual do vianfe. Documente em docs\00_diagnostico.md:
   - Como funciona hoje a captura SEFAZ (Distribuição de DF-e): controle de NSU, intervalo entre chamadas, tratamento de rejeições.
   - O módulo financeiro que já existe: por que a importação do plano de contas só aceita "colar" e dá erro, e por que a conciliação bancária falha.
   - O ponto do roadmap que fala em devolver lançamentos para o Domínio Sistemas: qual formato é pretendido.
   - Como é feito o backup no Google Drive.
3. Reproduza e documente o erro de "consumo indevido / ingestão indevida" que ocorreu nas empresas Amesfer e Churrascaria (notas recebidas não foram entregues). Registre o código de rejeição exato da SEFAZ e a causa provável.
4. Entregue o docs\00_diagnostico.md e PARE.

---

## PROMPT 1 — CAPTURA SEFAZ ROBUSTA
1. Janela de execução: consultas à SEFAZ (Distribuição de DF-e) entre 01:00 e 03:00 (Brasília).
2. Correção da causa raiz do consumo indevido (cStat 656, avanço de ultNSU, backoff de 1h para 137/656, fila sequencial).
3. Reprocessar Amesfer e Churrascaria com a nova lógica.
4. Logs de auditoria estruturados.
5. Documentar em docs\01_captura_sefaz.md.

---

## PROMPT 2 — IMPORTAÇÃO REAL DO PLANO DE CONTAS
1. Upload de arquivo (.csv, .xlsx e export do Domínio).
2. Parser robusto (encoding, delimitador, validação sintética/analítica).
3. Tela de pré-visualização e mapeamento de colunas.
4. Relatório linha a linha de importação.
5. Multi-CNPJ.
6. Documentar em docs\02_plano_de_contas.md.

---

## PROMPT 3 — CONTAS A PAGAR
1. Extração de duplicatas/cobrança das NF-e de entrada.
2. Agenda de contas a pagar por vencimento.
3. Categorização automática por fornecedor → plano de contas.
4. Status dos títulos.
5. Documentar em docs\03_contas_a_pagar.md.

---

## PROMPT 4 — CONTAS A RECEBER + ASAAS
1. Integração API Asaas (sandbox e produção via .env).
2. Sincronização de cobranças, boletos e webhooks.
3. Espelhamento em Contas a Receber.
4. Baixa e conciliação automática.
5. Documentar em docs\04_contas_a_receber_asaas.md.

---

## PROMPT 5 — CONCILIAÇÃO BANCÁRIA
1. Importação de extratos OFX / Open Finance.
2. Motor de matching automático com CP e CR.
3. Baixa de títulos conciliados e conciliação manual.
4. Relatório de pendências.
5. Documentar em docs\05_conciliacao_bancaria.md.

---

## PROMPT 6 — EXPORTAÇÃO PARA O DOMÍNIO SISTEMAS
1. Geração de arquivo de lançamentos no layout do Domínio.
2. De/Para contábil usando o plano de contas importado.
3. Validação de partidas dobradas e contas válidas.
4. Salvar em C:\VIANFE_ERP_BPO\exports\.
5. Documentar em docs\06_exportacao_dominio.md.

---

## PROMPT 7 — CADASTRO DE CLIENTE/EMPRESA + CONTATO
1. Cadastro completo com CNPJ, regime e certificado digital A1.
2. Contato com primeiro nome, tratamento, e-mail e WhatsApp.
3. Segregação multi-tenant rigorosa.
4. Documentar em docs\07_cadastro_cliente.md.

---

## PROMPT 8 — RELATÓRIOS, GRÁFICOS E ENVIO SEMANAL (ZapCont)
1. Dashboards de CP, CR, Fluxo de Caixa e Inadimplência.
2. Relatório semanal automático personalizado enviado por WhatsApp e E-mail.
3. Integração ZapCont (Meta API Oficial, templates HSM aprovados, rate limit e mídia).
4. Logs com request_id e histórico de disparos.
5. Documentar em docs\08_relatorios_envio.md.

---

## PROMPT 9 — ORQUESTRAÇÃO E AUTOMAÇÃO
1. Agendador mestre com janela 01-03h + disparos semanais + sync Asaas.
2. Painel de saúde e observabilidade operacional.
3. Backup do banco de dados do ERP.
4. Documentar em docs\entrega_final.md com ciclo ponta a ponta.
