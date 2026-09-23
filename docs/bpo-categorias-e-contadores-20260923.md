# Conciliação: categorias e totais — 23/09/2026

## Correções

- Os cartões e contagens das abas usam o total da empresa, independentemente da aba. A aba filtra somente as linhas. Sem lançamentos, o percentual é zero; falha de carregamento aparece como indisponibilidade.
- “Nova categoria…” abre cadastro no próprio lançamento e seleciona o resultado. Categorias pertencem ao escritório autenticado. Há tipos receita, despesa, empréstimo/financiamento, transferência, imposto e folha; nenhum mapeamento contábil é inventado.
- Contas do plano Domínio deixam de ser oferecidas como IDs de categorias financeiras. A API recusa referências inválidas e verifica a empresa/tenant nas operações alteradas.
- Importação de plano rejeita PDF/binário/nomes ilegíveis, valida antes de substituir e usa transação com rollback. UTF-8 e Windows-1252 são tratados explicitamente na leitura do arquivo.
- Nomes previamente corrompidos são sinalizados. Não há limpeza automática de registros históricos. Mapeamento automático bloqueado enquanto houver nomes ilegíveis.
- Exportação sem débito/crédito configurados falha com mensagem; não usa contas genéricas. “Conciliado no ViaNFe” não significa gravado no Domínio.

## Validação

`node server/tests/bpo-reconciliation.cjs` usa SQLite em memória: 978 lançamentos / 29 conciliados / 949 pendentes, abas consistentes, tenant, cadastro, duplicidade, categoria inválida, exportação sem mapeamento e preservação/rollback do plano.

O argumento opcional de caminho CSV testa a importação de um plano real em memória, comparando código, classificação, nome, tipo e natureza de todas as linhas. Os arquivos privados não pertencem ao Git.

`tools/extract_dominio_chart.py INPUT.pdf OUTPUT.csv` (Python + pdfplumber) converte somente o layout Código/T/Classificação/Nome/Grau, com validação de todas as linhas, páginas, CNPJ, grau e códigos únicos. Natureza ausente permanece vazia. Classificações repetidas exigem revisão e opção explícita `--allow-source-duplicate-classifications`; o manifesto registra origem e hashes. Isso não habilita upload de PDF direto no importador de planos.

## Limites

Esta entrega não homologa o layout completo de exportação do Domínio nem prova isolamento de todas as rotas do produto. Categorias e seus mapeamentos continuam no nível do escritório; mapeamento por empresa é uma evolução separada. A natureza financeira de um empréstimo não é decidida apenas pelo sinal do extrato.

Publicação e recuperação dos dados devem ser registradas após execução, distinguindo testes, versão e efeito real.
