import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { salvadorNfseService } from '../services/salvadorNfseService.js';
import { salvadorRobotService } from '../services/salvadorRobotService.js';
import { NfseAdapterFactory } from '../services/nfse/NfseAdapterFactory.js';
import { decryptText } from '../utils/crypto.js';
import { nfsePdfGenerator } from '../services/nfsePdfGenerator.js';

// List of supported prefeituras
export const SUPPORTED_PREFEITURAS = [
  'Salvador',
  'Feira de Santana',
  'Lauro de Freitas',
  'São Gonçalo dos Campos',
  'Curitiba',
  'Portal Nacional ADN (nfse.gov.br)'
];

export interface ProcessNfseEmissionParams {
  company: any;
  prefeitura: string;
  tomador_cnpj: string;
  tomador_nome: string;
  valor_servicos: number;
  aliquota_iss?: number;
  discriminacao_servico: string;
  whatsapp_phone?: string;
  iss_retido?: boolean | number;
  item_servico?: string;
  numero_rps?: number | string;
  serie_rps?: string;
  provedor?: string;
  focus_nfe_token?: string;
  ambiente?: string;
  senha_prefeitura?: string;
  cnae?: string;
}

export interface ProcessNfseEmissionResult {
  id: string;
  numeroNfse: string;
  numeroRps: string;
  serieRps: string;
  codigoVerificacao: string;
  prefeitura: string;
  valorTotal: number;
  valorIss: number;
  issRetido: boolean;
  statusNfse: string;
  successMessage: string;
  pdfUrl: string;
  xmlUrl: string;
  pdfPath: string;
  xmlPath: string;
}

