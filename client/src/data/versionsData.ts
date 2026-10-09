export interface VersionItem {
  version: string;
  date: string;
  commit: string;
  shortCommit: string;
  title: string;
  summary: string;
  status: 'active' | 'published';
  statusLabel: string;
  category: 'Fiscal & SEFAZ' | 'Segurança & Infra' | 'Documentos & PDFs' | 'Interface & UI';
  novelties: string[];
  securityRules?: string[];
  testsAndEvidence?: string[];
  limitations?: string[];
}

export const VERSIONS_CATALOG: VersionItem[] = [
  {
    version: '1.9',
    date: '09/10/2026',
    commit: 'b45a09471183a55c6a12b7f594aa8fa8d4ae41eb',
    shortCommit: 'b45a094',
    title: 'Robô Nativo SVRS NFC-e (Modelo 65) e Conformidade Fiscal',
    summary: 'Busca e download direto de cupons fiscais eletrônicos NFC-e na SEFAZ Virtual do RS com mTLS de Certificado A1 integrado ao executável oficial do ViaNFe.',
    status: 'active',
    statusLabel: 'Ativo em Produção (Oracle Cloud)',
    category: 'Fiscal & SEFAZ',
    novelties: [
      'Motor autônomo mTLS no binário oficial (server/src/services/svrsNfceClient.ts) conectando ao portal oficial dfe-portal.svrs.rs.gov.br.',
      'Suporte a Certificados Digitais A1 ICP-Brasil (.pfx) com descriptografia AES-256 e leitura compatível via node-forge.',
      'Método canônico sefazService.syncNfceFromSvrs com persistência de XML em disco, geração de DANFE e cadastro na tabela invoices.',
      'Nova rota autenticada com isolamento de tenant: POST /api/companies/:id/sync-nfce-svrs.',
      'Ajuste de conformidade de comunicação no login, substituindo slogans absolutos por garantias de rastreabilidade factual.',
      'Integração obrigatória do teste unitário svrs-nfce.cjs à esteira de CI/CD do deploy_oracle_cloud.sh.'
    ],
    securityRules: [
      'Validação de CNPJ Base: O portal SVRS valida que o certificado corresponde aos 8 dígitos do emitente do cupom.',
      'Proteção contra falsos positivos: Retorno de erro da SEFAZ (<h4 class="textoErro">) é registrado como falha, sem criar dados artificiais.'
    ],
    testsAndEvidence: [
      'Download real ao vivo da SEFAZ RS para a Churrascaria Tradição: XML completo <nfeProc> (6.925 bytes), protocolo 229261132052638, cStat 100.',
      'Teste unitário svrs-nfce.cjs com 100% PASS em validação de schema, erro de SEFAZ e guarda de chave de 44 dígitos.',
      'Suíte de 20 testes de regressão aprovada no Docker e contêiner vianfe-api rodando ativo na porta 3001 na Oracle Cloud.'
    ],
    limitations: [
      'Exige Certificado Digital A1 ativo da empresa cadastrada no sistema.',
      'Download condicionado ao fornecimento ou identificação prévia das chaves de acesso de 44 dígitos.',
      'Homologação de rotina contínua diária aguarda validação final pelo proprietário.'
    ]
  },
  {
    version: '1.8',
    date: '08/10/2026',
    commit: '5a97e4862564e34a201c38c17c81e2465c3e8e4a',
    shortCommit: '5a97e48',
    title: 'PDF de Serviços e Recuperação Externa de Originais',
    summary: 'Geração de representação gráfica em PDF para NFS-e municipal e nacional (ADN) a partir dos campos do XML original e rotina externa de reconciliação.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Documentos & PDFs',
    novelties: [
      'Importação de NFS-e municipal e nacional gerando representação gráfica em PDF com os campos do XML original.',
      'Suporte a cStat 107 (NFS-e do MEI gerada) no parser nacional sem alteração artificial do código de situação.',
      'Procedimento reconcile_original_documents.cjs para separar consolidados municipais preservando subdocumentos originais.',
      'Download individual e em lote ZIP reconhecendo os dois formatos de serviços.'
    ],
    securityRules: [
      'O documento gerado identifica que é uma representação ViaNFe e não afirma ser o PDF municipal oficial.',
      'Resumos continuam terminantemente bloqueados como documentos fiscais completos.'
    ],
    testsAndEvidence: [
      'Testes de geração/leitura de PDF municipal e nacional, centavos, descrição longa e recusa de resumos.',
      'Procedimento de reconciliação exige diretório de recuperação externo (VIANFE_RECOVERY_DIR) e mantém integridade do banco.'
    ],
    limitations: [
      'Não garante coleta universal cega de saídas emitidas pela prefeitura.',
      'Homologação fiscal de emissão ponta a ponta permanece pendente.'
    ]
  },
  {
    version: '1.7',
    date: '07/10/2026',
    commit: '23466e350c16ff659efda44ed1191ff074e5188d',
    shortCommit: '23466e3',
    title: 'Preservação de Centavos Municipais e Listagem de Serviços',
    summary: 'Módulo fiscalDecimal para preservação de centavos em tributos municipais e inclusão das notas recuperadas na listagem geral.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Fiscal & SEFAZ',
    novelties: [
      'Criação do utilitário fiscalDecimal.ts para tratamento exato de centavos em alíquotas e retenções municipais.',
      'Inclusão das notas fiscais de serviços recuperadas na listagem geral de notas (invoices).',
      'Exibição visual no frontend com suporte a valores decimais fiéis ao XML original.'
    ],
    testsAndEvidence: [
      'Teste nfse-decimal.cjs com validação de centavos e cálculo exato de retenções.',
      'Teste nfse-list.cjs garantindo isolamento de empresas e ausência de duplicação.'
    ]
  },
  {
    version: '1.6',
    date: '06/10/2026',
    commit: 'a6a4d30445619d5f47a72018be183a21f5fed3c1',
    shortCommit: 'a6a4d30',
    title: 'Preservação de Originais Municipais e Bloqueio de Dados Presumidos',
    summary: 'Recuperação de documentos fiscais a partir da fonte municipal explícita e bloqueio de preenchimento presumido.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Documentos & PDFs',
    novelties: [
      'Recuperação de documentos de serviços exclusivamente da fonte municipal original.',
      'Bloqueio completo de conversão de dados ausentes em valores presumidos.',
      'Isolamento da rotina de reparo sem escrita direta no banco de produção.'
    ],
    testsAndEvidence: [
      'Teste reconcile-originals.cjs validando que dry-run nunca grava em disco e bloqueia colisões entre empresas.'
    ]
  },
  {
    version: '1.5',
    date: '06/10/2026',
    commit: '1a640c48bc57a2f6ed37a1613eb06154cfce25a5',
    shortCommit: '1a640c4',
    title: 'Recuperação Protegida de Lotes Municipais Históricos',
    summary: 'Utilitário recover_municipal_batch.cjs com modo de verificação prévia (--check) antes da escrita.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Fiscal & SEFAZ',
    novelties: [
      'Utilitário recover_municipal_batch.cjs para recuperar lotes consolidados antigos.',
      'Validação de duplicidades e consistência com backup prévio obrigatório.',
      'Modo --check que audita todo o acervo sem alterar nenhum registro.'
    ],
    testsAndEvidence: [
      'Teste municipal-batch-recovery.cjs validando integridade de lote e namespaces.'
    ]
  },
  {
    version: '1.4',
    date: '06/10/2026',
    commit: 'a37bc30ce98d8bd50a4e7f0ca23c11d200b61ef9',
    shortCommit: 'a37bc30',
    title: 'Correção de Renderização da Listagem de Notas no Frontend',
    summary: 'Restauração da importação correta de ícones do Lucide React na tela de listagem de faturas, eliminando falhas de tela branca.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Interface & UI',
    novelties: [
      'Correção de imports ausentes de ícones no InvoiceListView.tsx.',
      'Build limpo do Vite no frontend sem erros de compilação.',
      'Garantia de renderização fluida das notas em qualquer resolução.'
    ]
  },
  {
    version: '1.3',
    date: '05/10/2026',
    commit: 'bdc0498a444a6fbb33ebc868cbe68b57b7cf7a17',
    shortCommit: 'bdc0498',
    title: 'Documentos Municipais Originais e Paginação Real de PDF',
    summary: 'Separação fidedigna de CompNfse com namespaces herdados e paginação automática de PDF sem presunção de tributos.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Documentos & PDFs',
    novelties: [
      'Extração individual de cada CompNfse mantendo o trecho assinado e contexto XML.',
      'Novo gerador de PDF representando fielmente os campos presentes no XML.',
      'Script recover_municipal_documents.cjs com trava de segurança em diretório externo.',
      'Downloads individuais e em lote ZIP usando a mesma representação auditada.'
    ],
    testsAndEvidence: [
      'Teste nfse-original-documents.cjs com conferência de descrição longa paginada e zero real.'
    ]
  },
  {
    version: '1.2',
    date: '05/10/2026',
    commit: 'b32532a994a97f509ef449a80fcf94123f6bc010',
    shortCommit: 'b32532a',
    title: 'Confirmação Fiscal Explícita e Downloads Autenticados',
    summary: 'Exigência de confirmação fiscal expressa de tributação em Salvador e downloads protegidos sem token na URL.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Segurança & Infra',
    novelties: [
      'Formulário exigindo confirmação de tributação em Salvador, sem deduções e escolha explícita do Simples Nacional.',
      'Botões de download da tela NFS-e usando Authorization no cabeçalho (sem JWT na URL).',
      'Propagação da confirmação fiscal no contrato do workflow n8n.'
    ],
    securityRules: [
      'Regressão automatizada que bloqueia emissão quando a confirmação fiscal não está presente.'
    ]
  },
  {
    version: '1.1',
    date: '04/10/2026',
    commit: '34dd01d295ad6ea49a18fa3fc4bb14b0bca03f4f',
    shortCommit: '34dd01d',
    title: 'Chave JWT Privada Obrigatória e Rotação de Segredos na Nuvem',
    summary: 'Exigência de chave secreta JWT privada e de alta entropia na Oracle Cloud, com encerramento de sessões legadas.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Segurança & Infra',
    novelties: [
      'Exigência de chave privada no docker-compose.yml, rejeitando chaves conhecidas do código.',
      'Geração e rotação de segredo privado na Oracle Cloud mantido fora do Git.',
      'Invalidação automática de sessões antigas preservando cadastros e bancos.'
    ]
  },
  {
    version: '1.0',
    date: '04/10/2026',
    commit: '6f2ab65538eecb52a127a3c301648a3c5a6d3ec1',
    shortCommit: '6f2ab65',
    title: 'Emissão Segura de NFS-e e Bloqueio de Sucessos Fictícios',
    summary: 'Fundação da Proposta 1: Fim de números simulados, identificação estrita da empresa, autorização comprovada e controle atômico de RPS.',
    status: 'published',
    statusLabel: 'Publicado na Nuvem',
    category: 'Segurança & Infra',
    novelties: [
      'Rotas /portal/nfse protegidas com JWT, tenant obrigatório e empresa vinculada.',
      'Eliminação completa de números aleatórios e autorizações simuladas.',
      'Reserva de RPS em transação atômica SQLite impedindo retransmissões acidentais.',
      'Workflow n8n 4Wn1e4VIXmBFUs0V sem credenciais fixas e sem disparos a clientes sem autorização.'
    ]
  }
];
