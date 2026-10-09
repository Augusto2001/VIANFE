# ViaNFe — versão operacional 1.9

Registro atualizado em 09/10/2026, fuso America/Sao_Paulo, por solicitação do proprietário.

Leia o relatório atual: [versão 1.9 — Integração Nativa do Robô SVRS NFC-e (modelo 65)](versoes/1.9.md). Histórico: [versão 1.8](versoes/1.8.md), [versão 1.2](versoes/1.2.md).

- **1** identifica a proposta funcional registrada nesta série: emissão segura de NFS-e, captura fiscal DFe e integrações autenticadas.
- **9** identifica nove rodadas de ajustes posteriores à implementação inicial.
- Não é uma reconstrução da numeração histórica do produto. O `1.0.0` dos pacotes npm é uma versão técnica anterior, sem esse significado operacional.
- Base anterior: `5a97e4862564e34a201c38c17c81e2465c3e8e4a`. Commit atual publicado: `0871dccc23d51561a3dac3d41b14ab33cd2aac8a`. Para o commit atual, conferir GitHub/main e a revisão da imagem ativa na Oracle.
- Metadados para ferramentas: [versao-operacional.json](../versao-operacional.json).

## Regra para todas as IAs

Antes de afirmar o estado atual, comparar GitHub/main, HEAD da Oracle e label `org.opencontainers.image.revision` da aplicação ativa. Ler também `AGENTS.md` e `docs/NFSE_EMISSAO_SEGURA.md`.

Uma nova proposta funcional recebe próximo número principal (`2.0`). Uma rodada de correções desta proposta recebe próximo ajuste (`1.9`). Não contar arquivos, mensagens, tentativas de comando ou testes como versões. Atualização apenas documental incrementa `revisao_documental`, mantendo a versão funcional. Registrar cada rodada com commit, testes, publicação e limitações.

Publicado não significa homologado integralmente. Evernote é espelho de consulta; GitHub é a fonte versionada. Não usar documentos antigos ou exportações do n8n como prova da produção atual.
