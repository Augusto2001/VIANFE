# Importação XML e ZIP — 28/09/2026

Relato: falhas no ViaNFe para Biapell, Farmácia Dias Queiroz, Farmácia Preço Bom, AG7 e DCAMS.

Falhas confirmadas no código: filtro excluía extensão XML maiúscula e ZIP; envio único ultrapassava limite de 100 arquivos; chamada confetti sem definição gerava erro após gravação; mensagem afirmava sucesso e DANFE mesmo com erros.

Correção: ZIP descompactado no navegador (inclui subpastas), XMLs enviados individualmente com progresso e erros por arquivo. Limites: 10 MB por XML, 200 MB descompactados por seleção, 10 mil XMLs por ZIP. ZIP aninhado não é expandido. Falha individual não impede os demais arquivos. Não há retry automático para evitar reenvio incerto após falha de rede.

Teste isolado: ZIP de 105 XMLs em subpasta, extensão maiúscula, falha de rede, rejeição por arquivo, ZIP inválido e ZIP sem XML. Não insere dados de teste em produção.

Limite de comprovação: corrigir o transporte não comprova compatibilidade de todos os layouts fiscais. Ainda é necessária a validação dos arquivos reais que falharam nas cinco empresas, especialmente se forem NFS-e municipais. Não afirmar resolução individual sem essa evidência.
