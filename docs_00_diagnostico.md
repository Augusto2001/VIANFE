# DIAGNÓSTICO TÉCNICO & ARQUITETURA INICIAL (CAMADA 0)
**Projeto:** VIANFE_ERP_BPO  
**Data:** 25 de Agosto de 2026  
**Ambiente:** Windows / Node.js 24 / SQLite (WAL) / Google Drive (G:)

---

## 1. Visão Geral do Sistema Atual (DF-e Hub / ViaNfe)
O sistema atual opera como um concentrador fiscal multi-empresa com as seguintes responsabilidades principais:
1. Conectar via mTLS (Certificado A1) aos WebServices da SEFAZ Nacional (NFeDistribuicaoDFe).
2. Baixar lotes de NF-e/CT-e emitidos contra os CNPJs dos clientes.
3. Interpretar o XML fiscal, extrair itens, impostos, duplicatas/faturas e gerar DANFE em PDF.
4. Salvar os arquivos fiscais estruturados localmente e na nuvem (G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS).
5. Fornecer visualização em dashboard web e API RESTful.

---

## 2. Como Funciona a Captura SEFAZ (Distribuição DF-e)

### 2.1. Fluxo de Comunicação & mTLS
- **Endpoint Produção:** https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
- **Autenticação:** SOAP 1.2 sobre HTTPS com certificado digital cliente (mTLS).
- **Criptografia & Certificados:** Os arquivos .pfx são descriptografados e carregados via 
ode-forge (pfxLoader.ts), o que permite compatibilidade total com certificados emitidos por Autoridades Certificadoras brasileiras (compatível com cifras legadas RC2-40/3DES e novas AES).
- **Parâmetros da Mensagem:** O XML SOAP encapsula o CNPJ da empresa, o código UF da SEFAZ (ex.: 29 para BA, 35 para SP) e o tipo de consulta:
  - <distNSU><ultNSU>...</ultNSU></distNSU>: Consulta sequencial de lotes.
  - <consNSU><NSU>...</NSU></consNSU>: Consulta pontual de um NSU específico.
  - <consChNFe><chNFe>...</chNFe></consChNFe>: Consulta pontual por Chave de Acesso de 44 dígitos.

### 2.2. Controle de NSU & Paginação
- Cada empresa na tabela companies possui a coluna last_nsu (15 dígitos com zeros à esquerda).
- Ao enviar uma requisição <distNSU>, a SEFAZ retorna:
  - cStat = 138 (Documentos localizados): Retorna até 50 documentos compactados em GZip (docZip), além dos ponteiros ultNSU (último NSU do lote) e maxNSU (maior NSU disponível no fisco).
  - cStat = 137 (Nenhum documento localizado): Indica que o ultNSU informado já está em dia com a SEFAZ.
- **Falha Identificada no Código Antigo:** As consultas rodavam com intervalos curtos (1,5s a 2s), sem fila sequencial por empresa, sem trava horária e descartavam resumos fiscais (esNFe), gerando salto de NSU sem salvar as notas.

---

## 3. Diagnóstico do Módulo Financeiro Existente

### 3.1. Importação do Plano de Contas
- **Problema Diagnosticado:** A interface anterior disponibilizava apenas uma caixa de texto (<textarea>) para "colar" o plano de contas.
- **Causa da Falha:**
  1. Planos de contas contábeis de clientes reais possuem de 3 a 10 páginas (centenas de contas). O ato de copiar e colar quebrava formatações, separadores de tabulação e caracteres especiais.
  2. O parser backend tentava apenas fazer line.split(/\s+/), falhando ao identificar códigos reduzidos, contas sintéticas (grupos) vs analíticas (lançáveis) e descrições com espaços.
  3. Não havia tratamento de encoding (ANSI/Windows-1252 vs UTF-8) nem suporte direto aos arquivos de exportação gerados pelo software contábil (Domínio Sistemas).

