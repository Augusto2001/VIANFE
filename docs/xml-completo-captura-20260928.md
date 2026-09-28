# Correção de captura de XML completo — 28/09/2026

Diagnóstico em produção: três notas da Palmas para ML permaneciam em resNFe sem evento de ciência. Logs de 27 e 28/09 mostraram ML entre as empresas ignoradas por carência. Outras tentativas de ciência receberam HTTP 403.

O agendador executava distribuição antes da ciência. A distribuição estabelecia carência e a ciência, iniciada logo depois, ignorava essas empresas. A etapa de ciência e recuperação passa a preceder a distribuição às 02:30, preservando a verificação de carências já existentes.

O endereço de produção de recepção de eventos é `www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx`. A distribuição continua em `www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx`. Fonte: https://www.nfe.fazenda.gov.br/portal/webServices.aspx?AspxAutoDetectCookieSupport=1

Testes verificam endereço, assinatura/correlação da ciência e execução antes de qualquer consulta de distribuição. Somente ciência (210210) é transmitida pela rotina; manifestações definitivas continuam sob decisão do cliente. XML recuperado exige chave correspondente e protocolo antes da gravação. Parcelas e pagamentos disponíveis são preservados no banco. Publicação de código não comprova recuperação de todas as notas; resultados de execução devem ser conferidos separadamente.
