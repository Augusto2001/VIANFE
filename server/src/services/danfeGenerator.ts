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
      margin: 20,
      info: {
        Title: `DANFE - NF-e ${invoice.numero}`,
        Author: 'DF-e Hub Contabilidade',
        Subject: `Nota Fiscal Eletrônica nº ${invoice.numero} Série ${invoice.serie}`,
      }
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Helpers
    const formatCurrency = (val?: number) => {
      return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    // Header box: DANFE
    doc.rect(20, 20, 555, 95).stroke('#334155');

    // Left: Emitente
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(invoice.emitente.razaoSocial.toUpperCase(), 25, 25, { width: 230, ellipsis: true });
    doc.fontSize(7).font('Helvetica').fillColor('#334155');
    if (invoice.emitente.logradouro) {
      doc.text(`${invoice.emitente.logradouro}, ${invoice.emitente.numero || 'S/N'} - ${invoice.emitente.bairro || ''}`, 25, 45, { width: 230 });
      doc.text(`${invoice.emitente.municipio || ''} - ${invoice.emitente.uf || ''} | CEP: ${invoice.emitente.cep || ''}`, 25, 57, { width: 230 });
    }
    doc.text(`CNPJ: ${formatCNPJ(invoice.emitente.cnpjCpf)}  IE: ${invoice.emitente.ie || 'ISENTO'}`, 25, 72, { width: 230 });

    // Center: DANFE box
    doc.rect(260, 20, 110, 95).stroke('#64748b');
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('DANFE', 260, 25, { align: 'center', width: 110 });
    doc.fontSize(6).font('Helvetica').fillColor('#475569').text('DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA', 265, 38, { align: 'center', width: 100 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`0 - ENTRADA`, 265, 58);
    doc.text(`1 - SAÍDA [ ${invoice.tipoOperacao === '1' ? '1' : '0'} ]`, 265, 68);
    doc.fontSize(7).text(`Nº: ${invoice.numero}`, 265, 82);
    doc.text(`SÉRIE: ${invoice.serie}`, 265, 94);

    // Right: Chave de Acesso
    doc.rect(375, 20, 200, 95).stroke('#64748b');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text('CHAVE DE ACESSO', 380, 25);
    doc.fontSize(7.5).font('Courier-Bold').fillColor('#0284c7').text(formatChaveAcesso(invoice.chaveAcesso), 380, 36, { width: 190 });
    
    doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
    doc.text('Consulta de autenticidade no portal nacional da NF-e', 380, 60, { width: 190 });
    doc.text('www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', 380, 68, { width: 190 });
    
    if (invoice.protocoloAutorizacao) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text(`PROTOCOLO: ${invoice.protocoloAutorizacao}`, 380, 85);
      doc.fontSize(6.5).font('Helvetica').text(`DATA/HORA: ${formatDate(invoice.dataAutorizacao)}`, 380, 96);
    }

    // Natureza da Operação
    doc.rect(20, 120, 555, 25).stroke('#cbd5e1');
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('NATUREZA DA OPERAÇÃO', 25, 123);
    doc.fontSize(8).font('Helvetica').fillColor('#0f172a').text(invoice.naturezaOperacao || 'VENDA', 25, 132);

    // Destinatário
    doc.rect(20, 150, 555, 50).stroke('#334155');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text('DESTINATÁRIO / REMETENTE', 25, 153);
    doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
    doc.text(`NOME / RAZÃO SOCIAL: ${invoice.destinatario.razaoSocial}`, 25, 165);
    doc.text(`CNPJ/CPF: ${formatCNPJ(invoice.destinatario.cnpjCpf)}`, 380, 165);
    doc.text(`ENDEREÇO: ${invoice.destinatario.logradouro || ''}, ${invoice.destinatario.numero || ''} - ${invoice.destinatario.bairro || ''}`, 25, 177);
    doc.text(`MUNICÍPIO: ${invoice.destinatario.municipio || ''} - ${invoice.destinatario.uf || ''}`, 380, 177);
    doc.text(`DATA EMISSÃO: ${formatDate(invoice.dataEmissao)}`, 25, 189);
    doc.text(`INSCRIÇÃO ESTADUAL: ${invoice.destinatario.ie || 'ISENTO'}`, 380, 189);

    // Totais e Impostos
    doc.rect(20, 205, 555, 45).stroke('#334155');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text('CÁLCULO DO IMPOSTO', 25, 208);
    
    // Grid of totals
    const yTotal = 220;
    doc.fontSize(6).font('Helvetica').fillColor('#475569');
    doc.text('BASE CÁLC. ICMS', 25, yTotal);
    doc.text('VALOR DO ICMS', 110, yTotal);
    doc.text('BASE ICMS ST', 200, yTotal);
    doc.text('VALOR ICMS ST', 290, yTotal);
    doc.text('VALOR TOTAL PROD.', 380, yTotal);
    doc.text('VALOR TOTAL DA NOTA', 470, yTotal);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(formatCurrency(invoice.totais.baseCalculoIcms), 25, yTotal + 10);
    doc.text(formatCurrency(invoice.totais.valorIcms), 110, yTotal + 10);
    doc.text(formatCurrency(invoice.totais.baseCalculoIcmsSt), 200, yTotal + 10);
    doc.text(formatCurrency(invoice.totais.valorIcmsSt), 290, yTotal + 10);
    doc.text(formatCurrency(invoice.totais.valorProdutos), 380, yTotal + 10);
    doc.fillColor('#0369a1').text(formatCurrency(invoice.totais.valorTotal), 470, yTotal + 10);

    // Itens da Nota Table
    doc.rect(20, 255, 555, 18).fillAndStroke('#f1f5f9', '#334155');
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CÓDIGO', 25, 260);
    doc.text('DESCRIÇÃO DO PRODUTO / SERVIÇO', 80, 260);
    doc.text('NCM', 250, 260);
    doc.text('CFOP', 290, 260);
    doc.text('UN', 325, 260);
    doc.text('QTD', 345, 260);
    doc.text('V. UNIT', 385, 260);
    doc.text('V. TOTAL', 440, 260);
    doc.text('BC ICMS', 495, 260);
    doc.text('ICMS', 545, 260);

    let currentY = 278;
    const maxItems = Math.min(invoice.itens.length, 12);

    for (let i = 0; i < maxItems; i++) {
      const it = invoice.itens[i];
      doc.rect(20, currentY - 3, 555, 16).stroke('#e2e8f0');
      doc.fontSize(6.5).font('Helvetica').fillColor('#334155');
      doc.text(it.codigo.substring(0, 8), 25, currentY);
      doc.text(it.descricao.substring(0, 38), 80, currentY, { width: 165, ellipsis: true });
      doc.text(it.ncm, 250, currentY);
      doc.text(it.cfop, 290, currentY);
      doc.text(it.unidade, 325, currentY);
      doc.text(String(it.quantidade), 345, currentY);
      doc.text(formatCurrency(it.valorUnitario), 385, currentY);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(it.valorTotal), 440, currentY);
      doc.font('Helvetica').fillColor('#334155').text(formatCurrency(it.icms?.baseCalculo), 495, currentY);
      doc.text(formatCurrency(it.icms?.valor), 545, currentY);

      currentY += 16;
    }

    if (invoice.itens.length > maxItems) {
      doc.fontSize(6.5).font('Helvetica-Oblique').fillColor('#64748b');
      doc.text(`... e mais ${invoice.itens.length - maxItems} itens detalhados no XML.`, 25, currentY + 4);
      currentY += 16;
    }

    // Informações Complementares
    const infoY = Math.max(currentY + 15, 660);
    doc.rect(20, infoY, 555, 130).stroke('#334155');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text('DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES', 25, infoY + 5);
    doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
    doc.text(
      invoice.informacoesComplementares || 'Documento emitido por ME ou EPP optante pelo Simples Nacional ou Regime Normal. Autenticidade garantida por assinatura digital SEFAZ.',
      25,
      infoY + 18,
      { width: 545, height: 105, ellipsis: true }
    );

    // Footer
    doc.fontSize(6).font('Helvetica').fillColor('#94a3b8').text(
      `DF-e Hub Contabilidade | Gerado em ${new Date().toLocaleString('pt-BR')} | Documento Oficial de Consulta`,
      20,
      805,
      { align: 'center', width: 555 }
    );

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', (err) => reject(err));
  });
}