### 3.2. Conciliação Bancária
- **Problema Diagnosticado:** O motor de conciliação tentava fazer correspondência exata de valor e data entre o extrato OFX e as notas salvas.
- **Causa da Falha:**
  1. Muitas NF-e de entrada são faturadas a prazo em múltiplas duplicatas (ex.: 30/60/90 dias). Sem o desmembramento automático na tabela invoice_installments, o valor da nota (ex.: R$ 3.000) nunca batia com a parcela no extrato (R$ 1.000).
  2. Divergência de datas: a data de emissão/vencimento da duplicata raramente coincide com a data exata da compensação bancária (fins de semana, feriados, D+1 de boletos). Faltava uma tolerância temporal (±3 a 5 dias) e algoritmo de score de confiança.

---

## 4. Integração com Domínio Sistemas (Roadmap)
- **Formato Pretendido:** Arquivo de texto estruturado para importação no módulo **Contabilidade do Domínio Sistemas** (formato padrão de lançamentos contábeis).
- **Campos Obrigatórios:**
  - Código da Empresa no Domínio
  - Data do Lançamento (DD/MM/AAAA)
  - Código da Conta Débito (analítica)
  - Código da Conta Crédito (analítica)
  - Valor do Lançamento
  - Código do Histórico Padrão / Histórico Completo
  - Número do Documento / Chave da NF-e
- **Requisito Crítico:** Toda a amarração depende de um Plano de Contas válido importado na Camada 2 para que os lançamentos conciliados (Camada 5) sejam convertidos em partidas dobradas válidas.

---

## 5. Arquitetura de Backup no Google Drive
- **Mecanismo:** Integração direta com a unidade virtual do Google Drive para Desktop (G:\Meu drive).
- **Mapeamento:** O módulo driveFolderMatcher.ts localiza automaticamente a pasta do cliente em G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS através do CNPJ ou de comparação fonética/fuzzy no nome da pasta.
- **Estrutura Criada:**
  `
  G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\[NOME DA EMPRESA]\
  └── SETOR FISCAL\
      └── NFe\
          └── [ANO]\
              └── [MÊS]\
                  ├── Entradas\
                  │   ├── XMLs\ (chave.xml)
                  │   └── PDFs\ (DANFE_chave.pdf)
                  └── Saidas\
                      ├── XMLs\
                      └── PDFs\
  `
- **Resiliência:** Caso a unidade G: não esteja conectada, o sistema faz fallback transparente para a pasta local server/storage.

---

## 6. Reprodução e Causa Raiz: "Consumo Indevido" (Amesfer e Churrascaria)

### 6.1. Rejeição Exata da SEFAZ
- **Código:** cStat = 656
- **Mensagem Oficial:** "Rejeicao: Consumo Indevido (Deve ser utilizado o ultNSU nas solicitacoes subsequentes. Tente apos 1 hora)" ou "Rejeicao: Consumo Indevido (Deve ser aguardado 1 hora para efetuar nova solicitacao caso nao existam mais documentos a serem pesquisados. Tente apos 1 hora)".

### 6.2. Causa Raiz Comprovada
1. **Descarte de Resumos (esNFe):**
   - Na arquitetura da SEFAZ Nacional (NT 2014.002), quando um fornecedor emite uma NF-e, a SEFAZ disponibiliza inicialmente ao destinatário um **Resumo da NF-e (esNFe)**.
   - O código anterior continha: if (doc.isSummary) continue;. Ele ignorava o XML de resumo, mas a resposta da SEFAZ avançava o ponteiro ultNSU para o valor do lote.
   - Resultado: O sistema atualizava last_nsu no banco de dados sem gravar as notas. Nas chamadas seguintes, ao atingir maxNSU, a SEFAZ rejeitava com cStat 656 exigindo 1 hora de espera, e as notas pareciam ter "sumido" (caso da Churrascaria após 20/07/2026).
2. **Consultas sem Fila e Fora da Madrugada:**
   - Disparos manuais e automáticos ocorriam simultaneamente ao longo do dia comercial, gerando concorrência e requisições repetidas para o mesmo NSU sem respeitar o tempo de carência da SEFAZ.

---

## 7. Conclusão da Camada 0
A infraestrutura base está diagnosticada, a pasta C:\VIANFE_ERP_BPO foi provisionada com suas subpastas operacionais e os 10 prompts do projeto foram preservados em docs\prompts.md.

O sistema está pronto para a implementação da **Camada 1 (Captura SEFAZ Robusta: Janela 01:00-03:00, avanço estrito de NSU, backoff de 1h e fila sequencial)**.
