# Emissão NFS-e: correção de segurança — 04/10/2026

## Contrato

Pedido recebido, RPS transmitido e nota autorizada são estados distintos. Nunca fabricar número, verificação, XML, endereço, serviço ou autorização.

- Rotas `/portal/nfse` exigem JWT e usuário ativo, tenant correto e vínculo à empresa (administrador limitado ao próprio tenant).
- Webhook exige CNPJ explícito. Não escolhe Viacont ou primeira empresa como alternativa. O telefone não é prova de autorização.
- Emissão direta de Salvador exige configuração fiscal e escolha explícita do Simples Nacional. Os outros provedores ficam bloqueados antes da transmissão enquanto seus campos presumidos e retornos não forem homologados.
- RPS é reservado em transação SQLite; tentativa permanece registrada em `nfse_emission_attempts`. Repetição do mesmo pedido não retransmite. Resultado incerto exige conferência do RPS; não há retry automático de emissão. Novo número de RPS é uma nova solicitação deliberada.
- Autorização exige retorno completo `InfNfse`, identificação do prestador/tomador, valor compatível, número e verificação oficiais. Recibo de lote ou XML enviado não são nota autorizada.
- XML é o retorno armazenado, sem reconstrução. PDF é identificado como representação dos dados oficiais, sem brasão ou endereço presumido. Registros antigos sem origem comprovada retornam indisponibilidade até recuperação do original; não são apagados.
- Emissão relâmpago antiga bloqueada: gerava documento e contas a receber com número aleatório sem autorização fiscal. Não apagar registros históricos nesta correção.

## n8n

Workflow `4Wn1e4VIXmBFUs0V`, definição em `integrations/n8n/nfse-emission.json`.

Recebe Authorization Bearer do chamador HTTP ou `authorization` do subworkflow; o ViaNFe valida usuário/empresa. Não contém credencial fixa. Retorna o resultado ao chamador e não envia WhatsApp. Dados de execução com tokens não devem ser retidos. Workflow principal Viviane não foi redirecionado: requer integração de identidade autenticada e gateway de saída validado, sem converter interpretação da IA em autorização fiscal.

## Verificação e limites

Testes isolados: `nfse-emission-safety.cjs`, `nfse-access.cjs`, `nfse-workflow.cjs`. Cobrem rejeição, falso sucesso, documento incompleto, preservação de zero real, repetição, acesso cruzado e ausência de envio direto. Não transmitem à prefeitura.

Build não comprova emissão municipal. Falta homologação fiscal de um pedido real autorizado pelo proprietário, validação do XML no importador contábil e integração autenticada do atendimento. Notas antigas não foram saneadas em massa. Não afirmar "100% pronto".

Rollback: imagem anterior preservada pelo deploy versionado; snapshot privado do workflow preservado fora do Git. Não restaurar automaticamente o comportamento de emissão fictícia. Banco preservado; novas tabelas são aditivas.
