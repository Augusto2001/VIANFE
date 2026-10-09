# Caderno Histórico de Todas as Versões Operacionais do ViaNFe

**Série Operacional 1 — Emissão Segura de NFS-e, Captura Fiscal DF-e e Governança Multi-Tenant**  
**Proprietário:** Augusto / Viacont  
**Ambiente de Produção Ativo:** Oracle Cloud (`168.138.127.199` / `https://vianfe.contadordev.com.br`)  
**Repositório Canônico:** [`https://github.com/Augusto2001/VIANFE.git`](https://github.com/Augusto2001/VIANFE.git) (branch `main`)

---

## 1. Tabela Geral de Versões

| Versão | Data | Commit SHA | Resumo da Entrega | Status | Documento |
|:---:|:---:|:---:|---|:---:|:---:|
| **1.0** | 04/10/2026 | `6f2ab65` | **Implementação Inicial da Proposta 1:** Identificação estrita da empresa emitente, eliminação de números simulados, checagem de autorização real, bloqueio de falso sucesso na NFS-e e proteção das rotas por tenant. | Publicado | [1.0.md](1.0.md) |
| **1.1** | 04/10/2026 | `34dd01d` | **Primeiro Ajuste:** Exigência de segredo JWT privado em produção, eliminação de chave padrão no Docker Compose e rotação de credenciais na nuvem. | Publicado | [1.1.md](1.1.md) |
| **1.2** | 05/10/2026 | `b32532a` | **Segundo Ajuste:** Confirmação explícita de tributação em Salvador, downloads protegidos sem token na URL e propagação de parâmetros no workflow n8n. | Publicado | [1.2.md](1.2.md) |
| **1.3** | 05/10/2026 | `bdc0498` | **Terceiro Ajuste:** Separação precisa de `CompNfse` em XMLs e PDFs municipais originais paginados sem suposições de alíquotas ou retenções. Script `recover_municipal_documents.cjs`. | Publicado | [1.3.md](1.3.md) |
| **1.4** | 06/10/2026 | `a37bc30` | **Quarto Ajuste:** Correção de crash de renderização na listagem de notas do frontend (`InvoiceListView`) pela restauração da importação de ícones do lucide-react. | Publicado | [1.4.md](1.4.md) |
| **1.5** | 06/10/2026 | `1a640c4` | **Quinto Ajuste:** Recuperação protegida de lotes municipais históricos legados em formato consolidado através do utilitário `recover_municipal_batch.cjs`. | Publicado | [1.5.md](1.5.md) |
| **1.6** | 06/10/2026 | `a6a4d30` | **Sexto Ajuste:** Preservação estrita dos documentos de serviços originais da fonte municipal, bloqueio de preenchimento com dados presumidos e isolamento de recuperação. | Publicado | [1.6.md](1.6.md) |
| **1.7** | 07/10/2026 | `23466e3` | **Sétimo Ajuste:** Preservação exata de centavos em tributos municipais (`fiscalDecimal.ts`) e inclusão das notas de serviços recuperadas na listagem geral. | Publicado | [1.7.md](1.7.md) |
| **1.8** | 08/10/2026 | `5a97e48` | **Oitavo Ajuste:** Representação gráfica em PDF para NFS-e municipal e nacional (cStat 100/107), bloqueio de resumos e rotina externa de reconciliação de originais. | Publicado | [1.8.md](1.8.md) |
| **1.9** | 09/10/2026 | `0871dcc` / `b45a094` | **Nono Ajuste:** Integração nativa do robô de busca e download de cupons fiscais **NFC-e (modelo 65)** direto dos servidores da **SEFAZ Virtual do RS (SVRS)** via mTLS do Certificado A1. | **Ativo em Produção** | [1.9.md](1.9.md) |

---

## 2. Resumo Detalhado dos Marcos Operacionais

### Versão 1.0 a 1.2 — Segurança e Fundações Fiscais
- Fim da emissão relâmpago simulada: o sistema nunca mais fabricou números de notas, verificações ou autorizações fictícias.
- Exigência de credenciais criptográficas robustas e segredo JWT fora do controle de versão.
- Contrato claro com o n8n no workflow `4Wn1e4VIXmBFUs0V` sem disparos automáticos indevidos.

### Versão 1.3 a 1.7 — Integridade Municipal e Preservação de Originais
- Tratamento cirúrgico de NFS-e municipal de Salvador e padrão ABRASF: manutenção de namespaces, preservação do conteúdo assinado, paginação real de PDF e exatidão de centavos.
- Utilitários de recuperação (`recover_municipal_documents.cjs`, `recover_municipal_batch.cjs`) projetados com `--check` prévio e execução vinculada a diretório de recuperação externo (`VIANFE_RECOVERY_DIR`), protegendo a integridade do banco de dados operacional.

### Versão 1.8 — Universalização de Documentos de Serviços
- Suporte a PDF tanto para notas municipais quanto no padrão nacional ADN (incluindo tratamento de NFS-e de MEI com cStat 107).
- Reconciliação fidedigna de históricos anteriores sem descarte de arquivos e com auditoria de integridade.

### Versão 1.9 — Robô Nativo SVRS NFC-e (Modelo 65)
- Embutido no código-fonte principal (`server/src/services/svrsNfceClient.ts`) e compilado no build de produção.
- Autenticação direta com handshake mTLS usando o Certificado Digital A1 (.pfx) dos clientes.
- Download imediato do XML completo `<nfeProc>` assinado pela autoridade tributária estadual e ingestão direta no banco e armazenamento de arquivos.
- Testado com sucesso em tempo real com a SEFAZ RS para a Churrascaria Tradição.
