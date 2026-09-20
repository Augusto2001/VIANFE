# Centralização da ciência — etapas 1 e 2

Produção observada: commit `5b343f8007fde44493475065cf67761cecefa991`.
Imagem observada: `sha256:2e274c4168fbba2fe7a8eaf4224af31520d1ab18ad2a189f0c8a5e4b151087ef`.
Hash agregado dos 74 arquivos dist do host/container: `47668033aa23092da628cbf87f06600685d8596f2a0a2c54b9d0a155a2ab4416`.

Original preservado fora do checkout em `vianfe-recuperacao-somente/antes-centralizacao-20260919/auto_ciencia_original.mjs`.
SHA256 do original: `fafb64cad038a228fdf92e1761a52d677a22574100627c8f7f3c6586a2b76309`.
Essa pasta também preserva o patch e os arquivos da manifestação manual suspensa. Não é fonte de deploy.

Cron externo observado (root, UTC): `30 5 * * * docker exec vianfe-api node /app/server/storage/auto_ciencia_standalone.mjs`.
Ele não foi alterado nesta etapa. Seu último erro observado é a ausência de xml-crypto.

## Implementação preparada

- Rotina em `server/scripts/auto_ciencia.mjs`, incluída na imagem pelo Dockerfile.
- Dependência xml-crypto fixada no lockfile; usa a função de decriptação já existente no aplicativo.
- TLS verificado; eventos assinados no envelope final; protocolo não pode ser substituído por cStat.
- Somente ciência 210210; não envia confirmação, desconhecimento ou operação não realizada.
- Scheduler com America/Sao_Paulo explícito. Ciência encadeada após o ciclo DFe das 02:30, com bloqueio de sobreposição dos ciclos do mesmo processo.
- Nova rotina desativada por padrão: exige VIANFE_AUTO_CIENCIA_ENABLED=true.

## Ativação posterior — não executada nas etapas 1 e 2

1. Validar assinatura, respostas, idempotência, migração e recuperação de XML com testes isolados.
2. Preservar crontab e backup consistente do banco antes da migração em produção.
3. Retirar somente a entrada antiga de ciência do crontab root; verificar que não há execução antiga em andamento.
4. Configurar a variável de ativação no serviço Compose e publicar o commit aprovado. Não manter os dois agendamentos ativos.
5. Conferir SHA, saúde, migrações e resultados reais. Rejeições ou ausência de XML continuam pendentes.

Não houve deploy, transmissão fiscal nem mudança de crontab nas etapas 1 e 2. Código centralizado não significa recuperação dos XMLs concluída.

## Continuação autorizada: entrega na main e Oracle

O Compose passa a habilitar a rotina. Antes do deploy, executar `sudo python3 server/scripts/migrate_science_cron.py --apply`: preserva o crontab root, o script original e um backup consistente SQLite fora do checkout; retira exclusivamente a entrada legada. O deploy bloqueia se essa entrada permanecer e executa testes isolados antes de trocar a imagem.

Testes: assinatura do SOAP efetivamente transmitido; resposta com namespace; correlação de chave/evento/ambiente/sequência; protocolo ausente; rejeição; bloqueio de sobreposição; fuso explícito; rotina desabilitada sem configuração. Todos sem chamadas fiscais reais.

Após deploy: conferir SHA, saúde pública, ausência do cron antigo e rodar `node /app/server/scripts/auto_ciencia.mjs --check` dentro do container. Esse comando consulta o banco em modo somente leitura e verifica a abertura dos certificados sem transmitir eventos. A execução fiscal permanece no ciclo agendado; aceitação pela SEFAZ e XML completo devem ser conferidos após esse ciclo.
