# Importação XML e ZIP — 28/09/2026

Relato: falhas no ViaNFe para Biapell, Farmácia Dias Queiroz, Farmácia Preço Bom, AG7 e DCAMS.

Falhas confirmadas no código: filtro excluía extensão XML maiúscula e ZIP; envio único ultrapassava limite de 100 arquivos; chamada confetti sem definição gerava erro após gravação; mensagem afirmava sucesso e DANFE mesmo com erros.

Correção: ZIP descompactado no navegador (inclui subpastas), XMLs enviados individualmente com progresso e erros por arquivo. Limites: 10 MB por XML, 200 MB descompactados por seleção, 10 mil XMLs por ZIP. ZIP aninhado não é expandido. Falha individual não impede os demais arquivos. Não há retry automático para evitar reenvio incerto após falha de rede.

Teste isolado: ZIP de 105 XMLs em subpasta, extensão maiúscula, falha de rede, rejeição por arquivo, ZIP inválido e ZIP sem XML. Não insere dados de teste em produção.

Limite de comprovação: corrigir o transporte não comprova compatibilidade de todos os layouts fiscais. Ainda é necessária a validação dos arquivos reais que falharam nas cinco empresas, especialmente se forem NFS-e municipais. Não afirmar resolução individual sem essa evidência.

## Validação integral autorizada

Foi localizado XML NFSe/infNFSe nacional na AG7, antes rejeitado pelo parser. O parser novo preserva identificação de 50 dígitos, partes, datas, descrição integral e valores originais; não inventa protocolo de NF-e, itens de mercadoria nem parcelas. Rejeita homologação e documentos sem autorização/identificação/valores.

O DANFSe nacional não é substituído por DANFE de mercadorias. O download conserva PDF previamente anexado quando a regeneração não é aplicável. Upload informa XML gravado com PDF pendente quando necessário. Consulta autenticada à API oficial /danfse/{chave} da nota 7 da AG7 retornou HTTP 503 em 28/09/2026. Os PDFs mensais locais examinados são relatórios sem a chave individual, não prova de DANFSe disponível.

Ferramentas operacionais versionadas:
- prepare_saida_manifest.py: inventário local somente leitura por pasta/CNPJ explícitos; lê XML/ZIP, guarda cache privado retomável, separa eventos, emitente diferente, cópias conflitantes e cancelamentos. Manifestos/XMLs ficam fora do Git.
- import_saida_manifest.mjs: stdin NDJSON, lista explícita de CNPJs; padrão somente validação, --apply importa com ingestXml normal. Só saídas completas autorizadas de 2026; não sobrescreve XML existente divergente nem muda empresa. Verifica XML armazenado e PDF; NFS-e sem DANFSe permanece com pendência explícita.

Testes isolados adicionais: nfse-nacional.cjs e saida-manifest.cjs. Referência técnica: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual . Relatório final da execução de dados é privado e separado do código.