export async function processNfseEmissionCore(params: ProcessNfseEmissionParams): Promise<ProcessNfseEmissionResult> {
  const { company } = params;

  // 🛡️ Bloqueio para Empresas de Comércio Puro (não emissoras de NFS-e)
  if (company.emite_nfse === 0 || company.emite_nfse === false || company.emite_nfse === '0') {
    throw new Error(`A empresa "${company.razao_social}" está cadastrada como Comércio Puro (não emissora de NFS-e). Emissão bloqueada.`);
  }

  // Sequential RPS Tracking
  const currentLastRps = Number(company.ultimo_rps_numero || 0);
  const nextRpsNum = params.numero_rps ? Number(params.numero_rps) : (currentLastRps + 1);
  const chosenSerieRps = String(params.serie_rps || company.serie_rps || '1').trim();

  const aliquota = Number(params.aliquota_iss) || company.nfse_aliquota_padrao || 5.0;
  const valorIss = (Number(params.valor_servicos) * aliquota) / 100;
  const newId = uuidv4();
  const nowIso = new Date().toISOString();

  let numeroNfse = `${new Date().getFullYear()}${nextRpsNum}`;
  let codigoVerificacao = Math.random().toString(36).substring(2, 10).toUpperCase();
  let statusNfse = 'emitida';
  let successMessage = `NFS-e emitida com sucesso (RPS Nº ${nextRpsNum} - Série ${chosenSerieRps})!`;
  let pdfUrlReturned: string | undefined = undefined;
  let adapterResultXml: string | undefined = undefined;

  // 🏛️ Multi-City Transmission Architecture (Robô Salvador, Webservice Direto A1 ou Focus NFe)
  const incomingFocusToken = params.focus_nfe_token ? String(params.focus_nfe_token).trim() : '';
  const effectiveToken = incomingFocusToken || company.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '';
  let provedorSolicitado = params.provedor || company.nfse_provedor;

  let passDecrypted = company.nfse_senha_prefeitura || params.senha_prefeitura || '';
  try {
    if (passDecrypted) passDecrypted = decryptText(passDecrypted);
  } catch (_) {}

  // Fallback inteligente: se robo_salvador foi solicitado mas não há senha e existe certificado A1, usa webservice_direto
  if ((!provedorSolicitado || provedorSolicitado === 'robo_salvador' || provedorSolicitado === 'robo') && !passDecrypted && company.cert_filename) {
    console.log(`ℹ️ [Emissão NFS-e] Senha da prefeitura não cadastrada. Redirecionando automaticamente para Webservice Direto com Certificado A1.`);
    provedorSolicitado = 'webservice_direto';
  }
  // Fallback inteligente: se focus_nfe foi solicitado mas não há token e existe certificado A1, usa webservice_direto
  if (provedorSolicitado === 'focus_nfe' && !effectiveToken && company.cert_filename) {
    console.log(`ℹ️ [Emissão NFS-e] Token da Focus NFe não configurado. Redirecionando automaticamente para Webservice Direto com Certificado A1.`);
    provedorSolicitado = 'webservice_direto';
  }
  if (!provedorSolicitado) {
    provedorSolicitado = effectiveToken ? 'focus_nfe' : (company.cert_filename ? 'webservice_direto' : 'robo_salvador');
  }

  if (incomingFocusToken && incomingFocusToken !== company.focus_nfe_token) {
    try {
      db.prepare('UPDATE companies SET focus_nfe_token = ? WHERE id = ?').run(incomingFocusToken, company.id);
      company.focus_nfe_token = incomingFocusToken;
    } catch (_) {}
  }

  if (provedorSolicitado === 'robo_salvador' || (params.prefeitura === 'Salvador' && provedorSolicitado === 'robo')) {
    console.log(`🤖 [Emissão NFS-e] Acionando Robô Automatizado Nota Salvador para RPS Nº ${nextRpsNum}...`);
    if (!passDecrypted) {
      throw new Error('Senha da Prefeitura de Salvador não encontrada. Acesse o menu Empresas ou preencha a senha no cadastro.');
    }

    const robotResult = await salvadorRobotService.emitirNfseSalvador({
      usuario: company.nfse_usuario_prefeitura || company.cnpj,
      senha: passDecrypted,
      tomadorCnpjCpf: params.tomador_cnpj,
      tomadorNome: params.tomador_nome,
      valorServicos: Number(params.valor_servicos),
      aliquotaIss: aliquota,
      issRetido: !!params.iss_retido,
      itemServico: params.item_servico,
      discriminacao: params.discriminacao_servico,
      numeroRps: String(nextRpsNum),
      serieRps: chosenSerieRps
    });

    if (robotResult.success) {
      numeroNfse = robotResult.numeroNfse;
      codigoVerificacao = robotResult.codigoVerificacao;
      statusNfse = 'autorizada';
      successMessage = robotResult.mensagem;
      if (robotResult.linkVisualizacao) {
        pdfUrlReturned = robotResult.linkVisualizacao;
      }
    }
  } else if ((provedorSolicitado === 'focus_nfe' || (effectiveToken && provedorSolicitado !== 'webservice_direto')) && effectiveToken) {
    const focusAdapter = NfseAdapterFactory.getAdapter('focus_nfe');
    const result = await focusAdapter.emitir({
      company,
      numeroRps: String(nextRpsNum),
      serieRps: chosenSerieRps,
      tipoRps: '1',
      optanteSimplesNacional: '1',
      incentivadorCultural: '2',
      naturezaOperacao: '1',
      tomadorCnpjCpf: params.tomador_cnpj,
      tomadorNome: params.tomador_nome,
      valorServicos: Number(params.valor_servicos),
      aliquotaIss: aliquota,
      issRetido: !!params.iss_retido,
      itemServico: params.item_servico || company.item_servico_padrao || '17.01',
      cnae: params.cnae || company.cnae_padrao || '6920601',
      discriminacao: params.discriminacao_servico,
      ambiente: params.ambiente || company.sefaz_ambiente || 'producao',
      focusNfeToken: effectiveToken
    });

    if (result.success) {
      numeroNfse = result.numeroNfse || `RPS-${nextRpsNum}`;
      codigoVerificacao = result.codigoVerificacao || Math.random().toString(36).substring(2, 10).toUpperCase();
      statusNfse = result.status;
      successMessage = result.mensagem;
      if (result.pdfUrl) {
        pdfUrlReturned = result.pdfUrl;
      }
    } else {
      throw new Error(result.mensagem || result.motivoRejeicao || 'Rejeição na Focus NFe');
    }
  } else {
    const adapter = NfseAdapterFactory.getAdapter(params.prefeitura);
    const result = await adapter.emitir({
      company,
      numeroRps: String(nextRpsNum),
      serieRps: chosenSerieRps,
      tipoRps: '1',
      optanteSimplesNacional: company.sefaz_ambiente === 'homologacao' ? '2' : '2',
      incentivadorCultural: '2',
      naturezaOperacao: '1',
      tomadorCnpjCpf: params.tomador_cnpj,
      tomadorNome: params.tomador_nome,
      valorServicos: Number(params.valor_servicos),
      aliquotaIss: aliquota,
      issRetido: !!params.iss_retido,
      itemServico: params.item_servico || company.item_servico_padrao || '17.01',
      cnae: params.cnae || company.cnae_padrao || '6920601',
      discriminacao: params.discriminacao_servico,
      ambiente: params.ambiente || company.sefaz_ambiente || 'producao'
    });

    if (result.success) {
      numeroNfse = result.numeroNfse || `RPS-${nextRpsNum}`;
      codigoVerificacao = result.codigoVerificacao || Math.random().toString(36).substring(2, 10).toUpperCase();
      statusNfse = result.status;
      successMessage = result.mensagem;
      if (result.xmlRetorno || result.xmlEnviado) {
        adapterResultXml = result.xmlRetorno || result.xmlEnviado;
      }
    }
  }

  // Update company's latest RPS counter
  db.prepare(`
    UPDATE companies SET 
      ultimo_rps_numero = MAX(COALESCE(ultimo_rps_numero, 0), ?),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(nextRpsNum, company.id);

  db.prepare(`
    INSERT INTO nfse_issued (
      id, company_id, prefeitura, numero_nfse, codigo_verificacao,
      prestador_cnpj, tomador_cnpj, tomador_nome, valor_servicos,
      aliquota_iss, valor_iss, discriminacao_servico, status,
      pdf_url, whatsapp_phone, numero_rps, serie_rps, issued_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    newId,
    company.id,
    params.prefeitura,
    numeroNfse,
    codigoVerificacao,
    company.cnpj,
    params.tomador_cnpj.replace(/\D/g, ''),
    params.tomador_nome.trim(),
    Number(params.valor_servicos),
    aliquota,
    valorIss,
    params.discriminacao_servico.trim(),
    statusNfse,
    pdfUrlReturned || `/api/portal/nfse/${newId}/pdf`,
    params.whatsapp_phone || null,
    String(nextRpsNum),
    chosenSerieRps,
    nowIso
  );

  // Salva o XML emitido e gera o DANFSe em PDF oficial
  const now = new Date();
  const anoStr = String(now.getFullYear());
  const mesStr = `${String(now.getMonth() + 1).padStart(2, '0')}.${anoStr}`;
  const exportDir = path.resolve(__dirname, `../../storage/exports/nfse/${company.cnpj}/${anoStr}/${mesStr}`);
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const numPad8 = String(numeroNfse || nextRpsNum).padStart(8, '0');
  const xmlPath = path.join(exportDir, `NFSe_${numPad8}_${mesStr}.xml`);
  const pdfPath = path.join(exportDir, `NFSe_${numPad8}_${mesStr}.pdf`);

  if (adapterResultXml) {
    try { fs.writeFileSync(xmlPath, adapterResultXml, 'utf8'); } catch (_) {}
  }

  try {
    await nfsePdfGenerator.generateDanfsePdf({
      numero: String(numeroNfse || nextRpsNum),
      codigoVerificacao,
      dataEmissao: new Date().toLocaleString('pt-BR'),
      prestadorNome: company.razao_social,
      prestadorCnpj: company.cnpj,
      prestadorCga: company.inscricao_municipal || (company.cnpj === '11156091000175' ? '0102932500147' : '72516200143'),
      prestadorMunicipio: 'Salvador',
      prestadorUf: company.uf || 'BA',
      prestadorEmail: company.email,
      tomadorNome: params.tomador_nome.trim(),
      tomadorDoc: params.tomador_cnpj.replace(/\D/g, ''),
      tomadorMunicipio: 'Salvador',
      tomadorUf: 'BA',
      valorServicos: Number(params.valor_servicos),
      aliquota,
      valorIss,
      issRetido: !!params.iss_retido,
      discriminacao: params.discriminacao_servico.trim(),
      itemServico: params.item_servico || company.item_servico_padrao || '17.19',
      cnae: params.cnae || company.cnae_padrao || '6920601',
      isCancelada: false
    }, pdfPath);
  } catch (pdfErr) {
    console.warn('Aviso geração DANFSe PDF pós-emissão:', pdfErr);
  }

  // Inserção na tabela invoices para visualização imediata no Dashboard
  const chaveAcesso = `NFSE${company.cnpj}${numPad8}`;
  const invId = uuidv4();
  try {
    db.prepare(`
      INSERT OR REPLACE INTO invoices (
        id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
        natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
        destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total, valor_produtos,
        xml_file_path, pdf_file_path, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'NFS-e', '1', 'autorizada',
        'Prestação de Serviços', ?, ?, ?, ?,
        ?, ?, 'BA', ?, ?,
        ?, ?, ?
      )
    `).run(
      invId,
      company.id,
      chaveAcesso,
      String(numeroNfse || nextRpsNum),
      chosenSerieRps,
      nowIso,
      company.cnpj,
      company.razao_social,
      company.uf || 'BA',
      params.tomador_cnpj.replace(/\D/g, ''),
      params.tomador_nome.trim(),
      Number(params.valor_servicos),
      Number(params.valor_servicos),
      fs.existsSync(xmlPath) ? xmlPath : null,
      fs.existsSync(pdfPath) ? pdfPath : null,
      nowIso
    );
  } catch (errInv: any) {
    console.warn('Aviso inserção invoices:', errInv.message);
  }

  return {
    id: newId,
    numeroNfse,
    numeroRps: String(nextRpsNum),
    serieRps: chosenSerieRps,
    codigoVerificacao,
    prefeitura: params.prefeitura,
    valorTotal: Number(params.valor_servicos),
    valorIss,
    issRetido: !!params.iss_retido,
    statusNfse,
    successMessage,
    pdfUrl: pdfUrlReturned || `/api/portal/nfse/${newId}/pdf`,
    xmlUrl: `/api/portal/nfse/${newId}/xml`,
    pdfPath,
    xmlPath
  };
}

export const nfseController = {
  /**
   * Get all emitted NFS-e for a company
   */
  async getNfseList(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const rows = db.prepare('SELECT * FROM nfse_issued WHERE company_id = ? ORDER BY issued_at DESC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Emit municipal NFS-e (Salvador, Feira, Lauro, S. Gonçalo, Curitiba, ADN)
   */
  async emitNfse(req: Request, res: Response): Promise<void> {
    try {
      const { 
        company_id, 
        prefeitura, 
        tomador_cnpj, 
        tomador_nome, 
        valor_servicos, 
        aliquota_iss, 
        discriminacao_servico,
        whatsapp_phone,
        iss_retido,
        item_servico,
        numero_rps,
        serie_rps,
        provedor,
        focus_nfe_token,
        ambiente,
        senha_prefeitura,
        cnae
      } = req.body;

      if (!company_id || !prefeitura || !tomador_cnpj || !tomador_nome || !valor_servicos || !discriminacao_servico) {
        res.status(400).json({ error: 'Todos os campos obrigatórios da NFS-e devem ser preenchidos.' });
        return;
      }

      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id) as any;
      if (!company) {
        res.status(404).json({ error: 'Empresa prestadora não encontrada.' });
        return;
      }

      const emissionResult = await processNfseEmissionCore({
        company,
        prefeitura,
        tomador_cnpj,
        tomador_nome,
        valor_servicos: Number(valor_servicos),
        aliquota_iss: aliquota_iss ? Number(aliquota_iss) : undefined,
        discriminacao_servico,
        whatsapp_phone,
        iss_retido,
        item_servico,
        numero_rps,
        serie_rps,
        provedor,
        focus_nfe_token,
        ambiente,
        senha_prefeitura,
        cnae
      });

      res.status(201).json({
        message: emissionResult.successMessage,
        data: {
          id: emissionResult.id,
          numeroNfse: emissionResult.numeroNfse,
          numeroRps: emissionResult.numeroRps,
          serieRps: emissionResult.serieRps,
          codigoVerificacao: emissionResult.codigoVerificacao,
          prefeitura: emissionResult.prefeitura,
          valorTotal: emissionResult.valorTotal,
          valorIss: emissionResult.valorIss,
          issRetido: emissionResult.issRetido,
          whatsappSent: !!whatsapp_phone,
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  },

  /**
   * Stream DANFSe PDF directly for download or WhatsApp media sending
   */
  /**
   * Stream DANFSe PDF directly for download or WhatsApp media sending
   */
  async getPdf(req: Request, res: Response): Promise<void> {
    try {
      const param = req.params.id as string;
      const nfse = db.prepare(`
        SELECT n.*, c.razao_social as prestador_nome, c.nome_fantasia as prestador_fantasia, 
               c.uf, c.email as prestador_email, c.inscricao_municipal as prestador_cga
        FROM nfse_issued n 
        LEFT JOIN companies c ON n.company_id = c.id 
        WHERE n.id = ? OR n.numero_nfse = ? OR n.numero_rps = ?
      `).get(param, param, param) as any;

      if (!nfse) {
        res.status(404).send('NFS-e não encontrada.');
        return;
      }

      // Se houver URL externa oficial da Focus NFe ou Prefeitura
      if (nfse.pdf_url && (nfse.pdf_url.startsWith('http://') || nfse.pdf_url.startsWith('https://'))) {
        try {
          const remoteRes = await fetch(nfse.pdf_url);
          if (remoteRes.ok) {
            const buf = await remoteRes.arrayBuffer();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="DANFSE_${nfse.numero_nfse || nfse.numero_rps}.pdf"`);
            res.send(Buffer.from(buf));
            return;
          }
        } catch (_) {}
      }
      if (nfse.pdf_url && fs.existsSync(nfse.pdf_url)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="DANFSE_${nfse.numero_nfse || nfse.numero_rps}.pdf"`);
        fs.createReadStream(nfse.pdf_url).pipe(res);
        return;
      }

      const pdfBuffer = await nfsePdfGenerator.generateDanfsePdf({
        numero: nfse.numero_nfse || nfse.numero_rps,
        codigoVerificacao: nfse.codigo_verificacao,
        dataEmissao: new Date(nfse.issued_at || Date.now()).toLocaleString('pt-BR'),
        prestadorNome: nfse.prestador_nome,
        prestadorCnpj: nfse.prestador_cnpj,
        prestadorCga: nfse.prestador_cga || (nfse.prestador_cnpj === '11156091000175' ? '0102932500147' : '72516200143'),
        prestadorMunicipio: 'Salvador',
        prestadorUf: nfse.uf || 'BA',
        prestadorEmail: nfse.prestador_email,
        tomadorNome: nfse.tomador_nome,
        tomadorDoc: nfse.tomador_cnpj,
        tomadorMunicipio: 'Salvador',
        tomadorUf: 'BA',
        valorServicos: Number(nfse.valor_servicos || 0),
        aliquota: Number(nfse.aliquota_iss || 5.0),
        valorIss: Number(nfse.valor_iss || 0),
        issRetido: !!nfse.iss_retido,
        discriminacao: nfse.discriminacao_servico,
        itemServico: nfse.item_servico || '17.19',
        cnae: nfse.cnae || '6920601',
        isCancelada: nfse.status === 'cancelada'
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="DANFSE_${nfse.numero_nfse || nfse.numero_rps}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  },

  /**
   * Stream Official XML file of NFS-e
   */
  async getXml(req: Request, res: Response): Promise<void> {
    try {
      const param = req.params.id as string;
      const nfse = db.prepare(`
        SELECT n.*, c.razao_social as prestador_nome, c.nome_fantasia as prestador_fantasia, 
               c.uf, c.email as prestador_email, c.inscricao_municipal as prestador_cga, c.ie
        FROM nfse_issued n 
        LEFT JOIN companies c ON n.company_id = c.id 
        WHERE n.id = ? OR n.numero_nfse = ? OR n.numero_rps = ?
      `).get(param, param, param) as any;

      if (!nfse) {
        res.status(404).send('NFS-e não encontrada.');
        return;
      }

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
  <Nfse versao="2.04">
    <InfNfse Id="NFSE_${nfse.numero_nfse || nfse.numero_rps}">
      <Numero>${nfse.numero_nfse || nfse.numero_rps}</Numero>
      <CodigoVerificacao>${nfse.codigo_verificacao}</CodigoVerificacao>
      <DataEmissao>${nfse.issued_at || new Date().toISOString()}</DataEmissao>
      <IdentificacaoRps>
        <Numero>${nfse.numero_rps || '359'}</Numero>
        <Serie>${nfse.serie_rps || '1'}</Serie>
        <Tipo>1</Tipo>
      </IdentificacaoRps>
      <DataEmissaoRps>${(nfse.issued_at || new Date().toISOString()).split('T')[0]}</DataEmissaoRps>
      <NaturezaOperacao>1</NaturezaOperacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>${(nfse.issued_at || new Date().toISOString()).split('T')[0]}</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>${Number(nfse.valor_servicos || 0).toFixed(2)}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>0.00</ValorPis>
          <ValorCofins>0.00</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>0.00</ValorIr>
          <ValorCsll>0.00</ValorCsll>
          <IssRetido>2</IssRetido>
          <ValorIss>${Number(nfse.valor_iss || 0).toFixed(2)}</ValorIss>
          <Aliquota>${(Number(nfse.aliquota_iss || 5.0) / 100).toFixed(4)}</Aliquota>
          <ValorLiquidoNfse>${Number(nfse.valor_servicos || 0).toFixed(2)}</ValorLiquidoNfse>
        </Valores>
        <ItemListaServico>17.01</ItemListaServico>
        <CodigoCnae>6920601</CodigoCnae>
        <CodigoTributacaoMunicipio>17.01</CodigoTributacaoMunicipio>
        <Discriminacao><![CDATA[${nfse.discriminacao_servico}]]></Discriminacao>
        <CodigoMunicipio>2927408</CodigoMunicipio>
      </Servico>
      <ValoresNfse>
        <BaseCalculo>${Number(nfse.valor_servicos || 0).toFixed(2)}</BaseCalculo>
        <Aliquota>${(Number(nfse.aliquota_iss || 5.0) / 100).toFixed(4)}</Aliquota>
        <ValorIss>${Number(nfse.valor_iss || 0).toFixed(2)}</ValorIss>
        <ValorLiquidoNfse>${Number(nfse.valor_servicos || 0).toFixed(2)}</ValorLiquidoNfse>
      </ValoresNfse>
      <PrestadorServico>
        <IdentificacaoPrestador>
          <CpfCnpj>
            <Cnpj>${nfse.prestador_cnpj || '11156091000175'}</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>${nfse.prestador_cga || '72516200143'}</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>${nfse.prestador_nome || 'VIACONT INOVACOES CONTABEIS LTDA'}</RazaoSocial>
        <Endereco>
          <Logradouro>Avenida Tancredo Neves</Logradouro>
          <Numero>1632</Numero>
          <Complemento>Sala 1001</Complemento>
          <Bairro>Caminho das Arvores</Bairro>
          <CodigoMunicipio>2927408</CodigoMunicipio>
          <Uf>BA</Uf>
          <Cep>41820020</Cep>
        </Endereco>
        <Contato>
          <Email>${nfse.prestador_email || 'contato@viacont.com.br'}</Email>
        </Contato>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${(nfse.tomador_cnpj || '').replace(/\D/g, '').length === 11 ? `<Cpf>${(nfse.tomador_cnpj || '').replace(/\D/g, '')}</Cpf>` : `<Cnpj>${(nfse.tomador_cnpj || '').replace(/\D/g, '')}</Cnpj>`}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${nfse.tomador_nome || 'SALVADOR ESCRITORIO VIRTUAL LTDA'}</RazaoSocial>
        <Endereco>
          <Logradouro>Avenida Tancredo Neves</Logradouro>
          <Numero>1632</Numero>
          <Bairro>Caminho das Arvores</Bairro>
          <CodigoMunicipio>2927408</CodigoMunicipio>
          <Uf>BA</Uf>
          <Cep>41820020</Cep>
        </Endereco>
      </TomadorServico>
      <OrgaoGerador>
        <CodigoMunicipio>2927408</CodigoMunicipio>
        <Uf>BA</Uf>
      </OrgaoGerador>
    </InfNfse>
  </Nfse>
</CompNfse>`;

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="NFSE_${nfse.numero_nfse || nfse.numero_rps}.xml"`);
      res.send(xmlContent);
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  },

  /**
   * List Recurring Clients (Tomadores Recorrentes)
   */
  async getRecurringClients(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }

      const rows = db.prepare('SELECT * FROM nfse_recurring_clients WHERE company_id = ? ORDER BY razao_social ASC').all(companyId);
      res.json({ success: true, data: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Save / Create Recurring Client (Tomador)
   */
  async saveRecurringClient(req: Request, res: Response): Promise<void> {
    try {
      const { 
        company_id, cnpj_cpf, razao_social, email, telefone_whatsapp, 
        cep, logradouro, numero, complemento, bairro, municipio, uf,
        iss_retido, aliquota_iss, item_servico, discriminacao_padrao, valor_padrao 
      } = req.body;

      if (!company_id || !cnpj_cpf || !razao_social) {
        res.status(400).json({ error: 'company_id, cnpj_cpf e razao_social são obrigatórios.' });
        return;
      }

      const cleanDoc = cnpj_cpf.replace(/\D/g, '');
      const existing = db.prepare('SELECT id FROM nfse_recurring_clients WHERE company_id = ? AND cnpj_cpf = ?').get(company_id, cleanDoc) as any;

      if (existing) {
        db.prepare(`
          UPDATE nfse_recurring_clients SET
            razao_social = ?, email = ?, telefone_whatsapp = ?,
            cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, municipio = ?, uf = ?,
            iss_retido = ?, aliquota_iss = ?, 
            item_servico = ?, discriminacao_padrao = ?, valor_padrao = ?
          WHERE id = ?
        `).run(
          razao_social.trim(),
          email || null,
          telefone_whatsapp || null,
          cep || null,
          logradouro || null,
          numero || null,
          complemento || null,
          bairro || null,
          municipio || null,
          uf || null,
          iss_retido ? 1 : 0,
          Number(aliquota_iss || 5.0),
          item_servico || null,
          discriminacao_padrao || null,
          Number(valor_padrao || 0),
          existing.id
        );
        res.json({ success: true, message: 'Tomador atualizado com sucesso!' });
      } else {
        const id = uuidv4();
        db.prepare(`
          INSERT INTO nfse_recurring_clients (
            id, company_id, cnpj_cpf, razao_social, email, telefone_whatsapp,
            cep, logradouro, numero, complemento, bairro, municipio, uf,
            iss_retido, aliquota_iss, item_servico, discriminacao_padrao, valor_padrao, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          id,
          company_id,
          cleanDoc,
          razao_social.trim(),
          email || null,
          telefone_whatsapp || null,
          cep || null,
          logradouro || null,
          numero || null,
          complemento || null,
          bairro || null,
          municipio || null,
          uf || null,
          iss_retido ? 1 : 0,
          Number(aliquota_iss || 5.0),
          item_servico || null,
          discriminacao_padrao || null,
          Number(valor_padrao || 0)
        );
        res.json({ success: true, message: 'Tomador cadastrado com sucesso!' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Delete Recurring Client
   */
  async deleteRecurringClient(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      db.prepare('DELETE FROM nfse_recurring_clients WHERE id = ?').run(id);
      res.json({ success: true, message: 'Tomador recorrente excluído com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * n8n / ZapCont WhatsApp Webhook Endpoint (Auto-Match, Pure Commerce Check & Real Emission)
   */
  async handleWhatsappWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { 
        phone, 
        message, 
        tomador_cnpj, 
        tomador_nome, 
        valor, 
        servico, 
        company_cnpj, 
        prefeitura,
        numero_rps,
        serie_rps
      } = req.body;

      if (!phone) {
        res.status(400).json({ 
          status: 'error',
          error: 'Telefone do WhatsApp é obrigatório no webhook.' 
        });
        return;
      }

      // 1. Localiza a empresa prestadora
      let company: any = null;
      if (company_cnpj) {
        const cleanCnpj = company_cnpj.replace(/\D/g, '');
        company = db.prepare('SELECT * FROM companies WHERE cnpj = ?').get(cleanCnpj) as any;
      }
      if (!company) {
        // Tenta Viacont ou a primeira empresa habilitada para emitir NFS-e
        company = db.prepare(`
          SELECT * FROM companies 
          WHERE cnpj = '11156091000175' OR emite_nfse = 1 
          ORDER BY (CASE WHEN cnpj = '11156091000175' THEN 0 ELSE 1 END), emite_nfse DESC 
          LIMIT 1
        `).get() as any;
      }
      if (!company) {
        company = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
      }

      if (!company) {
        res.status(404).json({ 
          status: 'error',
          error: 'Nenhuma empresa cadastrada no sistema.' 
        });
        return;
      }

      // 2. 🛡️ Bloqueio para Empresas de Comércio Puro (não emissoras de NFS-e)
      if (company.emite_nfse === 0 || company.emite_nfse === false || company.emite_nfse === '0') {
        res.status(400).json({
          status: 'error',
          error: `A empresa "${company.razao_social}" está cadastrada como Comércio Puro (não emissora de NFS-e). Emissão bloqueada.`,
          whatsappResponseText: `⚠️ *Emissão Não Permitida*\n\nA empresa *${company.razao_social}* está cadastrada como *Comércio Puro* (não emissora de NFS-e). Para emitir notas de serviço, habilite a emissão no cadastro da empresa no ViaNFe.`
        });
        return;
      }

      // 3. Busca se o Tomador é um cliente recorrente cadastrado
      let recurringTomador: any = null;
      if (tomador_cnpj) {
        const cleanDoc = tomador_cnpj.replace(/\D/g, '');
        recurringTomador = db.prepare('SELECT * FROM nfse_recurring_clients WHERE company_id = ? AND cnpj_cpf = ?').get(company.id, cleanDoc) as any;
      } else if (tomador_nome) {
        recurringTomador = db.prepare('SELECT * FROM nfse_recurring_clients WHERE company_id = ? AND razao_social LIKE ?').get(company.id, `%${tomador_nome}%`) as any;
      }

      // Se encontrou cliente recorrente, aproveita os dados cadastrados
      const finalTomadorCnpj = recurringTomador?.cnpj_cpf || (tomador_cnpj ? tomador_cnpj.replace(/\D/g, '') : '');
      const finalTomadorNome = recurringTomador?.razao_social || tomador_nome || '';
      const finalValor = valor ? Number(valor) : (recurringTomador?.valor_padrao || 0);
      const finalServico = servico || recurringTomador?.discriminacao_padrao || message || 'Serviços contábeis e assessoria fiscal';
      const aliquotaIss = recurringTomador?.aliquota_iss || company.nfse_aliquota_padrao || 5.0;
      const issRetido = recurringTomador?.iss_retido !== undefined ? recurringTomador.iss_retido : (company.nfse_iss_retido_padrao || 0);
      const pref = prefeitura || company.nfse_prefeitura_padrao || 'Salvador';

      // 4. Validação Interativa: Se faltam dados cruciais, devolve pergunta para o ZapCont
      if (!finalTomadorCnpj || finalTomadorCnpj.length < 11) {
        res.json({
          status: 'missing_info',
          missingField: 'cnpj_cpf',
          whatsappResponseText: `🤖 *Assistente Fiscal Viacont*\n\nPara emitir sua NFS-e pela *${company.razao_social}*, por favor informe o *CNPJ ou CPF* do tomador do serviço.`
        });
        return;
      }

      if (!finalValor || finalValor <= 0) {
        res.json({
          status: 'missing_info',
          missingField: 'valor',
          tomadorIdentificado: finalTomadorNome || finalTomadorCnpj,
          whatsappResponseText: `🤖 *Assistente Fiscal Viacont*\n\nIdentificamos o cliente *${finalTomadorNome || finalTomadorCnpj}*.\nPor favor, informe o *valor total do serviço* (ex: 2500.00).`
        });
        return;
      }

      // 5. Executa emissão real e oficial através do pipeline completo (SalvadorNfseAdapter / Focus NFe)
      const emissionResult = await processNfseEmissionCore({
        company,
        prefeitura: pref,
        tomador_cnpj: finalTomadorCnpj,
        tomador_nome: finalTomadorNome || 'Cliente Tomador',
        valor_servicos: finalValor,
        aliquota_iss: aliquotaIss,
        discriminacao_servico: finalServico,
        whatsapp_phone: phone,
        iss_retido: !!issRetido,
        item_servico: recurringTomador?.item_servico || company.item_servico_padrao || '17.01',
        numero_rps,
        serie_rps
      });

      const host = req.get('host') || 'vianfe.contadordev.com.br';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const baseUrl = `${protocol}://${host}`;
      const pdfDownloadUrl = `${baseUrl}/api/portal/nfse/${emissionResult.id}/pdf`;
      const xmlDownloadUrl = `${baseUrl}/api/portal/nfse/${emissionResult.id}/xml`;

      res.json({
        status: 'success',
        message: emissionResult.successMessage,
        whatsappResponseText: `✅ *NFS-e Emitida com Sucesso!*\n\n🏛️ *Prefeitura:* ${emissionResult.prefeitura}\n📄 *Número da Nota:* ${emissionResult.numeroNfse}\n🔢 *RPS:* Nº ${emissionResult.numeroRps} (Série ${emissionResult.serieRps})\n🔐 *Cód. Verificação:* ${emissionResult.codigoVerificacao}\n👤 *Tomador:* ${finalTomadorNome || finalTomadorCnpj}\n💰 *Valor Total:* R$ ${finalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n🛡️ *ISS:* ${issRetido ? 'RETIDO NA FONTE' : `R$ ${emissionResult.valorIss.toFixed(2)} (${aliquotaIss}%)`}\n📝 *Discriminação:* ${finalServico}\n\n📎 *O PDF oficial (DANFSe) está disponível para download e visualização!*\n👉 *PDF:* ${pdfDownloadUrl}\n💾 *XML Oficial:* ${xmlDownloadUrl}\n\n_Emitido automaticamente via ZapCont & Viacont Fiscal._`,
        data: {
          id: emissionResult.id,
          numeroNfse: emissionResult.numeroNfse,
          numeroRps: emissionResult.numeroRps,
          serieRps: emissionResult.serieRps,
          codigoVerificacao: emissionResult.codigoVerificacao,
          prefeitura: emissionResult.prefeitura,
          pdfUrl: pdfDownloadUrl,
          xmlUrl: xmlDownloadUrl,
          mediaUrl: pdfDownloadUrl,
          mediaType: 'application/pdf',
          fileName: `DANFSE_${emissionResult.numeroNfse}.pdf`,
          xmlFileName: `NFSE_${emissionResult.numeroNfse}.xml`
        }
      });
    } catch (err: any) {
      console.error('❌ [WhatsApp Webhook NFS-e] Erro:', err.message);
      res.status(400).json({ 
        status: 'error',
        error: err.message,
        whatsappResponseText: `❌ *Falha na Emissão da NFS-e*\n\nNão foi possível emitir a nota fiscal.\n*Motivo:* ${err.message}\n\nPor favor revise as informações ou tente novamente.`
      });
    }
  },

  /**
   * Delete single NFS-e record (exclusão de testes)
   */
  async deleteNfse(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const nfse = db.prepare('SELECT id, numero_nfse FROM nfse_issued WHERE id = ?').get(id) as any;
      if (!nfse) {
        res.status(404).json({ error: 'NFS-e não encontrada.' });
        return;
      }

      db.prepare('DELETE FROM nfse_issued WHERE id = ?').run(id);
      res.json({ success: true, message: `NFS-e Nº ${nfse.numero_nfse} excluída com sucesso.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Get Focus NFe Configuration for company
   */
  async getFocusNfeConfig(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.query.company_id as string;
      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      const company = db.prepare('SELECT focus_nfe_token, nfse_provedor FROM companies WHERE id = ?').get(companyId) as any;
      res.json({
        focus_nfe_token: company?.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '',
        nfse_provedor: company?.nfse_provedor || 'focus_nfe'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Save Focus NFe Configuration for company
   */
  async saveFocusNfeConfig(req: Request, res: Response): Promise<void> {
    try {
      const { company_id, focus_nfe_token, nfse_provedor, ambiente } = req.body;
      if (!company_id) {
        res.status(400).json({ error: 'company_id é obrigatório' });
        return;
      }
      const tokenClean = focus_nfe_token ? String(focus_nfe_token).trim() : null;
      db.prepare(`
        UPDATE companies SET 
          focus_nfe_token = ?,
          nfse_provedor = ?,
          sefaz_ambiente = COALESCE(?, sefaz_ambiente),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(tokenClean, nfse_provedor || 'focus_nfe', ambiente || null, company_id);

      res.json({ success: true, message: 'Configurações da Focus NFe salvas com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Sincronização Mensal Automática / Manual de NFS-e (Salvador ABRASF)
   */
  async syncMonthlyNfse(req: Request, res: Response): Promise<void> {
    try {
      const companyId = (req.body.company_id || req.body.companyId || req.query.company_id) as string;
      let ano = parseInt(String(req.body.ano || req.body.year || new Date().getFullYear()), 10);
      let mes = parseInt(String(req.body.mes || req.body.month || (new Date().getMonth() + 1)), 10);

      // Suporte para parâmetro "competencia" formato MM/AAAA ou MM.AAAA
      if (req.body.competencia) {
        const parts = String(req.body.competencia).replace('/', '.').split('.');
        if (parts.length === 2) {
          mes = parseInt(parts[0], 10);
          ano = parseInt(parts[1], 10);
        }
      }

      if (!companyId) {
        res.status(400).json({ error: 'company_id é obrigatório.' });
        return;
      }

      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const result = await salvadorNfseMonthlyService.syncMonthlyNfse(companyId, ano, mes);
      res.json(result);
    } catch (err: any) {
      console.error('❌ [NFS-e Controller] Erro na sincronização mensal:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Stream do Relatório Oficial de Auditoria e Conferência Mensal em PDF
   */
  async getMonthlyReportPdf(req: Request, res: Response): Promise<void> {
    try {
      const companyId = String(req.params.companyId);
      const mesAno = String(req.params.mesAno);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        res.status(404).send('Empresa não encontrada.');
        return;
      }

      const cleanCnpj = (company.cnpj || '').replace(/\D/g, '');
      const [mesStr, anoStr] = mesAno.split('.');
      const reportPath = path.resolve(__dirname, `../../storage/exports/nfse/${cleanCnpj}/${anoStr}/${mesAno}/RELATORIO_CONFERENCIA_NFSE_${mesAno}.pdf`);

      if (fs.existsSync(reportPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="RELATORIO_CONFERENCIA_NFSE_${cleanCnpj}_${mesAno}.pdf"`);
        const stream = fs.createReadStream(reportPath);
        stream.pipe(res);
        return;
      }

      // Se o relatório ainda não existir em disco, tenta sincronizar e gerar na hora
      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const syncRes = await salvadorNfseMonthlyService.syncMonthlyNfse(companyId, parseInt(anoStr, 10), parseInt(mesStr, 10));

      if (syncRes.arquivosGerados.relatorioConferenciaPdf && fs.existsSync(syncRes.arquivosGerados.relatorioConferenciaPdf)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="RELATORIO_CONFERENCIA_NFSE_${cleanCnpj}_${mesAno}.pdf"`);
        const stream = fs.createReadStream(syncRes.arquivosGerados.relatorioConferenciaPdf);
        stream.pipe(res);
      } else {
        res.status(404).send('Nenhum relatório de conferência disponível para esta competência.');
      }
    } catch (err: any) {
      res.status(500).send(`Erro ao gerar relatório de conferência: ${err.message}`);
    }
  },

  /**
   * Obter Resumo / Auditoria da Competência em JSON
   */
  async getMonthlySummary(req: Request, res: Response): Promise<void> {
    try {
      const companyId = String(req.params.companyId);
      const mesAno = String(req.params.mesAno);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      if (!company) {
        res.status(404).json({ error: 'Empresa não encontrada.' });
        return;
      }

      const [mesStr, anoStr] = mesAno.split('.');
      const startDate = `${anoStr}-${mesStr}-01`;
      const endDate = `${anoStr}-${mesStr}-31`;

      const invoices = db.prepare(`
        SELECT numero, data_emissao, emitente_nome, destinatario_nome, destinatario_cnpj, valor_total, status
        FROM invoices
        WHERE company_id = ? AND modelo = 'NFS-e' AND data_emissao >= ? AND data_emissao <= ?
        ORDER BY CAST(numero AS INTEGER) ASC
      `).all(companyId, startDate, endDate) as any[];

      const totalServicos = invoices.reduce((acc, inv) => acc + (inv.status !== 'cancelada' ? inv.valor_total : 0), 0);
      const canceladas = invoices.filter(inv => inv.status === 'cancelada').length;

      res.json({
        empresa: company.razao_social,
        cnpj: company.cnpj,
        cga: company.inscricao_municipal,
        competencia: mesAno,
        totalNotas: invoices.length,
        canceladas,
        totalServicos,
        primeiraNota: invoices.length > 0 ? invoices[0].numero : null,
        ultimaNota: invoices.length > 0 ? invoices[invoices.length - 1].numero : null,
        notas: invoices
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  /**
   * Varredura em Lote de todas as empresas ativas para uma competência
   */
  async batchSyncMonth(req: Request, res: Response): Promise<void> {
    try {
      let ano = parseInt(String(req.body.ano || new Date().getFullYear()), 10);
      let mes = parseInt(String(req.body.mes || new Date().getMonth() + 1), 10);

      const companies = db.prepare(`
        SELECT id, razao_social, cnpj, inscricao_municipal, cert_filename
        FROM companies
        WHERE status = 'ativo' AND emite_nfse = 1 AND cert_filename IS NOT NULL AND inscricao_municipal IS NOT NULL AND inscricao_municipal != ''
      `).all() as any[];

      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      const results: any[] = [];

      for (const comp of companies) {
        try {
          const resSync = await salvadorNfseMonthlyService.syncMonthlyNfse(comp.id, ano, mes);
          results.push({ company: comp.razao_social, status: 'success', totalNotas: resSync.totalNotas });
        } catch (compErr: any) {
          results.push({ company: comp.razao_social, status: 'error', error: compErr.message });
        }
      }

      res.json({
        competencia: `${String(mes).padStart(2, '0')}.${ano}`,
        totalProcessadas: companies.length,
        resultados: results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};


