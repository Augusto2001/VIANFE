# 📚 MANUAL MESTRE DE ARQUITETURA E ESPECIFICAÇÃO DE MÓDULOS (VIANFE POR VIACONT)

> **Documento Oficial de Engenharia & Regras de Negócio**  
> **Plataforma:** ViaNfe / DF-e Hub  
> **Escritório Central:** Viacont Contabilidade & Inteligência Fiscal  
> **Versão:** 3.0 Enterprise Multi-Tenant & BPO Integrado  

---

## 🗺️ Mapa Geral dos 5 Módulos da Plataforma

```mermaid
graph TD
    subgraph 🏢 MÓDULO 1: MOTOR FISCAL & SEFAZ 24H
        M1_1[Captura A1 DFe Automática]
        M1_2[Varredura Madrugada 02:30 AM]
        M1_3[Gerador DANFE PDF & Armazenamento]
    end

    subgraph 💰 MÓDULO 2: BPO FINANCEIRO & CONCILIAÇÃO
        M2_1[Extratos OFX & PDF Bancários]
        M2_2[Importador de Folha & Impostos DAS/DARF]
        M2_3[Tela Conciliação Lado a Lado Estilo Conta Azul]
        M2_4[Contas a Pagar & Calendário de Vencimentos]
    end

    subgraph 📱 MÓDULO 3: ÁREA DO CLIENTE & MANIFESTAÇÃO
        M3_1[Portal Web & Celular Isolado]
        M3_2[Manifestação de Notas pelo Próprio Cliente]
        M3_3[Lançamentos Rápidos com Câmera & Observações]
    end

    subgraph 📊 MÓDULO 4: PAINEL DO SUCESSO EMPRESARIAL
        M4_1[+30 KPIs Autônomos em Tempo Real]
        M4_2[Radar de Risco: Cartões x Notas de Saída]
        M4_3[Auditoria Compras x Vendas]
        M4_4[Top 5 Fornecedores, Clientes & Pizza de Vendas]
    end

    subgraph 📑 MÓDULO 5: INTEGRAÇÃO CONTÁBIL DOMÍNIO
        M5_1[Plano de Contas Flexível]
        M5_2[Exportador de Lotes Domínio Sistemas]
        M5_3[Importador Histórico DRE & Balanço Domínio]
    end

    M1_1 --> M2_4
    M1_1 --> M3_2
    M1_1 --> M4_2 & M4_3 & M4_4
    M2_1 & M2_2 --> M2_3
    M3_3 --> M2_3
    M2_3 --> M4_1 & M5_2
    M5_3 --> M4_1
```

---

# 🏢 MÓDULO 1: MOTOR FISCAL SEFAZ & CAPTURA EM NUVEM

### 🎯 Objetivo:
Capturar, processar, validar e armazenar 100% dos documentos fiscais eletrônicos (NF-e, NFC-e, CT-e) emitidos contra ou pelas empresas clientes da Viacont.

### ⚙️ Regras de Funcionamento:
1. **Varredura Noturna Segura (Madrugada 02:30 AM)**:
   - Executa exclusivamente na madrugada com intervalo de 5s entre clientes, garantindo 0% de bloqueios SEFAZ (*cStat 656 Consumo Indevido*).
2. **Carga Completa de Implantação ("Na Hora")**:
   - Ao cadastrar uma nova empresa com Certificado Digital A1 (.pfx), executa a busca recursiva trazendo todo o histórico até o `maxNSU`.
3. **Leitor Criptográfico A1**:
   - Suporte completo a padrões criptográficos brasileiros (RC2/3DES/Node-Forge).
4. **Gerador On-the-Fly de DANFE em PDF**:
   - Gera o layout do DANFE com código de barras, itens, impostos destacados e salva em pasta física estruturada.
5. **Estrutura de Pastas Padronizada**:
   - `STORAGE/CLIENTES VIACONT/CLIENTES ATIVOS/[EMPRESA]/[ANO]/[MÊS]/XMLs/` e `PDFs/`.

---

# 💰 MÓDULO 2: BPO FINANCEIRO, EXTRATOS & CONCILIAÇÃO INTELIGENTE

### 🎯 Objetivo:
Oferecer ao cliente e ao time de BPO da Viacont uma central financeira inteligente com conciliação bancária lado a lado estilo Conta Azul, agregando notas fiscais, extratos bancários, guias de impostos e folha de pagamento.

### ⚙️ Regras de Funcionamento:
1. **Importação de Extratos Bancários (OFX e PDF)**:
   - Lê arquivos `.ofx` e `.pdf` de qualquer banco (Itaú, Bradesco, Santander, BB, Inter, Nubank, Sicoob, Sicredi, etc.).
   - Extrai data, valor, tipo e descrição da transação.
2. **Importação de Impostos & Folha de Pagamento**:
   - **Guias de Impostos**: DAS (Simples), DARFs, ICMS/DAE, ISS, FGTS Digital e parcelamentos.
   - **Folha de Pagamento**: Salários líquidos, pró-labore, encargos, vales e benefícios.
   - Entram automaticamente no **Contas a Pagar** com datas de vencimento e alertas.
