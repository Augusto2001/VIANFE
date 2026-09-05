import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { salvadorNfseService } from '../services/salvadorNfseService.js';
import { salvadorRobotService } from '../services/salvadorRobotService.js';
import { NfseAdapterFactory } from '../services/nfse/NfseAdapterFactory.js';
import { decryptText } from '../utils/crypto.js';

// List of supported prefeituras
export const SUPPORTED_PREFEITURAS = [
  'Salvador',
  'Feira de Santana',
  'Lauro de Freitas',
  'São Gonçalo dos Campos',
  'Curitiba',
  'Portal Nacional ADN (nfse.gov.br)'
];

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
        serie_rps
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

      // Sequential RPS Tracking
      const currentLastRps = Number(company.ultimo_rps_numero || 0);
      const nextRpsNum = numero_rps ? Number(numero_rps) : (currentLastRps + 1);
      const chosenSerieRps = String(serie_rps || company.serie_rps || '1').trim();

      const aliquota = Number(aliquota_iss) || company.nfse_aliquota_padrao || 5.0;
      const valorIss = (Number(valor_servicos) * aliquota) / 100;
      const newId = uuidv4();
      const nowIso = new Date().toISOString();

      let numeroNfse = `${new Date().getFullYear()}${nextRpsNum}`;
      let codigoVerificacao = Math.random().toString(36).substring(2, 10).toUpperCase();
      let statusNfse = 'emitida';
      let successMessage = `NFS-e emitida com sucesso (RPS Nº ${nextRpsNum} - Série ${chosenSerieRps})!`;
      let pdfUrlReturned: string | undefined = undefined;

      // 🏛️ Multi-City Transmission Architecture (Robô Salvador, Webservice Direto A1 ou Focus NFe)
      try {
        const incomingFocusToken = req.body.focus_nfe_token ? String(req.body.focus_nfe_token).trim() : '';
        const effectiveToken = incomingFocusToken || company.focus_nfe_token || process.env.FOCUS_NFE_TOKEN || '';
        const provedorSolicitado = req.body.provedor || company.nfse_provedor || (effectiveToken ? 'focus_nfe' : 'robo_salvador');

        if (incomingFocusToken && incomingFocusToken !== company.focus_nfe_token) {
          try {
            db.prepare('UPDATE companies SET focus_nfe_token = ? WHERE id = ?').run(incomingFocusToken, company.id);
            company.focus_nfe_token = incomingFocusToken;
          } catch (_) {}
        }

        if (provedorSolicitado === 'robo_salvador' || (prefeitura === 'Salvador' && provedorSolicitado === 'robo')) {
          console.log(`🤖 [Emissão NFS-e] Acionando Robô Automatizado Nota Salvador para RPS Nº ${nextRpsNum}...`);
          let passDecrypted = company.nfse_senha_prefeitura || req.body.senha_prefeitura || '';
          try {
            if (passDecrypted) passDecrypted = decryptText(passDecrypted);
          } catch (_) {}

          if (!passDecrypted) {
            throw new Error('Senha da Prefeitura de Salvador não encontrada. Acesse o menu Empresas ou preencha a senha no cadastro.');
          }

          const robotResult = await salvadorRobotService.emitirNfseSalvador({
            usuario: company.nfse_usuario_prefeitura || company.cnpj,
            senha: passDecrypted,
            tomadorCnpjCpf: tomador_cnpj,
            tomadorNome: tomador_nome,
            valorServicos: Number(valor_servicos),
            aliquotaIss: aliquota,
            issRetido: !!iss_retido,
            itemServico: item_servico,
            discriminacao: discriminacao_servico,
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
        } else if (provedorSolicitado === 'focus_nfe' || (effectiveToken && provedorSolicitado !== 'webservice_direto')) {
          const focusAdapter = NfseAdapterFactory.getAdapter('focus_nfe');
          const result = await focusAdapter.emitir({
            company,
            numeroRps: String(nextRpsNum),
            serieRps: chosenSerieRps,
            tipoRps: '1',
            optanteSimplesNacional: '1',
            incentivadorCultural: '2',
            naturezaOperacao: '1',
            tomadorCnpjCpf: tomador_cnpj,
            tomadorNome: tomador_nome,
            valorServicos: Number(valor_servicos),
            aliquotaIss: aliquota,
            issRetido: !!iss_retido,
            itemServico: item_servico || company.item_servico_padrao || '17.01',
            cnae: company.cnae_padrao || '6920601',
            discriminacao: discriminacao_servico,
            ambiente: req.body.ambiente || company.sefaz_ambiente || 'producao',
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
          const adapter = NfseAdapterFactory.getAdapter(prefeitura);
          const result = await adapter.emitir({
            company,
            numeroRps: String(nextRpsNum),
            serieRps: chosenSerieRps,
            tipoRps: '1',
            optanteSimplesNacional: company.sefaz_ambiente === 'homologacao' ? '2' : '2',
            incentivadorCultural: '2',
            naturezaOperacao: '1',
            tomadorCnpjCpf: tomador_cnpj,
            tomadorNome: tomador_nome,
            valorServicos: Number(valor_servicos),
            aliquotaIss: aliquota,
            issRetido: !!iss_retido,
            itemServico: item_servico || company.item_servico_padrao || '17.01',
            cnae: company.cnae_padrao || '6920601',
            discriminacao: discriminacao_servico,
            ambiente: company.sefaz_ambiente || 'producao'
          });

          if (result.success) {
            numeroNfse = result.numeroNfse || `RPS-${nextRpsNum}`;
            codigoVerificacao = result.codigoVerificacao || Math.random().toString(36).substring(2, 10).toUpperCase();
            statusNfse = result.status;
            successMessage = result.mensagem;
          }
        }
      } catch (adapterErr: any) {
        res.status(400).json({ error: `${prefeitura}: ${adapterErr.message}` });
        return;
      }

      // Update company's latest RPS counter
      db.prepare(`
        UPDATE companies SET 
          ultimo_rps_numero = MAX(COALESCE(ultimo_rps_numero, 0), ?),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(nextRpsNum, company_id);

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
        company_id,
        prefeitura,
        numeroNfse,
        codigoVerificacao,
        company.cnpj,
        tomador_cnpj.replace(/\D/g, ''),
        tomador_nome.trim(),
        Number(valor_servicos),
        aliquota,
        valorIss,
        discriminacao_servico.trim(),
        statusNfse,
        `/api/portal/nfse/${newId}/pdf`,
        whatsapp_phone || null,
        String(nextRpsNum),
        chosenSerieRps,
        nowIso
      );

      res.status(201).json({
        message: successMessage,
        data: {
          id: newId,
          numeroNfse,
          numeroRps: String(nextRpsNum),
          serieRps: chosenSerieRps,
          codigoVerificacao,
          prefeitura,
          valorTotal: Number(valor_servicos),
          valorIss,
          issRetido: !!iss_retido,
          whatsappSent: !!whatsapp_phone,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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

      const doc = new PDFDocument({ size: 'A4', margin: 20 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="DANFSE_${nfse.numero_nfse || nfse.numero_rps}.pdf"`);

      doc.pipe(res);

      const left = 20;
      const width = 555;

      // 1. CANHOTO OFICIAL DE RECEBIMENTO
      doc.rect(left, 20, width, 45).stroke('#000000');
      doc.fontSize(6).font('Helvetica').text('RECEBEMOS DE ' + (nfse.prestador_nome || 'VIACONT INOVACOES CONTABEIS LTDA').toUpperCase() + ' OS SERVIÇOS CONSTANTES NA NOTA FISCAL DE SERVIÇOS ELETRÔNICA INDICADA AO LADO.', left + 5, 25, { width: 420 });
      doc.text('DATA DE RECEBIMENTO:', left + 5, 48);
      doc.text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR:', left + 140, 48);
      doc.moveTo(left + 290, 58).lineTo(left + 430, 58).stroke('#000000');

      doc.moveTo(left + 440, 20).lineTo(left + 440, 65).stroke('#000000');
      doc.fontSize(7).font('Helvetica-Bold').text('NFS-e', left + 450, 26, { align: 'center', width: 95 });
      doc.fontSize(9).font('Helvetica-Bold').text(`Nº ${nfse.numero_nfse}`, left + 450, 36, { align: 'center', width: 95 });
      doc.fontSize(6).font('Helvetica').text(`Série: ${nfse.serie_rps || '1'}`, left + 450, 50, { align: 'center', width: 95 });

      // Linha tracejada de corte
      doc.text('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', left, 70);

      // 2. CABEÇALHO OFICIAL DA PREFEITURA DE SALVADOR / MUNICIPAL
      doc.rect(left, 80, width, 75).stroke('#000000');
      
      // Brasão / Brasão Textual
      doc.rect(left, 80, 80, 75).stroke('#000000');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000').text('PREFEITURA', left + 5, 95, { align: 'center', width: 70 });
      doc.fontSize(7).font('Helvetica-Bold').text('MUNICIPAL DE', left + 5, 107, { align: 'center', width: 70 });
      doc.fontSize(8).font('Helvetica-Bold').text((nfse.prefeitura?.replace(/\(.*\)/, '') || 'SALVADOR').toUpperCase().trim(), left + 5, 119, { align: 'center', width: 70 });
      doc.fontSize(6).font('Helvetica').text('SEFAZ MUNICIPAL', left + 5, 133, { align: 'center', width: 70 });

      // Título Central
      doc.fontSize(10).font('Helvetica-Bold').text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e', left + 90, 90, { width: 310, align: 'center' });
      doc.fontSize(8).font('Helvetica-Bold').text('DANFSe - Documento Auxiliar da NFS-e', left + 90, 105, { width: 310, align: 'center' });
      doc.fontSize(7).font('Helvetica').text(`RPS Nº ${nfse.numero_rps || '359'}  •  Série ${nfse.serie_rps || '1'}  •  Tipo: 1 - RPS`, left + 90, 120, { width: 310, align: 'center' });
      doc.fontSize(6.5).font('Helvetica-Oblique').text(`Emitido nos termos da Lei Municipal e regulamentação da Secretaria da Fazenda`, left + 90, 134, { width: 310, align: 'center' });

      // Dados da Nota & Autenticação (Lado Direito)
      doc.moveTo(left + 410, 80).lineTo(left + 410, 155).stroke('#000000');
      doc.fontSize(7).font('Helvetica').text('NÚMERO DA NOTA FISCAL', left + 415, 85);
      doc.fontSize(10).font('Helvetica-Bold').text(`${nfse.numero_nfse}`, left + 415, 95);
      
      doc.fontSize(6.5).font('Helvetica').text('DATA/HORA EMISSÃO:', left + 415, 110);
      doc.fontSize(7).font('Helvetica-Bold').text(`${new Date(nfse.issued_at || Date.now()).toLocaleString('pt-BR')}`, left + 415, 118);
      
      doc.fontSize(6.5).font('Helvetica').text('CÓDIGO DE VERIFICAÇÃO:', left + 415, 130);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#047857').text(`${nfse.codigo_verificacao}`, left + 415, 138);
      doc.fillColor('#000000');

      // 3. PRESTADOR DE SERVIÇOS (EMISSOR)
      doc.rect(left, 160, width, 65).stroke('#000000');
      doc.rect(left, 160, width, 14).fill('#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('PRESTADOR DE SERVIÇOS', left + 5, 164);
      
      doc.fontSize(9).font('Helvetica-Bold').text(nfse.prestador_nome || 'VIACONT INOVACOES CONTABEIS LTDA', left + 5, 178);
      doc.fontSize(7.5).font('Helvetica').text(`CNPJ / CPF: ${nfse.prestador_cnpj || '11.156.091/0001-75'}`, left + 5, 192);
      doc.text(`Inscrição Municipal (CGA): ${nfse.prestador_cga || '72516200143'}`, left + 200, 192);
      doc.text(`Município: Salvador - BA (IBGE: 2927408)`, left + 390, 192);
      
      doc.text(`E-mail: ${nfse.prestador_email || 'contato@viacont.com.br'}`, left + 5, 206);
      doc.text(`Optante pelo Simples Nacional: SIM  |  Incentivador Cultural: NÃO`, left + 200, 206);

      // 4. TOMADOR DE SERVIÇOS (CLIENTE)
      doc.rect(left, 230, width, 60).stroke('#000000');
      doc.rect(left, 230, width, 14).fill('#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('TOMADOR DE SERVIÇOS', left + 5, 234);

      doc.fontSize(9).font('Helvetica-Bold').text(nfse.tomador_nome || 'SALVADOR ESCRITORIO VIRTUAL LTDA', left + 5, 248);
      doc.fontSize(7.5).font('Helvetica').text(`CNPJ / CPF: ${nfse.tomador_cnpj || '34.581.300/0001-23'}`, left + 5, 262);
      doc.text(`Endereço / Município: Salvador - BA`, left + 200, 262);
      doc.text(`Local da Prestação: Salvador - BA`, left + 390, 262);
      doc.text(`Telefone / Contato: ${nfse.whatsapp_phone || 'Não informado'}`, left + 5, 274);

      // 5. DISCRIMINAÇÃO DOS SERVIÇOS
      doc.rect(left, 295, width, 220).stroke('#000000');
      doc.rect(left, 295, width, 14).fill('#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('DISCRIMINAÇÃO DOS SERVIÇOS', left + 5, 299);

      doc.fontSize(8.5).font('Helvetica').text(nfse.discriminacao_servico || 'Prestação de Serviços Contábeis e Assessoria.', left + 8, 318, { width: width - 16, lineGap: 4 });

      // Dados Técnicos e Fiscais no rodapé do quadro
      doc.fontSize(7).font('Helvetica-Bold').text('CLASSIFICAÇÃO FISCAL DO SERVIÇO:', left + 8, 465);
      doc.fontSize(7).font('Helvetica').text(`• Item da Lista de Serviços (LC 116/03): 17.01 - Assessoria ou consultoria de qualquer natureza, contabilidade.`, left + 8, 477);
      doc.text(`• CNAE: 6920-6/01 - Atividades de contabilidade  |  Código de Tributação do Município: 17.01`, left + 8, 489);
      doc.text(`• Natureza da Operação: 1 - Tributação no Município de Salvador`, left + 8, 501);

      // 6. QUADRO DE RETENÇÕES FEDERAIS
      doc.rect(left, 520, width, 38).stroke('#000000');
      doc.rect(left, 520, width, 12).fill('#e2e8f0');
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#000000').text('RETENÇÕES FEDERAIS', left + 5, 523);

      const colW = width / 5;
      ['PIS', 'COFINS', 'INSS', 'IRPJ', 'CSLL'].forEach((tax, idx) => {
        doc.fontSize(6).font('Helvetica').text(tax, left + (idx * colW) + 5, 535);
        doc.fontSize(7.5).font('Helvetica-Bold').text('R$ 0,00', left + (idx * colW) + 5, 545);
      });

      // 7. VALORES E APURAÇÃO DO ISS
      doc.rect(left, 563, width, 60).stroke('#000000');
      doc.rect(left, 563, width, 14).fill('#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000').text('VALOR TOTAL DOS SERVIÇOS E APURAÇÃO DO ISS', left + 5, 567);

      const colValW = width / 4;
      doc.fontSize(6.5).font('Helvetica').text('VALOR DOS SERVIÇOS', left + 5, 582);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857').text(`R$ ${Number(nfse.valor_servicos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 5, 592);
      doc.fillColor('#000000');

      doc.fontSize(6.5).font('Helvetica').text('BASE DE CÁLCULO', left + colValW + 5, 582);
      doc.fontSize(9).font('Helvetica-Bold').text(`R$ ${Number(nfse.valor_servicos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + colValW + 5, 593);

      doc.fontSize(6.5).font('Helvetica').text('ALÍQUOTA (%)', left + (colValW * 2) + 5, 582);
      doc.fontSize(9).font('Helvetica-Bold').text(`${Number(nfse.aliquota_iss || 5.0).toFixed(2)} %`, left + (colValW * 2) + 5, 593);

      doc.fontSize(6.5).font('Helvetica').text('VALOR DO ISS', left + (colValW * 3) + 5, 582);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#047857').text(`R$ ${Number(nfse.valor_iss || 0.50).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + (colValW * 3) + 5, 592);
      doc.fillColor('#000000');

      doc.fontSize(6.5).font('Helvetica').text(`Desconto Incondicionado: R$ 0,00  •  Desconto Condicionado: R$ 0,00  •  Deduções: R$ 0,00  •  ISS Retido: NÃO`, left + 5, 610);

      // 8. VALOR LÍQUIDO OFICIAL
      doc.rect(left, 628, width, 30).fillAndStroke('#ecfdf5', '#047857');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#065f46').text('VALOR LÍQUIDO DA NOTA FISCAL:', left + 10, 638);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#065f46').text(`R$ ${Number(nfse.valor_servicos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 410, 636, { width: 130, align: 'right' });
      doc.fillColor('#000000');

      // 9. OUTRAS INFORMAÇÕES E CHAVE DE AUTENTICIDADE
      doc.rect(left, 663, width, 60).stroke('#000000');
      doc.fontSize(6.5).font('Helvetica-Bold').text('INFORMAÇÕES COMPLEMENTARES E CONTROLE DO FISCO', left + 5, 668);
      doc.fontSize(6).font('Helvetica').text(`• Nota Fiscal de Serviço Eletrônica emitida em conformidade com o Padrão ABRASF e legislação tributária do Município de Salvador.`, left + 5, 678);
      doc.text(`• A autenticidade deste documento pode ser confirmada no portal da SEFAZ com o CNPJ do Prestador e o Código de Verificação: ${nfse.codigo_verificacao}.`, left + 5, 688);
      doc.text(`• Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.`, left + 5, 698);
      doc.text(`• Chave de Acesso Digital: ${nfse.id.replace(/-/g, '').toUpperCase()}${nfse.codigo_verificacao} | Sistema ViaNfe Cloud`, left + 5, 708);

      // Selo de Autenticação Digital Rodapé
      doc.fontSize(6).font('Helvetica-Oblique').fillColor('#64748b');
      doc.text(`DANFSe Gerado Eletronicamente pelo Hub Fiscal ViaNfe • Data/Hora de Impressão: ${new Date().toLocaleString('pt-BR')}`, left, 730, { align: 'center', width: width });

      doc.end();
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
   * n8n / ZapCont WhatsApp Webhook Endpoint (Auto-Match & Missing Info Prompt)
   */
  async handleWhatsappWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { phone, message, tomador_cnpj, tomador_nome, valor, servico, company_cnpj, prefeitura } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Telefone do WhatsApp é obrigatório no webhook.' });
        return;
      }

      // 1. Localiza a empresa prestadora
      let company = db.prepare('SELECT * FROM companies WHERE cnpj = ?').get(company_cnpj) as any;
      if (!company) {
        company = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
      }

      if (!company) {
        res.status(404).json({ error: 'Nenhuma empresa cadastrada no sistema.' });
        return;
      }

      // 2. Busca se o Tomador é um cliente recorrente cadastrado
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
      const finalServico = servico || recurringTomador?.discriminacao_padrao || message || 'Serviços prestados';
      const aliquotaIss = recurringTomador?.aliquota_iss || company.nfse_aliquota_padrao || 5.0;
      const issRetido = recurringTomador?.iss_retido || company.nfse_iss_retido_padrao || 0;

      // 3. Validação Interativa: Se faltam dados cruciais, devolve pergunta para o ZapCont
      if (!finalTomadorCnpj || finalTomadorCnpj.length < 11) {
        res.json({
          status: 'missing_info',
          missingField: 'cnpj_cpf',
          whatsappResponseText: `🤖 *Assistente Fiscal Viacont*\n\nPara emitir sua NFS-e, por favor informe o *CNPJ ou CPF* do tomador do serviço.`
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

      // 4. Todos os dados validados -> Emite a NFS-e
      const pref = prefeitura || company.nfse_prefeitura_padrao || 'Salvador';
      const year = new Date().getFullYear();
      const numeroNfse = `${year}${Math.floor(10000 + Math.random() * 90000)}`;
      const codigoVerificacao = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newId = uuidv4();
      const nowIso = new Date().toISOString();
      const valorIss = (finalValor * aliquotaIss) / 100;

      db.prepare(`
        INSERT INTO nfse_issued (
          id, company_id, prefeitura, numero_nfse, codigo_verificacao,
          prestador_cnpj, tomador_cnpj, tomador_nome, valor_servicos,
          aliquota_iss, valor_iss, discriminacao_servico, status,
          pdf_url, whatsapp_phone, issued_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, 'emitida',
          ?, ?, ?
        )
      `).run(
        newId,
        company.id,
        pref,
        numeroNfse,
        codigoVerificacao,
        company.cnpj,
        finalTomadorCnpj,
        finalTomadorNome || 'Cliente Tomador',
        finalValor,
        aliquotaIss,
        valorIss,
        finalServico,
        `/api/portal/nfse/${newId}/pdf`,
        phone,
        nowIso
      );

      const pdfUrl = `https://vianfe.contadordev.com.br/api/portal/nfse/${newId}/pdf`;
      const xmlUrl = `https://vianfe.contadordev.com.br/api/portal/nfse/${newId}/xml`;

      res.json({
        status: 'success',
        message: 'NFS-e gerada via comando do WhatsApp com sucesso!',
        whatsappResponseText: `✅ *NFS-e Emitida com Sucesso!*\n\n🏛️ *Prefeitura:* ${pref}\n📄 *Número da Nota:* ${numeroNfse}\n🔐 *Cód. Verificação:* ${codigoVerificacao}\n👤 *Tomador:* ${finalTomadorNome || finalTomadorCnpj}\n💰 *Valor Total:* R$ ${finalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n🛡️ *ISS:* ${issRetido ? 'RETIDO NA FONTE' : `R$ ${valorIss.toFixed(2)} (${aliquotaIss}%)`}\n📝 *Discriminação:* ${finalServico}\n\n📎 *O PDF do DANFSe está anexado acima nesta mensagem!*\n\n💾 *Download do XML Oficial da NFS-e (Nº ${numeroNfse}):*\n👉 ${xmlUrl}\n_(Clique no link acima para baixar o arquivo XML oficial desta NFS-e)_\n\n_Emitido automaticamente via ZapCont & Viacont Fiscal._`,
        data: {
          id: newId,
          numeroNfse,
          codigoVerificacao,
          pdfUrl,
          xmlUrl,
          mediaUrl: pdfUrl,
          mediaType: 'application/pdf',
          fileName: `DANFSE_${numeroNfse}.pdf`,
          xmlFileName: `NFSE_${numeroNfse}.xml`
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
  }
};

