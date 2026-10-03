import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const BRASAO_SALVADOR_BASE64 = "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";

export interface DanfsePdfItem {
  numero: string | number;
  codigoVerificacao?: string;
  dataEmissao: string;
  prestadorNome: string;
  prestadorCnpj: string;
  prestadorCga?: string;
  prestadorEndereco?: string;
  prestadorEmail?: string;
  prestadorMunicipio?: string;
  prestadorUf?: string;
  tomadorNome: string;
  tomadorDoc?: string;
  tomadorCga?: string;
  tomadorEndereco?: string;
  tomadorEmail?: string;
  tomadorMunicipio?: string;
  tomadorUf?: string;
  valorServicos: number;
  aliquota: number;
  valorIss: number;
  issRetido?: boolean;
  discriminacao: string;
  itemServico?: string;
  cnae?: string;
  competencia?: string;
  dataVencimento?: string;
  isCancelada?: boolean;
}

export interface MonthlyConferenceData {
  empresa: string;
  cnpj: string;
  cga: string;
  mesAno: string;
  totalNotas: number;
  primeiraNota: number | string;
  ultimaNota: number | string;
  totalServicos: number;
  totalIss: number;
  canceladas: number;
  gaps?: number[];
  notas: Array<{
    numero: number | string;
    numPad8?: string;
    dataEmissao: string;
    tomadorNome: string;
    tomadorDoc?: string;
    valorServicos: number;
    valorIss: number;
    isCancelada?: boolean;
  }>;
}

