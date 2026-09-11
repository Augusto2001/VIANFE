import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { ParsedFiscalInvoice } from './xmlParser.js';
import { formatCNPJ, formatChaveAcesso } from '../utils/crypto.js';
import { PDFS_DIR } from '../database/db.js';

export async function generateDanfePdf(invoice: ParsedFiscalInvoice, outputPath?: string): Promise<string> {
  const filePath = outputPath || path.join(PDFS_DIR, `DANFE_${invoice.chaveAcesso}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 15,
      info: {
        Title: `DANFE - NF-e ${invoice.numero}`,
        Author: 'DF-e Hub Contabilidade / SEFAZ Nacional',
        Subject: `Documento Auxiliar da Nota Fiscal Eletrônica nº ${invoice.numero} Série ${invoice.serie}`,
      }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Helpers
    const formatCurrency = (val?: number) => {
      if (val === undefined || val === null || isNaN(val)) return '0,00';
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatUnitPrice = (val?: number) => {
      if (val === undefined || val === null || isNaN(val)) return '0,00';
      return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    const formatAliq = (val?: number) => {
      if (val === undefined || val === null || isNaN(val)) return '0%';
      return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
    };

    const formatDateOnly = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const clean = dateStr.split('T')[0];
        const [year, month, day] = clean.split('-');
        if (year && month && day) {
          return `${day}/${month}/${year}`;
        }
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    const formatTimeOnly = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        if (dateStr.includes('T')) {
          const timePart = dateStr.split('T')[1];
          return timePart.substring(0, 8);
        }
        const d = new Date(dateStr);
        return d.toLocaleTimeString('pt-BR');
      } catch {
        return '';
      }
    };

    const formatDateTime = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    const left = 15;
    const width = 565;
    let y = 15;

    // Multi-page DANFE parameters: High-density, professional layout
    const items = invoice.itens || [];
    let totalPages = 1;
    let itemsOnPage1 = 20;
    const itemsOnFollowPage = 36;

    if (items.length <= 20) {
      totalPages = 1;
      itemsOnPage1 = Math.max(items.length, 1);
    } else {
      itemsOnPage1 = 16;
      const remainingItems = items.length - itemsOnPage1;
      const followPages = Math.ceil(remainingItems / itemsOnFollowPage);
      totalPages = 1 + followPages;
    }

    // =========================================================================
    // 1. CANHOTO DE RECEBIMENTO (Padrão Nacional SEFAZ)
    // =========================================================================
    doc.lineWidth(0.5).rect(left, y, width - 110, 26).stroke('#000000');
    doc.fontSize(5).font('Helvetica').fillColor('#000000');
    doc.text(
      `RECEBEMOS DE ${invoice.emitente.razaoSocial.toUpperCase().substring(0, 75)} OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`,
      left + 4,
      y + 3,
      { width: width - 120 }
    );

    doc.rect(left, y + 26, 140, 18).stroke('#000000');
    doc.fontSize(4.5).text('DATA DE RECEBIMENTO', left + 3, y + 28);

    doc.rect(left + 140, y + 26, width - 250, 18).stroke('#000000');
    doc.fontSize(4.5).text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', left + 143, y + 28);

    // Canhoto Right Box: NF-e Nº
    doc.rect(left + width - 110, y, 110, 44).stroke('#000000');
    doc.fontSize(7.5).font('Helvetica-Bold').text('NF-e', left + width - 110, y + 4, { align: 'center', width: 110 });
    doc.fontSize(6.5).text(`Nº ${invoice.numero}`, left + width - 110, y + 16, { align: 'center', width: 110 });
    doc.fontSize(5.5).font('Helvetica').text(`SÉRIE ${invoice.serie}`, left + width - 110, y + 27, { align: 'center', width: 110 });

    y += 48;

    // Linha tracejada separadora do canhoto
    doc.save().dash(2, { space: 2 }).moveTo(left, y).lineTo(left + width, y).stroke('#000000').restore();
    y += 4;

    // =========================================================================
    // 2. CABEÇALHO DO DANFE: EMITENTE | DANFE IDENTIFICAÇÃO | CHAVE & CÓDIGO DE BARRAS
    // =========================================================================
    const headerHeight = 94;

    // Box 1: Emitente (Left)
    doc.rect(left, y, 225, headerHeight).stroke('#000000');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
    doc.text(invoice.emitente.razaoSocial.toUpperCase(), left + 5, y + 5, { width: 215, height: 24, ellipsis: true });
    
    doc.fontSize(6).font('Helvetica').fillColor('#000000');
    const emitAddr = `${invoice.emitente.logradouro || ''}, ${invoice.emitente.numero || 'S/N'} ${invoice.emitente.bairro ? `- ${invoice.emitente.bairro}` : ''}`;
    doc.text(emitAddr, left + 5, y + 30, { width: 215 });
    doc.text(`${invoice.emitente.municipio || ''} - ${invoice.emitente.uf || ''} | CEP: ${invoice.emitente.cep || ''}`, left + 5, y + 40, { width: 215 });
    if (invoice.emitente.fone) {
      doc.text(`FONE: ${invoice.emitente.fone}`, left + 5, y + 50, { width: 215 });
    }

    // Box 2: DANFE Central Box (Middle)
    doc.rect(left + 225, y, 105, headerHeight).stroke('#000000');
    doc.fontSize(11).font('Helvetica-Bold').text('DANFE', left + 225, y + 4, { align: 'center', width: 105 });
    doc.fontSize(5).font('Helvetica').text('DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA', left + 227, y + 16, { align: 'center', width: 101 });
    
    // Indicador 0 - Entrada / 1 - Saída com checkbox nacional
    const isSaida = invoice.tipoOperacao === '1';
    doc.fontSize(6).font('Helvetica');
    doc.text('0 - ENTRADA', left + 232, y + 33);
    doc.text('1 - SAÍDA', left + 232, y + 44);
    doc.rect(left + 285, y + 34, 15, 15).stroke('#000000');
    doc.fontSize(9).font('Helvetica-Bold').text(isSaida ? '1' : '0', left + 285, y + 37, { align: 'center', width: 15 });

    doc.fontSize(7).font('Helvetica-Bold');
    doc.text(`Nº ${invoice.numero || '0'}`, left + 225, y + 62, { align: 'center', width: 105 });
    doc.fontSize(6).text(`SÉRIE ${invoice.serie || '1'}`, left + 225, y + 72, { align: 'center', width: 105 });
    doc.fontSize(5.5).font('Helvetica').text(`FOLHA 1/${totalPages}`, left + 225, y + 82, { align: 'center', width: 105 });

    // Box 3: Chave de Acesso & Código de Barras (Right)
    doc.rect(left + 330, y, width - 330, headerHeight).stroke('#000000');
    
    // Simulação Vetorial de Código de Barras Code 128 (Padrão SEFAZ)
    const barcodeX = left + 338;
    const barcodeY = y + 5;
    const barcodeW = width - 346;
    const barcodeH = 24;
    doc.rect(barcodeX, barcodeY, barcodeW, barcodeH).fill('#ffffff').stroke('#000000');
    
    doc.fillColor('#000000');
    for (let b = 0; b < barcodeW - 8; b += 3.2) {
      const barW = (b % 7 === 0 || b % 5 === 0) ? 1.8 : 0.8;
      doc.rect(barcodeX + 4 + b, barcodeY + 2, barW, barcodeH - 4).fill('#000000');
    }

    doc.fontSize(5).font('Helvetica-Bold').fillColor('#000000').text('CHAVE DE ACESSO', left + 335, y + 33);
    doc.fontSize(7).font('Courier-Bold').fillColor('#000000').text(formatChaveAcesso(invoice.chaveAcesso), left + 335, y + 41, { width: width - 340 });

    doc.fontSize(5).font('Helvetica').text('Consulta de autenticidade no portal nacional da NF-e', left + 335, y + 56);
    doc.text('www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', left + 335, y + 63);

    if (invoice.protocoloAutorizacao) {
      doc.fontSize(5.5).font('Helvetica-Bold').text(`PROTOCOLO DE AUTORIZAÇÃO DE USO`, left + 335, y + 73);
      doc.fontSize(6).font('Helvetica').text(`${invoice.protocoloAutorizacao} - ${formatDateTime(invoice.dataAutorizacao)}`, left + 335, y + 81);
    }

    y += headerHeight;

    // =========================================================================
    // 3. NATUREZA DA OPERAÇÃO & INSCRIÇÕES ESTADUAIS
    // =========================================================================
    const natHeight = 20;
    doc.rect(left, y, 330, natHeight).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('NATUREZA DA OPERAÇÃO', left + 3, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(invoice.naturezaOperacao || 'VENDA DE MERCADORIAS', left + 3, y + 9, { width: 324 });

    doc.rect(left + 330, y, width - 330, natHeight).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('PROTOCOLO DE AUTORIZAÇÃO DE USO', left + 333, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(invoice.protocoloAutorizacao ? `${invoice.protocoloAutorizacao} - ${formatDateTime(invoice.dataAutorizacao)}` : 'AUTORIZADA', left + 333, y + 9);

    y += natHeight;

    const ieHeight = 20;
    doc.rect(left, y, 185, ieHeight).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('INSCRIÇÃO ESTADUAL', left + 3, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(invoice.emitente.ie || 'ISENTO', left + 3, y + 9);

    doc.rect(left + 185, y, 185, ieHeight).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('INSCRIÇÃO ESTADUAL DO SUBST. TRIB.', left + 188, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text('', left + 188, y + 9);

    doc.rect(left + 370, y, width - 370, ieHeight).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('CNPJ', left + 373, y + 2);
    doc.fontSize(7).font('Helvetica-Bold').text(formatCNPJ(invoice.emitente.cnpjCpf), left + 373, y + 9);

    y += ieHeight + 3;

    // =========================================================================
    // 4. DESTINATÁRIO / REMETENTE
    // =========================================================================
    doc.fontSize(5.5).font('Helvetica-Bold').text('DESTINATÁRIO / REMETENTE', left, y);
    y += 7;

    const destRow1 = 18;
    doc.rect(left, y, 360, destRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('NOME / RAZÃO SOCIAL', left + 3, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(invoice.destinatario.razaoSocial.toUpperCase(), left + 3, y + 8, { width: 354, ellipsis: true });

    doc.rect(left + 360, y, 120, destRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('CNPJ / CPF', left + 363, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(formatCNPJ(invoice.destinatario.cnpjCpf), left + 363, y + 8);

    doc.rect(left + 480, y, width - 480, destRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('DATA DA EMISSÃO', left + 483, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(formatDateOnly(invoice.dataEmissao), left + 483, y + 8);

    y += destRow1;

    const destRow2 = 18;
    doc.rect(left, y, 260, destRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('ENDEREÇO', left + 3, y + 2);
    const destAddr = `${invoice.destinatario.logradouro || ''}, ${invoice.destinatario.numero || 'S/N'}`;
    doc.fontSize(6).font('Helvetica-Bold').text(destAddr, left + 3, y + 8, { width: 254, ellipsis: true });

    doc.rect(left + 260, y, 130, destRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('BAIRRO / DISTRITO', left + 263, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(invoice.destinatario.bairro || '', left + 263, y + 8, { width: 124, ellipsis: true });

    doc.rect(left + 390, y, 90, destRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('CEP', left + 393, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(invoice.destinatario.cep || '', left + 393, y + 8);

    doc.rect(left + 480, y, width - 480, destRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('DATA SAÍDA / ENTRADA', left + 483, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(formatDateOnly(invoice.dataSaidaEntrada || invoice.dataEmissao), left + 483, y + 8);

    y += destRow2;

    const destRow3 = 18;
    doc.rect(left, y, 200, destRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('MUNICÍPIO', left + 3, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(invoice.destinatario.municipio || '', left + 3, y + 8);

    doc.rect(left + 200, y, 90, destRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('FONE / FAX', left + 203, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(invoice.destinatario.fone || '', left + 203, y + 8);

    doc.rect(left + 290, y, 30, destRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('UF', left + 293, y + 2);
    doc.fontSize(6.5).font('Helvetica-Bold').text(invoice.destinatario.uf || '', left + 293, y + 8);

    doc.rect(left + 320, y, 160, destRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('INSCRIÇÃO ESTADUAL', left + 323, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(invoice.destinatario.ie || 'ISENTO', left + 323, y + 8);

    doc.rect(left + 480, y, width - 480, destRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('HORA DA SAÍDA', left + 483, y + 2);
    const horaSaida = formatTimeOnly(invoice.dataSaidaEntrada) || formatTimeOnly(invoice.dataEmissao) || '';
    doc.fontSize(6.5).font('Helvetica-Bold').text(horaSaida, left + 483, y + 8);

    y += destRow3 + 3;

    // =========================================================================
    // 5. CÁLCULO DO IMPOSTO
    // =========================================================================
    doc.fontSize(5.5).font('Helvetica-Bold').text('CÁLCULO DO IMPOSTO', left, y);
    y += 7;

    const impWidth = width / 6;
    const impRow1 = 18;
    
    doc.rect(left, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('BASE DE CÁLCULO DO ICMS', left + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.baseCalculoIcms), left + 2, y + 8, { align: 'right', width: impWidth - 4 });

    doc.rect(left + impWidth, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR DO ICMS', left + impWidth + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorIcms), left + impWidth + 2, y + 8, { align: 'right', width: impWidth - 4 });

    doc.rect(left + impWidth * 2, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('BASE DE CÁLC. ICMS S.T.', left + impWidth * 2 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.baseCalculoIcmsSt), left + impWidth * 2 + 2, y + 8, { align: 'right', width: impWidth - 4 });

    doc.rect(left + impWidth * 3, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR DO ICMS S.T.', left + impWidth * 3 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorIcmsSt), left + impWidth * 3 + 2, y + 8, { align: 'right', width: impWidth - 4 });

    doc.rect(left + impWidth * 4, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR TOTAL DOS PRODUTOS', left + impWidth * 4 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorProdutos), left + impWidth * 4 + 2, y + 8, { align: 'right', width: impWidth - 4 });

    doc.rect(left + impWidth * 5, y, impWidth, impRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica-Bold').text('VALOR TOTAL DA NOTA', left + impWidth * 5 + 2, y + 2);
    doc.fontSize(7).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorTotal), left + impWidth * 5 + 2, y + 7, { align: 'right', width: impWidth - 4 });

    y += impRow1;

    // Row 2
    const impRow2 = 18;
    const imp2Width = width / 5;

    doc.rect(left, y, imp2Width, impRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR DO FRETE', left + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorFrete), left + 2, y + 8, { align: 'right', width: imp2Width - 4 });

    doc.rect(left + imp2Width, y, imp2Width, impRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR DO SEGURO', left + imp2Width + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorSeguro), left + imp2Width + 2, y + 8, { align: 'right', width: imp2Width - 4 });

    doc.rect(left + imp2Width * 2, y, imp2Width, impRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('DESCONTO', left + imp2Width * 2 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorDesconto), left + imp2Width * 2 + 2, y + 8, { align: 'right', width: imp2Width - 4 });

    doc.rect(left + imp2Width * 3, y, imp2Width, impRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('OUTRAS DESPESAS ACESS.', left + imp2Width * 3 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorOutrasDespesas), left + imp2Width * 3 + 2, y + 8, { align: 'right', width: imp2Width - 4 });

    doc.rect(left + imp2Width * 4, y, imp2Width, impRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('VALOR DO IPI', left + imp2Width * 4 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCurrency(invoice.totais.valorIpi), left + imp2Width * 4 + 2, y + 8, { align: 'right', width: imp2Width - 4 });

    y += impRow2 + 3;

    // =========================================================================
    // 6. FATURA / DUPLICATAS (PARCELAS FINANCEIRAS)
    // =========================================================================
    doc.fontSize(5.5).font('Helvetica-Bold').text('FATURA / DUPLICATA', left, y);
    y += 7;

    const dupList = invoice.duplicatas || [];
    if (dupList.length > 0) {
      const dupBoxWidth = Math.min(width / Math.min(dupList.length, 6), 94);
      const dupBoxHeight = 22;

      let curDupX = left;
      let dupRowCount = 0;

      for (let d = 0; d < dupList.length; d++) {
        const dup = dupList[d];
        if (curDupX + dupBoxWidth > left + width + 1) {
          curDupX = left;
          y += dupBoxHeight;
          dupRowCount++;
          if (dupRowCount > 2) break; // Limit rows
        }

        doc.rect(curDupX, y, dupBoxWidth, dupBoxHeight).stroke('#000000');
        doc.fontSize(4).font('Helvetica').text(`Nº ${dup.numero}`, curDupX + 2, y + 2);
        doc.fontSize(4.5).font('Helvetica').text(`VENC: ${formatDateOnly(dup.vencimento)}`, curDupX + 2, y + 8);
        doc.fontSize(5.5).font('Helvetica-Bold').text(`R$ ${formatCurrency(dup.valor)}`, curDupX + 2, y + 14, { align: 'right', width: dupBoxWidth - 4 });

        curDupX += dupBoxWidth;
      }
      y += dupBoxHeight + 3;
    } else if (invoice.fatura) {
      doc.rect(left, y, width, 18).stroke('#000000');
      doc.fontSize(4.5).font('Helvetica').text(`NÚMERO: ${invoice.fatura.numero || invoice.numero} | VALOR ORIGINAL: R$ ${formatCurrency(invoice.fatura.valorOriginal || invoice.totais.valorTotal)} | DESCONTO: R$ ${formatCurrency(invoice.fatura.valorDesconto || 0)} | VALOR LÍQUIDO: R$ ${formatCurrency(invoice.fatura.valorLiquido || invoice.totais.valorTotal)}`, left + 4, y + 6);
      y += 21;
    } else {
      doc.rect(left, y, width, 14).stroke('#000000');
      doc.fontSize(5).font('Helvetica').text('PAGAMENTO À VISTA / SEM COBRANÇA DIRETA', left + 4, y + 4);
      y += 17;
    }

    // =========================================================================
    // 7. TRANSPORTADOR / VOLUMES TRANSPORTADOS
    // =========================================================================
    doc.fontSize(5.5).font('Helvetica-Bold').text('TRANSPORTADOR / VOLUMES TRANSPORTADOS', left, y);
    y += 7;

    const transp = invoice.transporte || {
      modalidadeFrete: '9 - Sem Ocorrência de Transporte',
      modalidadeCodigo: '9'
    };
    const transpRow1 = 18;

    // Row 1
    doc.rect(left, y, 190, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('RAZÃO SOCIAL', left + 3, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text((transp.transportadora?.razaoSocial || '').toUpperCase(), left + 3, y + 8, { width: 184, ellipsis: true });

    doc.rect(left + 190, y, 110, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('FRETE POR CONTA', left + 193, y + 2);
    doc.fontSize(5.5).font('Helvetica-Bold').text(transp.modalidadeFrete || '9 - Sem Frete', left + 193, y + 8, { width: 104, ellipsis: true });

    doc.rect(left + 300, y, 60, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('CÓDIGO ANTT', left + 303, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.veiculo?.rntc || '', left + 303, y + 8);

    doc.rect(left + 360, y, 60, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('PLACA DO VEÍC.', left + 363, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.veiculo?.placa || '', left + 363, y + 8);

    doc.rect(left + 420, y, 30, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('UF', left + 423, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.veiculo?.uf || '', left + 423, y + 8);

    doc.rect(left + 450, y, width - 450, transpRow1).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('CNPJ / CPF', left + 453, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(formatCNPJ(transp.transportadora?.cnpjCpf || ''), left + 453, y + 8);

    y += transpRow1;

    // Row 2
    const transpRow2 = 18;
    doc.rect(left, y, 240, transpRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('ENDEREÇO', left + 3, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.transportadora?.endereco || '', left + 3, y + 8, { width: 234, ellipsis: true });

    doc.rect(left + 240, y, 180, transpRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('MUNICÍPIO', left + 243, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.transportadora?.municipio || '', left + 243, y + 8);

    doc.rect(left + 420, y, 30, transpRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('UF', left + 423, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.transportadora?.uf || '', left + 423, y + 8);

    doc.rect(left + 450, y, width - 450, transpRow2).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('INSCRIÇÃO ESTADUAL', left + 453, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(transp.transportadora?.ie || '', left + 453, y + 8);

    y += transpRow2;

    // Row 3 (Volumes)
    const transpRow3 = 18;
    const vol = transp.volumes || {};
    const volColW = width / 6;

    doc.rect(left, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('QUANTIDADE', left + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.quantidade ? String(vol.quantidade) : '', left + 2, y + 8);

    doc.rect(left + volColW, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('ESPÉCIE', left + volColW + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.especie || '', left + volColW + 2, y + 8);

    doc.rect(left + volColW * 2, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('MARCA', left + volColW * 2 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.marca || '', left + volColW * 2 + 2, y + 8);

    doc.rect(left + volColW * 3, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('NUMERAÇÃO', left + volColW * 3 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.numeracao || '', left + volColW * 3 + 2, y + 8);

    doc.rect(left + volColW * 4, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('PESO BRUTO', left + volColW * 4 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.pesoBruto ? `${Number(vol.pesoBruto).toFixed(3)} kg` : '', left + volColW * 4 + 2, y + 8);

    doc.rect(left + volColW * 5, y, volColW, transpRow3).stroke('#000000');
    doc.fontSize(4.5).font('Helvetica').text('PESO LÍQUIDO', left + volColW * 5 + 2, y + 2);
    doc.fontSize(6).font('Helvetica-Bold').text(vol.pesoLiquido ? `${Number(vol.pesoLiquido).toFixed(3)} kg` : '', left + volColW * 5 + 2, y + 8);

    y += transpRow3 + 3;

    // =========================================================================
    // 8. DADOS DOS PRODUTOS / SERVIÇOS
    // =========================================================================
    doc.fontSize(5.5).font('Helvetica-Bold').text('DADOS DOS PRODUTOS / SERVIÇOS', left, y);
    y += 7;

    // Table Header
    const colW = {
      cod: 40,
      desc: 176,
      ncm: 45,
      cst: 25,
      cfop: 25,
      un: 20,
      qtd: 35,
      vunit: 45,
      vtotal: 45,
      bcicms: 45,
      vicms: 35,
      aliq: 27
    };

    doc.rect(left, y, width, 12).fillAndStroke('#f8fafc', '#000000');
    doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#000000');
    
    let curX = left + 1;
    doc.text('CÓDIGO', curX, y + 3, { width: colW.cod });
    curX += colW.cod;
    doc.text('DESCRIÇÃO DO PRODUTO / SERVIÇO', curX, y + 3, { width: colW.desc });
    curX += colW.desc;
    doc.text('NCM/SH', curX, y + 3, { width: colW.ncm });
    curX += colW.ncm;
    doc.text('CST', curX, y + 3, { width: colW.cst });
    curX += colW.cst;
    doc.text('CFOP', curX, y + 3, { width: colW.cfop });
    curX += colW.cfop;
    doc.text('UN', curX, y + 3, { width: colW.un });
    curX += colW.un;
    doc.text('QTD.', curX, y + 3, { width: colW.qtd, align: 'right' });
    curX += colW.qtd;
    doc.text('V. UNIT.', curX, y + 3, { width: colW.vunit, align: 'right' });
    curX += colW.vunit;
    doc.text('V. TOTAL', curX, y + 3, { width: colW.vtotal, align: 'right' });
    curX += colW.vtotal;
    doc.text('BC ICMS', curX, y + 3, { width: colW.bcicms, align: 'right' });
    curX += colW.bcicms;
    doc.text('V. ICMS', curX, y + 3, { width: colW.vicms, align: 'right' });
    curX += colW.vicms;
    doc.text('ALÍQ.', curX, y + 3, { width: colW.aliq, align: 'right' });

    y += 12;

    // Items List
    const itemHeight = 11;

    // Helper to render Dados Adicionais / Informações Complementares
    const renderAdditionalData = (currentY: number) => {
      currentY += 5;
      doc.fontSize(5.5).font('Helvetica-Bold').text('DADOS ADICIONAIS', left, currentY);
      currentY += 7;

      const addHeight = Math.min(180, Math.max(55, 785 - currentY));
      doc.rect(left, currentY, 380, addHeight).stroke('#000000');
      doc.fontSize(4.5).font('Helvetica-Bold').text('INFORMAÇÕES COMPLEMENTARES', left + 3, currentY + 2);
      
      const obsText = invoice.informacoesComplementares || 'Documento emitido por ME ou EPP optante pelo Simples Nacional ou Regime Normal. Permite o aproveitamento do crédito de ICMS correspondente na forma da lei.';
      doc.fontSize(5).font('Helvetica').text(
        obsText,
        left + 3,
        currentY + 10,
        { width: 374, height: addHeight - 12 }
      );

      doc.rect(left + 380, currentY, width - 380, addHeight).stroke('#000000');
      doc.fontSize(4.5).font('Helvetica-Bold').text('RESERVADO AO FISCO', left + 383, currentY + 2);
      if (invoice.informacoesFisco) {
        doc.fontSize(5).font('Helvetica').text(invoice.informacoesFisco, left + 383, currentY + 10, { width: width - 386, height: addHeight - 12 });
      }
    };

    // Helper to render Table Header on any sheet
    const renderTableHeader = (currentY: number) => {
      doc.fontSize(5.5).font('Helvetica-Bold').text('DADOS DOS PRODUTOS / SERVIÇOS', left, currentY);
      currentY += 7;

      doc.rect(left, currentY, width, 12).fillAndStroke('#f8fafc', '#000000');
      doc.fontSize(4.5).font('Helvetica-Bold').fillColor('#000000');
      
      let curX = left + 1;
      doc.text('CÓDIGO', curX, currentY + 3, { width: colW.cod });
      curX += colW.cod;
      doc.text('DESCRIÇÃO DO PRODUTO / SERVIÇO', curX, currentY + 3, { width: colW.desc });
      curX += colW.desc;
      doc.text('NCM/SH', curX, currentY + 3, { width: colW.ncm });
      curX += colW.ncm;
      doc.text('CST', curX, currentY + 3, { width: colW.cst });
      curX += colW.cst;
      doc.text('CFOP', curX, currentY + 3, { width: colW.cfop });
      curX += colW.cfop;
      doc.text('UN', curX, currentY + 3, { width: colW.un });
      curX += colW.un;
      doc.text('QTD.', curX, currentY + 3, { width: colW.qtd, align: 'right' });
      curX += colW.qtd;
      doc.text('V. UNIT.', curX, currentY + 3, { width: colW.vunit, align: 'right' });
      curX += colW.vunit;
      doc.text('V. TOTAL', curX, currentY + 3, { width: colW.vtotal, align: 'right' });
      curX += colW.vtotal;
      doc.text('BC ICMS', curX, currentY + 3, { width: colW.bcicms, align: 'right' });
      curX += colW.bcicms;
      doc.text('V. ICMS', curX, currentY + 3, { width: colW.vicms, align: 'right' });
      curX += colW.vicms;
      doc.text('ALÍQ.', curX, currentY + 3, { width: colW.aliq, align: 'right' });

      return currentY + 12;
    };

    // Render Page 1 Items
    if (items.length === 0) {
      doc.rect(left, y, width, 40).stroke('#cbd5e1');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#b91c1c');
      doc.text('NOTA FISCAL CAPTURADA EM RESUMO NA SEFAZ (resNFe)', left + 10, y + 10, { align: 'center', width: width - 20 });
      doc.fontSize(6).font('Helvetica').fillColor('#334155');
      doc.text('Para exibir todos os itens, NCMs e detalhamento completo de impostos neste DANFE, realize a Manifestação do Destinatário (Ciência da Emissão) no painel.', left + 10, y + 22, { align: 'center', width: width - 20 });
      y += 45;
    } else {
      const page1Limit = Math.min(items.length, itemsOnPage1);
      for (let i = 0; i < page1Limit; i++) {
        const it = items[i];
        doc.rect(left, y, width, itemHeight).stroke('#cbd5e1');
        doc.fontSize(5).font('Helvetica').fillColor('#000000');

        let itemX = left + 1;
        doc.text(String(it.codigo || '').substring(0, 10), itemX, y + 2, { width: colW.cod });
        itemX += colW.cod;
        doc.text(String(it.descricao || '').trim(), itemX, y + 2, { width: colW.desc, ellipsis: true });
        itemX += colW.desc;
        doc.text(it.ncm || '', itemX, y + 2, { width: colW.ncm });
        itemX += colW.ncm;
        doc.text(it.icms?.cst || (it as any).cst || '000', itemX, y + 2, { width: colW.cst });
        itemX += colW.cst;
        doc.text(it.cfop || '', itemX, y + 2, { width: colW.cfop });
        itemX += colW.cfop;
        doc.text(it.unidade || 'UN', itemX, y + 2, { width: colW.un });
        itemX += colW.un;
        doc.text(Number(it.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), itemX, y + 2, { width: colW.qtd, align: 'right' });
        itemX += colW.qtd;
        doc.text(formatUnitPrice(it.valorUnitario), itemX, y + 2, { width: colW.vunit, align: 'right' });
        itemX += colW.vunit;
        doc.font('Helvetica-Bold').text(formatCurrency(it.valorTotal), itemX, y + 2, { width: colW.vtotal, align: 'right' });
        itemX += colW.vtotal;
        doc.font('Helvetica').text(formatCurrency(it.icms?.baseCalculo), itemX, y + 2, { width: colW.bcicms, align: 'right' });
        itemX += colW.bcicms;
        doc.text(formatCurrency(it.icms?.valor), itemX, y + 2, { width: colW.vicms, align: 'right' });
        itemX += colW.vicms;
        doc.text(formatAliq(it.icms?.aliquota), itemX, y + 2, { width: colW.aliq, align: 'right' });

        y += itemHeight;
      }
    }

    if (totalPages === 1) {
      renderAdditionalData(y);
    }

    // =========================================================================
    // MULTI-PAGE DANFE: SUBSEQUENT SHEETS (FOLHA 2/N, 3/N, ...)
    // =========================================================================
    let currentItemIdx = itemsOnPage1;

    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      doc.addPage({ size: 'A4', margin: 15 });
      let pageY = 15;

      const followHeaderH = 45;
      
      // Box 1: Emitente Resumido
      doc.rect(left, pageY, 225, followHeaderH).stroke('#000000');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000000');
      doc.text((invoice.emitente?.razaoSocial || 'EMITENTE').toUpperCase(), left + 5, pageY + 4, { width: 215, ellipsis: true });
      doc.fontSize(6).font('Helvetica');
      doc.text(`CNPJ: ${formatCNPJ(invoice.emitente?.cnpjCpf || '')} | IE: ${invoice.emitente?.ie || 'ISENTO'}`, left + 5, pageY + 20, { width: 215 });
      doc.text(`${invoice.emitente?.municipio || ''} - ${invoice.emitente?.uf || ''}`, left + 5, pageY + 30, { width: 215 });

      // Box 2: DANFE Central Box
      doc.rect(left + 225, pageY, 105, followHeaderH).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').text('DANFE', left + 225, pageY + 3, { align: 'center', width: 105 });
      doc.fontSize(5.5).font('Helvetica').text(`Nº ${invoice.numero || '0'} | SÉRIE ${invoice.serie || '1'}`, left + 225, pageY + 16, { align: 'center', width: 105 });
      doc.fontSize(6).font('Helvetica-Bold').text(`FOLHA ${pageNum}/${totalPages}`, left + 225, pageY + 28, { align: 'center', width: 105 });

      // Box 3: Chave de Acesso
      doc.rect(left + 330, pageY, width - 330, followHeaderH).stroke('#000000');
      doc.fontSize(5).font('Helvetica-Bold').text('CHAVE DE ACESSO', left + 335, pageY + 4);
      doc.fontSize(6.5).font('Courier-Bold').text(formatChaveAcesso(invoice.chaveAcesso), left + 335, pageY + 12, { width: width - 340 });
      doc.fontSize(5.5).font('Helvetica').text(`Protocolo: ${invoice.protocoloAutorizacao || 'AUTORIZADA'} - ${formatDateTime(invoice.dataAutorizacao)}`, left + 335, pageY + 28);

      pageY += followHeaderH + 6;

      pageY = renderTableHeader(pageY);

      const itemsForThisPage = Math.min(items.length - currentItemIdx, itemsOnFollowPage);
      for (let k = 0; k < itemsForThisPage; k++) {
        const it = items[currentItemIdx++];
        doc.rect(left, pageY, width, itemHeight).stroke('#cbd5e1');
        doc.fontSize(5).font('Helvetica').fillColor('#000000');

        let itemX = left + 1;
        doc.text(String(it.codigo || '').substring(0, 10), itemX, pageY + 2, { width: colW.cod });
        itemX += colW.cod;
        doc.text(String(it.descricao || '').trim(), itemX, pageY + 2, { width: colW.desc, ellipsis: true });
        itemX += colW.desc;
        doc.text(it.ncm || '', itemX, pageY + 2, { width: colW.ncm });
        itemX += colW.ncm;
        doc.text(it.icms?.cst || (it as any).cst || '000', itemX, pageY + 2, { width: colW.cst });
        itemX += colW.cst;
        doc.text(it.cfop || '', itemX, pageY + 2, { width: colW.cfop });
        itemX += colW.cfop;
        doc.text(it.unidade || 'UN', itemX, pageY + 2, { width: colW.un });
        itemX += colW.un;
        doc.text(Number(it.quantidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), itemX, pageY + 2, { width: colW.qtd, align: 'right' });
        itemX += colW.qtd;
        doc.text(formatUnitPrice(it.valorUnitario), itemX, pageY + 2, { width: colW.vunit, align: 'right' });
        itemX += colW.vunit;
        doc.font('Helvetica-Bold').text(formatCurrency(it.valorTotal), itemX, pageY + 2, { width: colW.vtotal, align: 'right' });
        itemX += colW.vtotal;
        doc.font('Helvetica').text(formatCurrency(it.icms?.baseCalculo), itemX, pageY + 2, { width: colW.bcicms, align: 'right' });
        itemX += colW.bcicms;
        doc.text(formatCurrency(it.icms?.valor), itemX, pageY + 2, { width: colW.vicms, align: 'right' });
        itemX += colW.vicms;
        doc.text(formatAliq(it.icms?.aliquota), itemX, pageY + 2, { width: colW.aliq, align: 'right' });

        pageY += itemHeight;
      }

      if (pageNum === totalPages) {
        renderAdditionalData(pageY);
      }
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}