3. **Tela de Conciliação Bancária Lado a Lado (Estilo Conta Azul)**:
   - **Coluna Esquerda**: Linhas do extrato bancário.
   - **Coluna Direita**: Lançamento sugerido com vínculo automático de NF-e, Guia de Imposto ou Folha + Categoria.
   - **Ação com 1 Clique**: Botão de `[ Conciliar ✓ ]` ou `[ Editar Categoria ✎ ]`.
   - **Aprendizado Contínuo**: O sistema grava o padrão e sugere automaticamente nos meses seguintes.
4. **Contas a Pagar Automático via XML**:
   - Lê a tag `<dup>` das notas da SEFAZ e cadastra fornecedor, parcelas e vencimentos sem digitação.

---

# 📱 MÓDULO 3: ÁREA DO CLIENTE MOBILE & MANIFESTAÇÃO

### 🎯 Objetivo:
Ambiente simplificado e responsivo para o dono/gerente da empresa cliente operar pelo celular ou computador com isolamento de dados.

### ⚙️ Regras de Funcionamento:
1. **Isolamento Rígido de Acesso**:
   - O cliente entra com seu login e visualiza **exclusivamente a sua própria empresa**.
2. **Manifestação pelo Próprio Cliente**:
   - O próprio cliente atesta as notas emitidas contra o CNPJ dele:
     - 🟢 **Confirmar Recebimento da Mercadoria** *(Confirmação da Operação)*.
     - 🔴 **Não Reconheço Esta Compra / Fraude** *(Desconhecimento da Operação)*.
     - 🟡 **Carga Devolvida / Cancelada** *(Operação Não Realizada)*.
   - Validade jurídica total para o escritório Viacont.
3. **Lançamentos Rápidos com Câmera do Celular**:
   - Registro de despesas/receitas manuais em 3 passos.
   - Foto do comprovante/recibo direto da câmera.
4. **Campo de Observações Livres**:
   - Espaço aberto para o cliente escrever qualquer detalhe (ex: *"pago em dinheiro pelo caixa da noite para freteiro"*).

---

# 📊 MÓDULO 4: PAINEL DO SUCESSO EMPRESARIAL & RADAR FISCAL (+30 KPIs)

### 🎯 Objetivo:
Painel executivo com mais de 30 KPIs em tempo real, DRE gerencial, fluxo de caixa e motor de prevenção contra autuações fiscais. **Não depende da Domínio para gerar gráficos e resultados.**

### ⚙️ Regras de Funcionamento:
1. **Independência Total de Dados**:
   - Gera gráficos, DRE e indicadores em tempo real a partir dos XMLs, extratos conciliados e lançamentos internos.
2. **Radar de Risco Fiscal & Prevenção de Autuações**:
   - **Cruzamento das Formas de Pagamento (Tags `<pag>`/`<tPag>` das Notas de Saída x Extratos de Bancos e Adquirentes)**:
     - Extrai as modalidades registradas pelo operador no caixa (`01 Dinheiro`, `03 Crédito`, `04 Débito`, `17 PIX`, `15 Boleto`).
     - Rastreia a data em que ocorreu a venda vs. a data da liquidação no banco (PIX em D+0, Débito em D+1, Crédito em D+30).
     - Confronta se o que a equipe do caixa registrou bate com os valores que entraram no extrato bancário e identifica desvios ou omissões na hora.
   - **Cruzamento Compras x Vendas**: Identifica quando as compras superam o faturamento de vendas no mês (alerta de estoque/venda sem nota).
3. **Rankings & Gráficos Estratégicos**:
   - 🏆 **Top 5 Fornecedores do Mês**: Ranking por valor e % de concentração de compras.
   - 🏆 **Top 5 Clientes do Mês**: Maiores compradores da empresa.
   - 🍕 **Pizza de Vendas por Modalidade**: *Crédito, Débito, PIX, Boleto e Dinheiro*.
4. **+30 KPIs Financeiros e Contábeis**:
   - Margem Bruta, Margem Líquida, EBITDA, Ponto de Equilíbrio, Liquidez Corrente, Liquidez Seca, PMR, PMP, Giro de Estoque, Ciclo Financeiro, Endividamento Geral, etc.

---

# 📑 MÓDULO 5: INTEGRAÇÃO COM DOMÍNIO SISTEMAS

### 🎯 Objetivo:
Integrar perfeitamente a escrituração da Viacont com a Domínio Sistemas para eliminar retrabalho contábil.

### ⚙️ Regras de Funcionamento:
1. **Plano de Contas Flexível**:
   - Permite importar o Plano de Contas da Domínio ou trabalhar com plano gerencial flexível.
   - Mapeamento De/Para entre categorias financeiras e contas contábeis (Débito/Crédito).
2. **Exportador Oficial de Lotes Domínio**:
   - Exporta arquivo `.txt` no layout oficial da Domínio Sistemas pronto para importação no módulo Contabilidade.
3. **Importador Histórico de DRE & Balanço da Domínio**:
   - Faz o parser de relatórios da Domínio (PDF/Excel) para comparar a evolução contábil histórica.
