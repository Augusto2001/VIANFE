# ViaNFe — versão operacional 1.2

Registro iniciado em 05/10/2026, fuso America/Sao_Paulo, por solicitação do proprietário.

Leia o relatório completo: [versão 1.2 — mudanças, ajustes, evidências e pendências](versoes/1.2.md).

- **1** identifica a primeira proposta registrada nesta nova série: emissão segura de NFS-e e integração autenticada com n8n/ZapCont.
- **2** identifica duas rodadas de ajustes posteriores à implementação inicial.
- Não é uma reconstrução da numeração histórica do produto. O `1.0.0` dos pacotes npm é uma versão técnica anterior, sem esse significado operacional.
- Commit funcional consolidado: `b32532a994a97f509ef449a80fcf94123f6bc010`. A revisão documental que contém este registro terá seu próprio commit de publicação, sem mudar a versão funcional 1.2.
- Metadados para ferramentas: [versao-operacional.json](../versao-operacional.json).

## Regra para todas as IAs

Antes de afirmar o estado atual, comparar GitHub/main, HEAD da Oracle e label `org.opencontainers.image.revision` da aplicação ativa. Ler também `AGENTS.md` e `docs/NFSE_EMISSAO_SEGURA.md`.

Uma nova proposta funcional recebe próximo número principal (`2.0`). Uma rodada de correções desta proposta recebe próximo ajuste (`1.3`). Não contar arquivos, mensagens, tentativas de comando ou testes como versões. Atualização apenas documental incrementa `revisao_documental`, mantendo a versão funcional. Registrar cada rodada com commit, testes, publicação e limitações.

Publicado não significa homologado integralmente. Evernote é espelho de consulta; GitHub é a fonte versionada. Não usar documentos antigos ou exportações do n8n como prova da produção atual.
