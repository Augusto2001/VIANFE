# ViaNFe — versão operacional 1.10

Registro atualizado em 23/10/2026, fuso America/Sao_Paulo, por solicitação do proprietário.

Leia o relatório atual: [versão 1.10 — Importador de Plano de Contas Domínio (Largura Fixa) e Ingestão BPO](versoes/1.10.md). Histórico: [versão 1.9](versoes/1.9.md), [versão 1.8](versoes/1.8.md), [versão 1.2](versoes/1.2.md).

- **1** identifica a proposta funcional registrada nesta série: emissão segura de NFS-e, captura fiscal DFe e integrações autenticadas.
- **10** identifica dez rodadas de ajustes posteriores à implementação inicial.
- Não é uma reconstrução da numeração histórica do produto. O `1.0.0` dos pacotes npm é uma versão técnica anterior, sem esse significado operacional.
- Base anterior: `432181c22cbf773d6bd3e98468e3e4f3cbd5b3f2`. Commit atual publicado: `84a4e9410bf2f9ce457af9dcaba4befcc1fd5c44`. Para o commit atual, conferir GitHub/main e a revisão da imagem ativa na Oracle.
- Metadados para ferramentas: [versao-operacional.json](../versao-operacional.json).

## Regra para todas as IAs

Antes de afirmar o estado atual, comparar GitHub/main, HEAD da Oracle e label `org.opencontainers.image.revision` da aplicação ativa. Ler também `AGENTS.md` e `docs/NFSE_EMISSAO_SEGURA.md`.

Uma nova proposta funcional recebe próximo número principal (`2.0`). Uma rodada de correções desta proposta recebe próximo ajuste (`1.10`). Não contar arquivos, mensagens, tentativas de comando ou testes como versões. Atualização apenas documental incrementa `revisao_documental`, mantendo a versão funcional. Registrar cada rodada com commit, testes, publicação e limitações.

Publicado não significa homologado integralmente. Evernote é espelho de consulta; GitHub é a fonte versionada. Não usar documentos antigos ou exportações do n8n como prova da produção atual.