function formatCurrency(val: any): string {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCpfCnpj(doc: any): string {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc || '';
}

function formatCga(cga: any): string {
  const c = String(cga || '').replace(/\D/g, '');
  if (c.length === 11) {
    return `${c.substring(0, 3)}.${c.substring(3, 6)}/${c.substring(6, 9)}-${c.substring(9, 11)}`;
  }
  return cga || '----';
}

export const nfsePdfGenerator = {
  /**
   * Gera o Documento Oficial da Nota Salvador (Prefeitura Municipal do Salvador) em PDF
   */
  async generateDanfsePdf(data: DanfsePdfItem, outputPath?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 15, bottom: 15, left: 18, right: 18 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => {
        const resultBuffer = Buffer.concat(buffers);
        if (outputPath) {
          try {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(outputPath, resultBuffer);
          } catch (writeErr) {
            return reject(writeErr);
          }
        }
        resolve(resultBuffer);
      });
      doc.on('error', reject);

      const left = 18;
      const right = 577;
      const width = right - left; // 559 pt
      const numPad8 = String(data.numero || '0').padStart(8, '0');

      doc.lineWidth(1).strokeColor('#000000');

      // ==========================================
      // 1. CABEÇALHO (Header) - Y: 18 a 92 (h: 74)
      // ==========================================
      const hY = 18;
      const hHeight = 74;
      doc.rect(left, hY, width, hHeight).stroke();

      // Brasão oficial de Salvador
      try {
        const brasaoBuffer = Buffer.from(BRASAO_SALVADOR_BASE64, 'base64');
        doc.image(brasaoBuffer, left + 10, hY + 7, { width: 60, height: 60 });
      } catch (_) {}

      // Texto Central do Cabeçalho
      const headerTextX = left + 75;
      const headerTextW = width - 75 - 145;

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
        .text('PREFEITURA MUNICIPAL DO SALVADOR', headerTextX, hY + 12, { width: headerTextW, align: 'center' });
      
      doc.font('Helvetica-Bold').fontSize(8.5)
        .text('SECRETARIA MUNICIPAL DA FAZENDA', headerTextX, hY + 28, { width: headerTextW, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(9.5)
        .text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA - Nota Salvador', headerTextX, hY + 48, { width: headerTextW, align: 'center' });

      // Linha vertical separadora da caixa da direita
      const boxRightX = right - 140;
      doc.moveTo(boxRightX, hY).lineTo(boxRightX, hY + hHeight).stroke();

      // Dados da Nota (Caixa Direita)
      const bPadX = boxRightX + 6;
      doc.font('Helvetica').fontSize(7).text('Número da Nota:', bPadX, hY + 6);
      doc.font('Helvetica-Bold').fontSize(9).text(numPad8, bPadX, hY + 15);

      doc.font('Helvetica').fontSize(7).text('Data e Hora de Emissão:', bPadX, hY + 28);
      let dtStr = data.dataEmissao || new Date().toLocaleString('pt-BR');
      if (dtStr.includes('T')) {
        const dObj = new Date(dtStr);
        dtStr = dObj.toLocaleString('pt-BR');
      }
      doc.font('Helvetica-Bold').fontSize(8).text(dtStr, bPadX, hY + 37);

      doc.font('Helvetica').fontSize(7).text('Código de Verificação:', bPadX, hY + 50);
      let codVerif = String(data.codigoVerificacao || 'N/A').toUpperCase();
      if (codVerif.length === 8 && !codVerif.includes('-')) {
        codVerif = `${codVerif.substring(0, 4)}-${codVerif.substring(4, 8)}`;
      }
      doc.font('Helvetica-Bold').fontSize(9).text(codVerif, bPadX, hY + 59);

      // ==========================================
      // 2. PRESTADOR DE SERVIÇOS - Y: 96 a 178 (h: 82)
      // ==========================================
      const pY = 96;
      const pHeight = 82;
      doc.rect(left, pY, width, pHeight).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
        .text('PRESTADOR DE SERVIÇOS', left + 6, pY + 6);

      doc.font('Helvetica').fontSize(7).fillColor('#000000');
      doc.text('CPF/CNPJ:', left + 6, pY + 18);
      doc.font('Helvetica-Bold').text(formatCpfCnpj(data.prestadorCnpj), left + 6, pY + 27);

      doc.font('Helvetica').text('Inscrição Municipal:', left + 200, pY + 18);
      doc.font('Helvetica-Bold').text(formatCga(data.prestadorCga), left + 200, pY + 27);

      doc.font('Helvetica').text('Nome/Razão Social:', left + 6, pY + 38);
      doc.font('Helvetica-Bold').text((data.prestadorNome || 'PRESTADOR').toUpperCase(), left + 6, pY + 47);

      doc.font('Helvetica').text('Endereço:', left + 6, pY + 57);
      const enderPrestador = data.prestadorEndereco || `${data.prestadorMunicipio || 'Salvador'} - ${data.prestadorUf || 'BA'}`;
      doc.font('Helvetica').text(enderPrestador, left + 6, pY + 65, { width: width - 12 });

      if (data.prestadorEmail) {
        doc.text(`E-mail: ${data.prestadorEmail}`, left + 6, pY + 74);
      }

      // ==========================================
      // 3. TOMADOR DE SERVIÇOS / ADQUIRENTE - Y: 182 a 258 (h: 76)
      // ==========================================
      const tY = 182;
      const tHeight = 76;
      doc.rect(left, tY, width, tHeight).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
        .text('TOMADOR DE SERVIÇOS / ADQUIRENTE', left + 6, tY + 6);

      doc.font('Helvetica').fontSize(7).fillColor('#000000');
      doc.text('Nome/Razão Social:', left + 6, tY + 18);
      doc.font('Helvetica-Bold').text((data.tomadorNome || 'TOMADOR NÃO INFORMADO').toUpperCase(), left + 6, tY + 27);

      doc.font('Helvetica').text('CPF/CNPJ:', left + 6, tY + 38);
      doc.font('Helvetica-Bold').text(formatCpfCnpj(data.tomadorDoc), left + 6, tY + 47);

      doc.font('Helvetica').text('Inscrição Municipal:', left + 280, tY + 38);
      doc.font('Helvetica-Bold').text(data.tomadorCga || '----', left + 280, tY + 47);

      doc.font('Helvetica').text('Endereço:', left + 6, tY + 57);
      const enderTomador = data.tomadorEndereco || `${data.tomadorMunicipio || 'Salvador'} - ${data.tomadorUf || 'BA'}`;
      doc.font('Helvetica').text(enderTomador, left + 6, tY + 65, { width: width - 12 });

      // ==========================================
      // 4. DISCRIMINAÇÃO DOS SERVIÇOS - Y: 262 a 460 (h: 198)
      // ==========================================
      const dY = 262;
      const dHeight = 198;
      doc.rect(left, dY, width, dHeight).stroke();

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
        .text('DISCRIMINAÇÃO DOS SERVIÇOS', left + 6, dY + 6);

      const desc = data.discriminacao || 'PRESTAÇÃO DE SERVIÇOS';
      doc.font('Helvetica').fontSize(8).fillColor('#000000')
        .text(desc, left + 6, dY + 20, { width: width - 12, lineGap: 3 });

      // ==========================================
      // 5. VALOR TOTAL DA NOTA - Y: 464 a 486 (h: 22)
      // ==========================================
      const vY = 464;
      const vHeight = 22;
      doc.rect(left, vY, width, vHeight).stroke();

      const valTotalStr = `VALOR TOTAL DA NOTA = R$${formatCurrency(data.valorServicos)}`;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
        .text(valTotalStr, left, vY + 6, { width: width, align: 'center' });

      // ==========================================
      // 6. CLASSIFICAÇÃO FISCAL E TRIBUTOS - Y: 490 a 594 (h: 104)
      // ==========================================
      const clY = 490;
      const clHeight = 104;
      doc.rect(left, clY, width, clHeight).stroke();

      // CNAE e Item Serviço
      doc.font('Helvetica').fontSize(6.5).fillColor('#000000');
      doc.text('CNAE:', left + 6, clY + 5);
      doc.font('Helvetica-Bold').text(data.cnae || '---', left + 6, clY + 13);

      doc.font('Helvetica').text('Item da Lista de Serviços:', left + 6, clY + 23);
      const itemServ = data.itemServico || '17.01 - Assessoria ou consultoria de qualquer natureza.';
      doc.font('Helvetica-Bold').text(itemServ, left + 6, clY + 31);

      // Linha horizontal 1 (Tabela ISS)
      const t1Y = clY + 41;
      doc.moveTo(left, t1Y).lineTo(right, t1Y).stroke();

      const col1W = [118, 140, 95, 95, 111];
      let curX = left;
      const col1X = [curX];
      for (let i = 0; i < col1W.length - 1; i++) {
        curX += col1W[i];
        col1X.push(curX);
        doc.moveTo(curX, t1Y).lineTo(curX, t1Y + 23).stroke();
      }

      doc.font('Helvetica').fontSize(6);
      doc.text('Valor Total das Deduções (R$):', col1X[0] + 3, t1Y + 3);
      doc.text('Base de Cálculo (R$):', col1X[1] + 3, t1Y + 3);
      doc.text('Alíquota (%):', col1X[2] + 3, t1Y + 3);
      doc.text('Valor do ISS (R$):', col1X[3] + 3, t1Y + 3);
      doc.text('Crédito Nota Salvador (R$):', col1X[4] + 3, t1Y + 3);

      const valBc = formatCurrency(data.valorServicos);
      const aliq = `${Number(data.aliquota || 5.0).toFixed(2)}%`;
      const valIss = formatCurrency(data.valorIss);

      doc.font('Helvetica-Bold').fontSize(7.5);
      doc.text('0,00', col1X[0], t1Y + 12, { width: col1W[0] - 5, align: 'right' });
      doc.text(valBc, col1X[1], t1Y + 12, { width: col1W[1] - 5, align: 'right' });
      doc.text(aliq, col1X[2], t1Y + 12, { width: col1W[2] - 5, align: 'right' });
      doc.text(valIss, col1X[3], t1Y + 12, { width: col1W[3] - 5, align: 'right' });
      doc.text('0,00', col1X[4], t1Y + 12, { width: col1W[4] - 5, align: 'right' });

      // Linha horizontal 2 (Retenções)
      const t2Y = t1Y + 23;
      doc.moveTo(left, t2Y).lineTo(right, t2Y).stroke();

      const col2W = [68, 70, 75, 68, 92, 98, 88];
      curX = left;
      const col2X = [curX];
      for (let i = 0; i < col2W.length - 1; i++) {
        curX += col2W[i];
        col2X.push(curX);
        doc.moveTo(curX, t2Y).lineTo(curX, t2Y + 20).stroke();
      }

      doc.font('Helvetica').fontSize(5.5);
      doc.text('Valor INSS (R$):', col2X[0] + 2, t2Y + 2);
      doc.text('Valor PIS (R$):', col2X[1] + 2, t2Y + 2);
      doc.text('Valor COFINS (R$):', col2X[2] + 2, t2Y + 2);
      doc.text('Valor IR (R$):', col2X[3] + 2, t2Y + 2);
      doc.text('Contribuições Sociais (R$):', col2X[4] + 2, t2Y + 2);
      doc.text('Outras Retenções (R$):', col2X[5] + 2, t2Y + 2);
      doc.text('Valor Líquido (R$):', col2X[6] + 2, t2Y + 2);

      doc.font('Helvetica-Bold').fontSize(6.5);
      doc.text('0,00', col2X[0], t2Y + 10, { width: col2W[0] - 4, align: 'right' });
      doc.text('0,00', col2X[1], t2Y + 10, { width: col2W[1] - 4, align: 'right' });
      doc.text('0,00', col2X[2], t2Y + 10, { width: col2W[2] - 4, align: 'right' });
      doc.text('0,00', col2X[3], t2Y + 10, { width: col2W[3] - 4, align: 'right' });
      doc.text('0,00', col2X[4], t2Y + 10, { width: col2W[4] - 4, align: 'right' });
      doc.text('0,00', col2X[5], t2Y + 10, { width: col2W[5] - 4, align: 'right' });
      doc.text(valBc, col2X[6], t2Y + 10, { width: col2W[6] - 4, align: 'right' });

      // Linha horizontal 3 (Reforma Tributária IBS/CBS)
      const t3Y = t2Y + 20;
      doc.moveTo(left, t3Y).lineTo(right, t3Y).stroke();

      const col3W = [139, 140, 140, 140];
      curX = left;
      const col3X = [curX];
      for (let i = 0; i < col3W.length - 1; i++) {
        curX += col3W[i];
        col3X.push(curX);
        doc.moveTo(curX, t3Y).lineTo(curX, t3Y + 20).stroke();
      }

      doc.font('Helvetica').fontSize(6);
      doc.text('Alíquota IBS (%):', col3X[0] + 3, t3Y + 2);
      doc.text('Valor IBS (R$):', col3X[1] + 3, t3Y + 2);
      doc.text('Alíquota CBS (%):', col3X[2] + 3, t3Y + 2);
      doc.text('Valor CBS (R$):', col3X[3] + 3, t3Y + 2);

      doc.font('Helvetica').fontSize(7);
      doc.text('*', col3X[0], t3Y + 10, { width: col3W[0] - 4, align: 'right' });
      doc.text('*', col3X[1], t3Y + 10, { width: col3W[1] - 4, align: 'right' });
      doc.text('*', col3X[2], t3Y + 10, { width: col3W[2] - 4, align: 'right' });
      doc.text('*', col3X[3], t3Y + 10, { width: col3W[3] - 4, align: 'right' });

      // ==========================================
      // 7. OUTRAS INFORMAÇÕES - Y: 598 a 720 (h: 122)
      // ==========================================
      const oY = 598;
      const oHeight = 122;
      doc.rect(left, oY, width, oHeight).stroke();

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000')
        .text('OUTRAS INFORMAÇÕES', left, oY + 8, { width: width, align: 'center' });

      const infoY = oY + 24;
      doc.font('Helvetica').fontSize(7.5).fillColor('#000000');
      doc.text('- Esta Nota Salvador foi emitida com respaldo na Lei 7.186/2006.', left + 8, infoY);
      doc.text(`- Data de vencimento do ISS desta Nota Salvador: ${data.dataVencimento || '05 do mês subsequente'}`, left + 8, infoY + 14);
      doc.text(`- COMPETÊNCIA: ${data.competencia || '09/2026'} (mês/ano)`, left + 8, infoY + 28);
      const codTrib = data.itemServico ? `${data.itemServico} - Serviços homologados` : 'Serviços homologados no Município de Salvador';
      doc.text(`- Código de Tributação do Município: ${codTrib}`, left + 8, infoY + 42);
      doc.text('- Os valores de PIS/COFINS referem-se aos Valores de Apuração Própria, conforme Nota Técnica nº 07 do IBS/CBS.', left + 8, infoY + 56);

      // Marca d\'água de Cancelamento se cancelada
      if (data.isCancelada) {
        doc.save();
        doc.rotate(-35, { origin: [300, 400] });
        doc.fontSize(60).fillColor('#ef4444', 0.25).font('Helvetica-Bold')
          .text('NFS-e CANCELADA', 100, 380, { align: 'center', width: 400 });
        doc.restore();
      }

      doc.end();
    });
  },

  /**
   * Gera o Relatório Oficial de Auditoria e Conferência Mensal de NFS-e (Viacont)
   */
  async generateMonthlyConferenceReport(data: MonthlyConferenceData, outputPath?: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 25 });
      const buffers: Buffer[] = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => {
        const resultBuffer = Buffer.concat(buffers);
        if (outputPath) {
          try {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(outputPath, resultBuffer);
          } catch (writeErr) {
            return reject(writeErr);
          }
        }
        resolve(resultBuffer);
      });
      doc.on('error', reject);

      const left = 25;
      const width = 545;

      // 1. Cabeçalho Viacont
      doc.rect(left, 25, width, 60).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('VIACONT INOVAÇÕES CONTÁBEIS', left + 15, 35);
      doc.fontSize(9).font('Helvetica').text('Relatório Oficial de Auditoria e Conferência Mensal de NFS-e (Prefeitura de Salvador)', left + 15, 52);
      doc.fontSize(8).font('Helvetica-Oblique').text(`Competência: ${data.mesAno}   •   Emissão do Laudo: ${new Date().toLocaleString('pt-BR')}`, left + 15, 65);

      // 2. Dados da Empresa
      doc.fillColor('#000000');
      doc.rect(left, 95, width, 45).stroke('#cbd5e1');
      doc.fontSize(8.5).font('Helvetica-Bold').text(`Empresa: ${data.empresa}`, left + 10, 102);
      doc.fontSize(8).font('Helvetica').text(`CNPJ: ${data.cnpj}   |   Inscrição Municipal (CGA): ${data.cga}   |   Município: Salvador/BA`, left + 10, 116);
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text('Regime: Simples Nacional   |   Padrão: ABRASF Salvador WebService mTLS', left + 10, 128);
      doc.fillColor('#000000');

      // 3. Cards de Resumo
      const cardW = 130;
      doc.rect(left, 150, cardW, 50).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('TOTAL DE NOTAS', left + 10, 158);
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(`${data.totalNotas}`, left + 10, 172);

      doc.rect(left + 140, 150, cardW, 50).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('FAIXA DE NUMERAÇÃO', left + 150, 158);
      const faixaStr = data.totalNotas > 0 ? `${data.primeiraNota} a ${data.ultimaNota}` : 'Nenhuma nota';
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(faixaStr, left + 150, 172);

      doc.rect(left + 280, 150, cardW, 50).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('VALOR TOTAL SERVIÇOS', left + 290, 158);
      doc.fillColor('#059669').fontSize(11).font('Helvetica-Bold').text(`R$ ${data.totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 290, 172);

      doc.rect(left + 415, 150, cardW, 50).fill('#f8fafc').stroke('#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('ISS TOTAL APURADO', left + 425, 158);
      doc.fillColor('#2563eb').fontSize(11).font('Helvetica-Bold').text(`R$ ${data.totalIss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 425, 172);

      // 4. Verificação de Integridade Sequencial
      doc.fillColor('#000000');
      const hasGaps = data.gaps && data.gaps.length > 0;
      if (hasGaps) {
        doc.rect(left, 210, width, 25).fill('#fef2f2').stroke('#fca5a5');
        doc.fillColor('#b91c1c').fontSize(8.5).font('Helvetica-Bold')
          .text(`⚠️ ALERTA DE INTEGRIDADE: Detectados saltos na numeração (Gaps nas notas: ${data.gaps!.join(', ')}).`, left + 10, 218);
      } else {
        doc.rect(left, 210, width, 25).fill('#ecfdf5').stroke('#a7f3d0');
        doc.fillColor('#065f46').fontSize(8.5).font('Helvetica-Bold')
          .text('✓ INTEGRIDADE FISCAL: Numeração sequencial 100% contínua sem saltos ou notas faltantes.', left + 10, 218);
      }

      // 5. Relação das Notas Fiscais
      doc.fillColor('#000000');
      doc.fontSize(9).font('Helvetica-Bold').text(`Relação Completa das Notas Fiscais Auditadas no Mês (${data.totalNotas} notas | ${data.canceladas} canceladas):`, left, 248);

      let y = 262;
      doc.rect(left, y, width, 16).fill('#e2e8f0');
      doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold');
      doc.text('NFS-e', left + 5, y + 4);
      doc.text('Emissão', left + 55, y + 4);
      doc.text('Tomador do Serviço', left + 120, y + 4);
      doc.text('CNPJ/CPF', left + 320, y + 4);
      doc.text('Valor (R$)', left + 420, y + 4, { align: 'right', width: 50 });
      doc.text('ISS (R$)', left + 480, y + 4, { align: 'right', width: 55 });

      y += 16;
      doc.font('Helvetica').fontSize(7);

      for (let i = 0; i < data.notas.length; i++) {
        if (y > 770) {
          doc.addPage();
          y = 30;
          doc.rect(left, y, width, 16).fill('#e2e8f0');
          doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica-Bold');
          doc.text('NFS-e', left + 5, y + 4);
          doc.text('Emissão', left + 55, y + 4);
          doc.text('Tomador do Serviço', left + 120, y + 4);
          doc.text('CNPJ/CPF', left + 320, y + 4);
          doc.text('Valor (R$)', left + 420, y + 4, { align: 'right', width: 50 });
          doc.text('ISS (R$)', left + 480, y + 4, { align: 'right', width: 55 });
          y += 16;
          doc.font('Helvetica').fontSize(7);
        }

        const n = data.notas[i];
        if (i % 2 === 1) {
          doc.rect(left, y, width, 13).fill('#f8fafc');
        }

        if (n.isCancelada) {
          doc.fillColor('#ef4444');
          doc.text(`${n.numero} (CANC)`, left + 5, y + 3);
        } else {
          doc.fillColor('#0f172a');
          doc.text(`${n.numero}`, left + 5, y + 3);
        }

        const dtStr = n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString('pt-BR') : '-';
        doc.text(dtStr, left + 55, y + 3);
        doc.text(`${(n.tomadorNome || '').substring(0, 36)}`, left + 120, y + 3);
        doc.text(`${n.tomadorDoc || '-'}`, left + 320, y + 3);
        doc.text(`${Number(n.valorServicos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 420, y + 3, { align: 'right', width: 50 });
        doc.text(`${Number(n.valorIss || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, left + 480, y + 3, { align: 'right', width: 55 });

        y += 13;
      }

      if (y > 750) {
        doc.addPage();
        y = 30;
      }
      y += 15;
      doc.rect(left, y, width, 35).fill('#f1f5f9').stroke('#cbd5e1');
      doc.fillColor('#334155').fontSize(7).font('Helvetica-Bold')
        .text('CERTIFICADO DE CONFORMIDADE E AUDITORIA FISCAL:', left + 10, y + 8);
      doc.font('Helvetica').fontSize(6.5)
        .text(`O presente relatório foi gerado e conferido automaticamente pelo módulo ViaNFe Guardian. Os dados refletem fielmente os registros oficiais da SEFAZ Salvador obtidos via mTLS com Certificado Digital ICP-Brasil.`, left + 10, y + 18, { width: width - 20 });

      doc.end();
    });
  }
};
