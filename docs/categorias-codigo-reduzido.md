# Categorias amigáveis e código reduzido

O cadastro da conciliação possui botão visível **Nova categoria**, além da opção no final da lista. O formulário exige nome amigável, tipo e seleção do código reduzido de uma conta analítica legível do plano importado da empresa selecionada. A lista apresenta nome e código reduzido; categorias antigas sem vínculo são identificadas explicitamente.

As categorias continuam pertencendo ao escritório. O vínculo do código reduzido pertence ao par categoria/empresa, na tabela `financial_category_accounts`, criada de forma aditiva na inicialização. Não são deduzidos códigos de classificações, nomes ou tipos. A API mantém compatibilidade com chamadas antigas sem o campo; quando informado, valida o código no plano da empresa. Nenhuma categoria anterior recebe código presumido.

Repetir nome/tipo reutiliza a categoria existente e permite vincular uma empresa ainda sem vínculo. Um código diferente em vínculo existente é recusado com HTTP 409, evitando troca silenciosa. A seleção de outra empresa não reutiliza seu código reduzido.

Este vínculo identifica a conta da categoria; não determina sozinho uma partida contábil. O mapeamento legado de débito/crédito e a exportação não são alterados nesta entrega. A revisão desse mapeamento por empresa permanece necessária antes de ampliar a automação contábil.

Validação: testes isolados de persistência, separação por empresa, controle de acesso, rejeição de conta inexistente/sintética e preservação de vínculo existente, além das regressões de conciliação/importação. Não se criam categorias ou transações fictícias na produção.
