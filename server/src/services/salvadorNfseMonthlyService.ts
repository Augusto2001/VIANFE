import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { splitMunicipalXml, municipalDocument, originalNfsePdf } from './nfse/originalDocuments.js';
import { db, CERTS_DIR } from '../database/db.js';
import { decryptText, cleanNumeric } from '../utils/crypto.js';
import { nfsePdfGenerator, MonthlyConferenceData } from './nfsePdfGenerator.js';
import { googleDriveService } from './googleDriveService.js';

export interface MonthlySyncResult {
  success: boolean;
  empresa: string;
  cnpj: string;
  cga: string;
  competencia: string; // MM.AAAA
  totalNotas: number;
  primeiraNota?: number | string;
  ultimaNota?: number | string;
  totalServicos: number;
  totalIss: number;
  canceladas: number;
  gaps: number[];
  arquivosGerados: {
    xmlConsolidado?: string;
    relatorioConferenciaPdf?: string;
    totalXmlsIndividuais: number;
    totalPdfsIndividuais: number;
    diretorioStorage: string;
    diretorioDriveLocal?: string;
  };
  mensagem: string;
}

export const salvadorNfseMonthlyService = {
  /**
   * Executa a sincronização completa mensal de NFS-e da Prefeitura de Salvador para uma empresa
   */
  async syncMonthlyNfse(companyId: string, ano: number, mes: number): Promise<MonthlySyncResult> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa com ID "${companyId}" não foi encontrada no banco de dados.`);
    }

    const cleanCnpj = cleanNumeric(company.cnpj);
    const cga = cleanNumeric(company.inscricao_municipal);
    const mesFormatado = String(mes).padStart(2, '0');
    const anoFormatado = String(ano);
    const mesAno = `${mesFormatado}.${anoFormatado}`;

    if (company.emite_nfse === 0) {
      console.log(`⏩ [NFS-e Salvador] Empresa ${company.razao_social} configurada como comércio puro (emite_nfse = 0). Busca ignorada.`);
      return {
        success: true,
        empresa: company.razao_social,
        cnpj: company.cnpj,
        cga: cga || '',
        competencia: mesAno,
        totalNotas: 0,
        totalServicos: 0,
        totalIss: 0,
        canceladas: 0,
        gaps: [],
        arquivosGerados: {
          totalXmlsIndividuais: 0,
          totalPdfsIndividuais: 0,
          diretorioStorage: ''
        },
        mensagem: `A empresa ${company.razao_social} é do segmento de comércio puro (não emite NFS-e). Nenhuma consulta necessária.`
      };
    }

    if (!cga) {
      throw new Error(`A empresa ${company.razao_social} (CNPJ: ${company.cnpj}) não possui Inscrição Municipal (CGA) cadastrada. Por favor, cadastre a Inscrição Municipal antes de sincronizar.`);
    }

    if (!company.cert_filename || !company.cert_password_enc) {
      throw new Error(`A empresa ${company.razao_social} não possui Certificado Digital A1 (.pfx) configurado no sistema.`);
    }

    const certPath = path.join(CERTS_DIR, company.cert_filename);
    if (!fs.existsSync(certPath)) {
      throw new Error(`Arquivo de Certificado Digital A1 não encontrado no storage: ${company.cert_filename}`);
    }

    console.log(`📡 [NFS-e Salvador] Iniciando sincronização mensal: ${company.razao_social} | Competência: ${mesAno}`);

    // 1. Extração do Certificado A1 e mTLS
    const certPassword = decryptText(company.cert_password_enc);
    const pfxBuffer = fs.readFileSync(certPath);
    const pfxDer = pfxBuffer.toString('binary');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, certPassword);

    let certPem = '';
    let keyPem = '';
    for (const sc of pfx.safeContents) {
      for (const sb of sc.safeBags) {
        if (sb.cert) certPem += forge.pki.certificateToPem(sb.cert);
        if (sb.key) keyPem = forge.pki.privateKeyToPem(sb.key);
      }
    }

    if (!certPem || !keyPem) {
      throw new Error('Falha ao extrair chaves pública/privada do certificado digital da empresa.');
    }

    const agent = new https.Agent({
      cert: certPem,
      key: keyPem,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    });

    // 2. Cálculo dos dias do mês
    const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
    const dataInicial = `${anoFormatado}-${mesFormatado}-01`;
    const dataFinal = `${anoFormatado}-${mesFormatado}-${String(ultimoDiaDoMes).padStart(2, '0')}`;

    // 3. Montagem do Envelope SOAP ABRASF Salvador
    const consultaXml = `
      <ConsultarNfseEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
        <Prestador>
          <Cnpj>${cleanCnpj}</Cnpj>
          <InscricaoMunicipal>${cga}</InscricaoMunicipal>
        </Prestador>
        <PeriodoEmissao>
          <DataInicial>${dataInicial}</DataInicial>
          <DataFinal>${dataFinal}</DataFinal>
        </PeriodoEmissao>
      </ConsultarNfseEnvio>
    `.trim();

    const soapEnvelope = `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <ConsultarNfse xmlns="http://tempuri.org/">
            <consultaxml><![CDATA[${consultaXml}]]></consultaxml>
          </ConsultarNfse>
        </s:Body>
      </s:Envelope>
    `.trim();

    // 4. Execução da chamada WebService mTLS
    const rawSoap = await new Promise<string>((resolve, reject) => {
      const req = https.request('https://nfse.salvador.ba.gov.br/rps/CONSULTANFSE/ConsultaNfse.svc', {
        method: 'POST',
        agent,
        timeout: 30000,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/IConsultaNfse/ConsultarNfse',
          'Content-Length': Buffer.byteLength(soapEnvelope)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout de comunicação com a Prefeitura de Salvador (>30s)'));
      });
      req.write(soapEnvelope);
      req.end();
    });

    // 5. Tratamento da resposta
    const matchResult = rawSoap.match(/<ConsultarNfseResult>([\s\S]*?)<\/ConsultarNfseResult>/);
    if (!matchResult) {
      if (rawSoap.includes('Fault') || rawSoap.includes('faultstring')) {
        const faultMatch = rawSoap.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
        throw new Error(`Falha no WebService de Salvador: ${faultMatch ? faultMatch[1] : 'Erro desconhecido'}`);
      }
      throw new Error('A Prefeitura de Salvador não retornou uma tag <ConsultarNfseResult> válida.');
    }

    const xmlUnescaped = matchResult[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // 6. Preparação dos diretórios de gravação
    const storageDir = path.resolve(__dirname, `../../storage/exports/nfse/${cleanCnpj}/${anoFormatado}/${mesAno}`);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    // Busca se existe pasta no Google Drive local montado em G:
    let localDriveDir: string | undefined = undefined;
    const gDriveBase = 'G:/Meu drive/CLIENTES VIACONT/CLIENTES ATIVOS';
    if (fs.existsSync(gDriveBase)) {
      try {
        const folders = fs.readdirSync(gDriveBase);
        const targetWord = (company.razao_social || '').toUpperCase().split(' ')[0];
        const matchedFolder = folders.find(f => {
          const upper = f.toUpperCase();
          return upper.includes(cleanCnpj) || (targetWord.length >= 3 && upper.includes(targetWord));
        });
        if (matchedFolder) {
          localDriveDir = path.join(gDriveBase, matchedFolder, 'SETOR FISCAL', 'NF', anoFormatado, mesAno);
          if (!fs.existsSync(localDriveDir)) {
            fs.mkdirSync(localDriveDir, { recursive: true });
          }
        }
      } catch (_) {}
    }

    // 7. Parse do XML com fast-xml-parser
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true, parseTagValue: false });
    const parsedDoc = parser.parse(xmlUnescaped);

    // Verificação de mensagens de ausência de notas (ex: E43)
    const mensagens = parsedDoc.ConsultarNfseResposta?.ListaMensagemRetorno?.MensagemRetorno;
    if (mensagens) {
      const msgArr = Array.isArray(mensagens) ? mensagens : [mensagens];
      const e43 = msgArr.find((m: any) => m.Codigo === 'E43' || (m.Mensagem && m.Mensagem.includes('Nenhum')));
      if (e43) {
        console.log(`ℹ️ [NFS-e Salvador] Nenhuma nota encontrada para ${company.razao_social} no período ${mesAno}.`);
        return {
          success: true,
          empresa: company.razao_social,
          cnpj: company.cnpj,
          cga,
          competencia: mesAno,
          totalNotas: 0,
          totalServicos: 0,
          totalIss: 0,
          canceladas: 0,
          gaps: [],
          arquivosGerados: {
            totalXmlsIndividuais: 0,
            totalPdfsIndividuais: 0,
            diretorioStorage: storageDir,
            diretorioDriveLocal: localDriveDir
          },
          mensagem: `Nenhuma NFS-e foi emitida para esta empresa no período ${mesAno}.`
        };
      }
    }

    const rawList = parsedDoc.ConsultarNfseResposta?.ListaNfse?.CompNfse || [];
    const compArray = Array.isArray(rawList) ? rawList : (rawList ? [rawList] : []);
    const originals = splitMunicipalXml(xmlUnescaped);
    if (originals.length !== compArray.length) throw new Error('Quantidade de documentos originais difere das notas interpretadas.');
    for (const original of originals) municipalDocument(original);

    if (compArray.length === 0) {
      return {
        success: true,
        empresa: company.razao_social,
        cnpj: company.cnpj,
        cga,
        competencia: mesAno,
        totalNotas: 0,
        totalServicos: 0,
        totalIss: 0,
        canceladas: 0,
        gaps: [],
        arquivosGerados: {
          totalXmlsIndividuais: 0,
          totalPdfsIndividuais: 0,
          diretorioStorage: storageDir,
          diretorioDriveLocal: localDriveDir
        },
        mensagem: `Nenhuma NFS-e retornada para o período ${mesAno}.`
      };
    }

    // 8. Salvar XML Consolidado do Mês
    const consolidatedFileName = `NFSe_CONSOLIDADO_${mesAno}.xml`;
    const consolidatedStoragePath = path.join(storageDir, consolidatedFileName);
    fs.writeFileSync(consolidatedStoragePath, xmlUnescaped, 'utf8');

    if (localDriveDir) {
      try {
        fs.writeFileSync(path.join(localDriveDir, consolidatedFileName), xmlUnescaped, 'utf8');
      } catch (_) {}
    }

    // 9. Processamento de cada nota individual
    let totalServicos = 0;
    let totalIss = 0;
    let canceladas = 0;
    const notasParaRelatorio: any[] = [];
    const numerosParaGaps: number[] = [];

    for (const [index, comp] of compArray.entries()) {
      const isCancelada = !!comp.NfseCancelamento;
      const infNfse = comp.Nfse?.InfNfse || comp.NfseCancelamento?.Confirmacao?.Pedido?.InfPedidoCancelamento?.IdentificacaoNfse || {};
      const numStr = String(infNfse.Numero || '0').trim();
      const numNum = parseInt(numStr, 10);
      const numPad8 = numStr.padStart(8, '0');
      const codVerif = String(comp.Nfse?.InfNfse?.CodigoVerificacao || '');
      const dataEmissao = String(comp.Nfse.InfNfse.DataEmissao);

      const declaracao = comp.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico || {};
      const servico = comp.Nfse?.InfNfse?.Servico || declaracao.Servico || {};
      const valores = servico.Valores || infNfse.ValoresNfse || {};

      const valServ = parseFloat(String(valores.ValorServicos || '0'));
      const valIss = parseFloat(String(valores.ValorIss || '0'));
      const aliquotaDec = parseFloat(String(valores.Aliquota ?? 'NaN'));
      const aliquotaPerc = aliquotaDec > 1 ? aliquotaDec : (aliquotaDec * 100);
      const issRetido = String(valores.IssRetido || '') === '1';
      const discriminacao = String(servico.Discriminacao || '').trim();
      const itemServico = String(servico.ItemListaServico || '');

      const tomadorObj = comp.Nfse?.InfNfse?.TomadorServico || declaracao.TomadorServico || infNfse.Tomador || {};
      const tomadorNome = String(tomadorObj.RazaoSocial || tomadorObj.NomeTomador || 'Tomador Não Informado').trim();
      const tomadorDoc = cleanNumeric(tomadorObj.IdentificacaoTomador?.CpfCnpj?.Cnpj || tomadorObj.IdentificacaoTomador?.CpfCnpj?.Cpf || '');
      const tomadorEnder = tomadorObj.Endereco || {};
      const tomadorMun = String(tomadorEnder.xMun || tomadorEnder.CodigoMunicipio || '');
      const tomadorUf = String(tomadorEnder.Uf || '');

      if (isCancelada) {
        canceladas++;
      } else {
        totalServicos += valServ;
        totalIss += valIss;
      }

      if (!isNaN(numNum)) {
        numerosParaGaps.push(numNum);
      }

      // Arquivos individuais: NFSe_<8_digitos>_MM.AAAA.xml e .pdf
      const baseName = `NFSe_${numPad8}_${mesAno}`;
      const indXmlFileName = `${baseName}.xml`;
      const indPdfFileName = `${baseName}.pdf`;

      const indXmlStoragePath = path.join(storageDir, indXmlFileName);
      const indPdfStoragePath = path.join(storageDir, indPdfFileName);

      // Salva XML individual
      const xmlCompStr = originals[index];
      fs.writeFileSync(indXmlStoragePath, xmlCompStr, 'utf8');

      // Gera DANFSe PDF
      fs.writeFileSync(indPdfStoragePath, await originalNfsePdf(xmlCompStr));

      // Copia para pasta do Google Drive local se disponível
      if (localDriveDir) {
        try {
          fs.writeFileSync(path.join(localDriveDir, indXmlFileName), xmlCompStr, 'utf8');
          fs.copyFileSync(indPdfStoragePath, path.join(localDriveDir, indPdfFileName));
        } catch (_) {}
      }

      // 10. Persistência na tabela invoices (evitando duplicatas)
      const chaveAcesso = `NFSE${cleanCnpj}${numPad8}`;
      const nowIso = new Date().toISOString();

      try {
        const existing = db.prepare('SELECT id FROM invoices WHERE chave_acesso = ?').get(chaveAcesso) as any;
        if (existing) {
          db.prepare(`
            UPDATE invoices SET
              numero = ?,
              serie = '1',
              modelo = 'NFS-e',
              tipo = '1',
              status = ?,
              data_emissao = ?,
              emitente_cnpj = ?,
              emitente_nome = ?,
              emitente_uf = 'BA',
              destinatario_cnpj = ?,
              destinatario_nome = ?,
              destinatario_uf = ?,
              valor_total = ?,
              valor_produtos = ?,
              xml_file_path = ?,
              pdf_file_path = ?
            WHERE id = ?
          `).run(
            numStr,
            isCancelada ? 'cancelada' : 'autorizada',
            dataEmissao,
            cleanCnpj,
            company.razao_social,
            tomadorDoc,
            tomadorNome,
            tomadorUf,
            valServ,
            valServ,
            indXmlStoragePath,
            indPdfStoragePath,
            existing.id
          );
        } else {
          const newInvoiceId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO invoices (
              id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
              natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
              destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total, valor_produtos,
              xml_file_path, pdf_file_path, created_at
            ) VALUES (
              ?, ?, ?, ?, '1', 'NFS-e', '1', ?,
              'Prestação de Serviços', ?, ?, ?, 'BA',
              ?, ?, ?, ?, ?,
              ?, ?, ?
            )
          `).run(
            newInvoiceId,
            company.id,
            chaveAcesso,
            numStr,
            isCancelada ? 'cancelada' : 'autorizada',
            dataEmissao,
            cleanCnpj,
            company.razao_social,
            tomadorDoc,
            tomadorNome,
            tomadorUf,
            valServ,
            valServ,
            indXmlStoragePath,
            indPdfStoragePath,
            nowIso
          );
        }
      } catch (dbErr: any) {
        console.warn(`[NFS-e] Aviso ao persistir nota ${numStr} no banco:`, dbErr.message);
      }

      notasParaRelatorio.push({
        numero: numNum,
        numPad8,
        dataEmissao,
        tomadorNome,
        tomadorDoc,
        valorServicos: valServ,
        valorIss: valIss,
        isCancelada
      });
    }

    // 11. Ordenação e Verificação de Gaps na Sequência Numérica
    notasParaRelatorio.sort((a, b) => a.numero - b.numero);
    numerosParaGaps.sort((a, b) => a - b);

    const gaps: number[] = [];
    if (numerosParaGaps.length > 1) {
      for (let i = 0; i < numerosParaGaps.length - 1; i++) {
        const atual = numerosParaGaps[i];
        const proximo = numerosParaGaps[i + 1];
        if (proximo > atual + 1) {
          for (let g = atual + 1; g < proximo; g++) {
            gaps.push(g);
          }
        }
      }
    }

    const primeiraNota = notasParaRelatorio.length > 0 ? notasParaRelatorio[0].numero : 0;
    const ultimaNota = notasParaRelatorio.length > 0 ? notasParaRelatorio[notasParaRelatorio.length - 1].numero : 0;

    // 12. Geração do Relatório de Conferência Mensal em PDF
    const relatorioFileName = `RELATORIO_CONFERENCIA_NFSE_${mesAno}.pdf`;
    const relatorioStoragePath = path.join(storageDir, relatorioFileName);

    const confData: MonthlyConferenceData = {
      empresa: company.razao_social,
      cnpj: company.cnpj,
      cga,
      mesAno,
      totalNotas: notasParaRelatorio.length,
      primeiraNota,
      ultimaNota,
      totalServicos,
      totalIss,
      canceladas,
      gaps,
      notas: notasParaRelatorio
    };

    await nfsePdfGenerator.generateMonthlyConferenceReport(confData, relatorioStoragePath);

    if (localDriveDir) {
      try {
        fs.copyFileSync(relatorioStoragePath, path.join(localDriveDir, relatorioFileName));
      } catch (_) {}
    }

    console.log(`✅ [NFS-e Salvador] Competência ${mesAno} finalizada para ${company.razao_social}: ${compArray.length} notas processadas.`);

    return {
      success: true,
      empresa: company.razao_social,
      cnpj: company.cnpj,
      cga,
      competencia: mesAno,
      totalNotas: compArray.length,
      primeiraNota,
      ultimaNota,
      totalServicos,
      totalIss,
      canceladas,
      gaps,
      arquivosGerados: {
        xmlConsolidado: consolidatedStoragePath,
        relatorioConferenciaPdf: relatorioStoragePath,
        totalXmlsIndividuais: compArray.length,
        totalPdfsIndividuais: compArray.length,
        diretorioStorage: storageDir,
        diretorioDriveLocal: localDriveDir
      },
      mensagem: `Competência ${mesAno} sincronizada com sucesso! Foram capturadas ${compArray.length} notas, gerado XML consolidado, PDFs individuais e Relatório de Conferência.`
    };
  }
};
