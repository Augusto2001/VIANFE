# Protocolo Canônico — Gestão de Certidões Negativas, Vigência Incremental e Pendência Impeditiva

**Viacont Inovações Contábeis — Sistema ViaOS**  
**Versão:** 1.0 (Novembro/2026)  
**Template Canônico:** 53 — `EMISSAO DE CERTIDOES NEGATIVAS`  
**Alçada:** Diretoria Executiva (Augusto / Val) • Setor Fiscal & Societário

---

## 1. Tríade Operacional de Certidões Negativas

A emissão e acompanhamento das certidões das empresas ativas é uma obrigação legal periódica e preventiva. No ViaOS, a rotina foi estruturada em 3 pilares:

1. **Slots Estruturados (Template 53)**:
   - **Slot 124**: `CERTIDAO NEGATIVA / POSITIVA E OU RELAÇÃO DEBITOS FEDERAIS` (Receita Federal / PGFN)
   - **Slot 125**: `CERTIDAO NEGATIVA / POSITIVA E OU RELAÇÃO DEBITOS ESTADUAIS` (SEFAZ-BA)
   - **Slot 126**: `CERTIDAO NEGATIVA DE DEBITOS MOBILIARIOS` (Prefeitura do Domicílio)
   - **Slot 127**: `CRF (CERTIDÃO REGULARIDADE FGTS)` (Caixa Econômica Federal)
   - **Slot 128**: `CERTIDÃO NEGATIVA / POSITIVA DEBITOS TRABALHISTAS` (CNDT / TST)
   - **Slot 129**: `CERTIDAO FALENCIA E CONCORDATA` (Tribunal de Justiça - TJBA)

2. **Prazos Oficiais de Vigência Jurídica**:
   - **Federal**: 180 dias
   - **Estadual (BA)**: 60 dias
   - **Municipal**: 30 a 90 dias
   - **FGTS (CRF)**: 30 dias
   - **Trabalhista (CNDT)**: 180 dias
   - **Falência/Concordata**: 60 dias

3. **Links Governamentais Oficiais Clicáveis no Checklist**:
   - Federal: `https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir`
   - Estadual: `https://sistemas.sefaz.ba.gov.br/siatweb/emissaoCertidaoNegativa.do`
   - Municipal Salvador: `https://www2.sefaz.salvador.ba.gov.br/servico/certidao-regularidade-fiscal-pj`
   - FGTS: `https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf`
   - Trabalhista: `https://cndt-certidao.tst.jus.br/inicio.faces`
   - Falência: `https://www.tjba.jus.br/certidao/`

---

## 2. Regra Soberana da Renovação Incremental (Sem Retrabalho)

Quando qualquer uma das certidões estiver prestes a vencer ($\le 5$ dias) ou vencida:
- O sistema cria a tarefa da competência no ViaOS.
- **Certidões VIGENTES**: O robô/analista **NÃO reconsulta o órgão**. Os arquivos PDFs válidos são lidos diretamente da pasta da empresa no Google Drive (`SETOR FISCAL\CERTIDAO NEGATIVA\`) e vinculados automaticamente aos slots.
- **Certidões VENCIDAS**: O robô/analista acessa **exclusivamente** o órgão cuja certidão expirou, extrai o novo PDF atualizado, salva na pasta do Drive e anexa no slot restante.

---

## 3. Protocolo de Pendência Impeditiva (Quando a Certidão Não Sai)

Se uma empresa possuir débitos, divergências de GFIP/DCTFWeb ou omissões cadastrais e o órgão não liberar a certidão negativa:

1. **Documento Substituto Oficial**:
   - Anexa-se o **Relatório de Situação Fiscal** ou **Extrato de Débitos/Pendências** emitido pelo portal governamental no slot respectivo.
2. **Sinalização Visual no ViaOS**:
   - O slot exibe o selo: `⚠️ Pendência Impeditiva: [Nome do Arquivo]`.
   - O status da tarefa é classificado como `COM_IMPEDIMENTO` ou `ENTREGUE_COM_PENDENCIA`.
3. **Notificação ao Cliente com Alto Valor Agregado**:
   - A mensagem Omnichannel (WhatsApp e E-mail) informa com transparência ao cliente:
     > *"Durante a conferência periódica das certidões da sua empresa, as certidões [X, Y, Z] saíram regulares. Contudo, a Certidão [Órgão] apontou débitos impeditivos. Em anexo segue o Relatório de Situação Fiscal com o detalhamento das guias para que possamos providenciar a regularização imediata."*
4. **Acionamento do Setor Fiscal/Societário**:
   - Gera um apontamento interno para emissão das guias em atraso ou requerimento de parcelamento (PGDAS / Previdenciário / ICMS).
