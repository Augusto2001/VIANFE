# Recuperação de XML completo — 29/09/2026

Auditoria de produção encontrou 119 resumos em 12 empresas. Preflight dos 46 certificados cadastrados passou. Aceites de ciência, duplicidades e rejeições de prazo coexistem; ciência não equivale a XML recuperado.

Correções: recuperação por chave não depende de ciência aceita no banco local, pois o evento pode ter sido enviado por outro sistema. Duplicidade 573 não é gravada como aceite nem recebe protocolo inventado. Rejeições 573/596/650/655 deixam de gerar repetição de ciência. Resposta 650 não entra na recuperação automática. Demais resumos de entrada modelo 55 podem ser consultados, respeitando a carência. Uma tabela de tentativas ordena primeiro as notas ainda não consultadas, evitando que a primeira ausência de documento bloqueie sempre as demais. Respostas SOAP com namespace são interpretadas estruturalmente.

Downloads individuais e ZIP recusam resumos explicitamente; PDFs antigos de resumos não são servidos. Gerador não produz DANFE a partir de resumo. Ingestão impede rebaixar XML completo para resumo recebido posteriormente. Resumos são preservados internamente como pendências para recuperação, não apagados.

Validação adicional de NFS-e: 772 registros de arquivos candidatos, 38 nacionais e 734 municipais, com 739 identificadores distintos. Validação estrutural não é consulta de autorização atual nem verificação criptográfica. Parser municipal remove valores padrão inventados, lê bruto na declaração e preserva líquido zero. Lotes com várias NFS-e são integralmente lidos pela ferramenta de auditoria; ingestão unitária os rejeita explicitamente até implementar importação segura do lote.

Carga anterior concluída: 33.892 novas NF-e/NFC-e, com comparação do XML persistido e existência/cabeçalho PDF. Oito XMLs nacionais de NFS-e importados (sete AG7 e um Preço Bom) continuam sem DANFSe oficial, cuja API retornou 503. Foram separados 83 cancelamentos indicados, sete documentos sem autorização confirmada e um XML inconsistente. Não declarar tudo completo nem substituir XML original por dados fabricados.

Testes: science-protocol.cjs, full-document-download.cjs, nfse-municipal.cjs e testes fiscais existentes. Execução operacional posterior deve registrar recuperados e pendências reais; o deploy sozinho não comprova recuperação.

Complemento: recuperação por XML original usa recover_summary_manifest.mjs, valida chave/protocolo/destinatário e preserva manifestações e cancelamentos. Consultas por chave têm orçamento conservador de dez tentativas por empresa em 65 minutos. A rotina não remove carências impostas pela SEFAZ.
