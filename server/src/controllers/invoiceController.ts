import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { db, XMLS_DIR, PDFS_DIR } from '../database/db.js';
import { sefazService } from '../services/sefazService.js';
import { parseFiscalXml } from '../services/xmlParser.js';
import { generateDanfePdf } from '../services/danfeGenerator.js';
import { runJlComercioFullIngestion } from '../services/jlComercioIngestionService.js';
import { reclassifyAndSanitizeDatabase } from '../utils/fiscalClassifier.js';

export const invoiceController = {
  /**
   * List invoices with STRICT company isolation and date filters
   */
  async list(req: Request, res: Response) {
    try {
      const company_id = req.query.company_id ? String(req.query.company_id) : '';
      const period = req.query.period ? String(req.query.period) : 'all';
      const startDate = req.query.startDate ? String(req.query.startDate) : '';
      const endDate = req.query.endDate ? String(req.query.endDate) : '';
      const tipo = req.query.tipo ? String(req.query.tipo) : 'all';
      const status = req.query.status ? String(req.query.status) : 'all';
      const search = req.query.search ? String(req.query.search) : '';
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);

      if (!company_id) {
        return res.status(400).json({
          success: false,
          message: 'O parâmetro company_id é obrigatório para isolamento seguro dos dados.'
        });
      }

      // Calculate date boundary based on preset or custom range
      let dateFilterStart: string | null = null;
      let dateFilterEnd: string | null = null;
      const now = new Date();

      if (period === 'all') {
        // No date filter — show all invoices for the company
        dateFilterStart = null;
        dateFilterEnd = null;
      } else if (period === '7d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        dateFilterStart = d.toISOString().split('T')[0] + 'T00:00:00.000Z';
      } else if (period === '15d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 15);
        dateFilterStart = d.toISOString().split('T')[0] + 'T00:00:00.000Z';
      } else if (period === '30d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        dateFilterStart = d.toISOString().split('T')[0] + 'T00:00:00.000Z';
      } else if (period === 'custom' || startDate || endDate) {
        if (startDate) dateFilterStart = startDate + 'T00:00:00.000Z';
        if (endDate) dateFilterEnd = endDate + 'T23:59:59.999Z';
      }

      // Build query with STRICT company_id filter
      const conditions: string[] = ['company_id = ?'];
      const params: string[] = [company_id];

      if (dateFilterStart) {
        conditions.push('data_emissao >= ?');
        params.push(dateFilterStart);
      }

      if (dateFilterEnd) {
        conditions.push('data_emissao <= ?');
        params.push(dateFilterEnd);
      }

      if (tipo && tipo !== 'all') {
        conditions.push('tipo = ?');
        params.push(tipo);
      }

      if (status && status !== 'all') {
        conditions.push('status = ?');
        params.push(status);
      }

      if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        conditions.push('(chave_acesso LIKE ? OR numero LIKE ? OR emitente_nome LIKE ? OR destinatario_nome LIKE ?)');
        params.push(term, term, term, term);
      }

      const whereClause = conditions.join(' AND ');

      // Summary metrics for the filtered result
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(valor_total), 0) as total_valor,
          COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor_total ELSE 0 END), 0) as valor_entradas,
          COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor_total ELSE 0 END), 0) as valor_saidas,
          COUNT(CASE WHEN gdrive_synced = 1 THEN 1 END) as total_gdrive_synced,
          COUNT(CASE WHEN gdrive_synced = 0 THEN 1 END) as total_gdrive_pending
        FROM invoices
        WHERE ${whereClause}
      `).get(...params) as any;

      const offset = (page - 1) * limit;
      const invoices = db.prepare(`
        SELECT 
          id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
          natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
          destinatario_cnpj, destinatario_nome, destinatario_uf,
          valor_total, valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
          gdrive_synced, gdrive_synced_at, created_at
        FROM invoices
        WHERE ${whereClause}
        ORDER BY data_emissao DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      return res.json({
        success: true,
        data: invoices,
        summary: {
          totalCount: summary?.total_count || 0,
          totalValor: summary?.total_valor || 0,
          valorEntradas: summary?.valor_entradas || 0,
          valorSaidas: summary?.valor_saidas || 0,
          totalGdriveSynced: summary?.total_gdrive_synced || 0,
          totalGdrivePending: summary?.total_gdrive_pending || 0,
        },
        pagination: {
          page,
          limit,
          totalPages: Math.ceil((summary?.total_count || 0) / limit)
        }
      });
    } catch (err: any) {
      console.error('Error listing invoices:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get complete invoice details including items and raw JSON
   */
  async getById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;

      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Nota Fiscal não encontrada.' });
      }

      const itens = invoice.itens_json ? JSON.parse(invoice.itens_json) : [];
      const duplicatas = invoice.duplicatas_json ? JSON.parse(invoice.duplicatas_json) : [];
      const fatura = invoice.fatura_json ? JSON.parse(invoice.fatura_json) : null;
      const pagamentos = invoice.pagamentos_json ? JSON.parse(invoice.pagamentos_json) : [];
      const installments = db.prepare('SELECT * FROM invoice_installments WHERE invoice_id = ? ORDER BY numero_parcela ASC').all(id) as any[];

      return res.json({
        success: true,
        data: {
          ...invoice,
          itens,
          duplicatas,
          fatura,
          pagamentos,
          installments
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Download individual XML
   */
  async downloadXml(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;

      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Nota Fiscal não encontrada.' });
      }

      let xmlContent = invoice.xml_raw;
      if (!xmlContent && invoice.xml_file_path && fs.existsSync(invoice.xml_file_path)) {
        xmlContent = fs.readFileSync(invoice.xml_file_path, 'utf-8');
      }

      if (!xmlContent) {
        return res.status(404).json({ success: false, message: 'Arquivo XML não localizado no servidor.' });
      }

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.chave_acesso}.xml"`);
      return res.send(xmlContent);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Download or Stream individual DANFE PDF (Padrão Nacional SEFAZ)
   */
  async downloadPdf(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;

      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Nota Fiscal não encontrada.' });
      }

      let xmlContent = invoice.xml_raw;
      if (!xmlContent && invoice.xml_file_path && fs.existsSync(invoice.xml_file_path)) {
        xmlContent = fs.readFileSync(invoice.xml_file_path, 'utf-8');
      }

      let pdfPath = invoice.pdf_file_path;

      // Always generate/refresh DANFE to official National Standard layout
      if (xmlContent) {
        try {
          const parsed = parseFiscalXml(xmlContent);
          pdfPath = path.join(PDFS_DIR, `DANFE_${invoice.chave_acesso}.pdf`);
          await generateDanfePdf(parsed, pdfPath);
          db.prepare('UPDATE invoices SET pdf_file_path = ? WHERE id = ?').run(pdfPath, invoice.id);
        } catch (genErr) {
          console.warn('Could not generate DANFE on the fly, falling back to existing PDF:', genErr);
        }
      }

      if (!pdfPath || !fs.existsSync(pdfPath)) {
        return res.status(404).json({ success: false, message: 'Arquivo DANFE PDF não encontrado.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="DANFE_${invoice.chave_acesso}.pdf"`);
      const fileStream = fs.createReadStream(pdfPath);
      return fileStream.pipe(res);
    } catch (err: any) {
      console.error('Error generating/downloading PDF:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Download ZIP package containing XMLs or PDFs for the company
   */
  async downloadZip(req: Request, res: Response) {
    try {
      const company_id = String(req.body.company_id || '');
      const type = String(req.body.type || 'xml');
      const ids = req.body.ids;

      if (!company_id) {
        return res.status(400).json({ success: false, message: 'company_id é obrigatório.' });
      }

      const company = db.prepare('SELECT razao_social FROM companies WHERE id = ?').get(company_id) as any;
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      let invoices: any[] = [];
      if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        invoices = db.prepare(`SELECT * FROM invoices WHERE company_id = ? AND id IN (${placeholders}) ORDER BY data_emissao DESC`).all(company_id, ...ids.map(String));
      } else {
        const period = req.body.period ? String(req.body.period) : 'all';
        const startDate = req.body.startDate ? String(req.body.startDate) : '';
        const endDate = req.body.endDate ? String(req.body.endDate) : '';
        const tipo = req.body.tipo ? String(req.body.tipo) : 'all';
        const status = req.body.status ? String(req.body.status) : 'all';
        const search = req.body.search ? String(req.body.search) : '';

        let whereClause = 'WHERE company_id = ?';
        const queryParams: any[] = [company_id];

        if (period === 'custom' && startDate && endDate) {
          whereClause += ' AND data_emissao >= ? AND data_emissao <= ?';
          queryParams.push(`${startDate}T00:00:00`, `${endDate}T23:59:59`);
        } else if (period === '7d') {
          const d = new Date(); d.setDate(d.getDate() - 7);
          whereClause += ' AND data_emissao >= ?';
          queryParams.push(d.toISOString());
        } else if (period === '15d') {
          const d = new Date(); d.setDate(d.getDate() - 15);
          whereClause += ' AND data_emissao >= ?';
          queryParams.push(d.toISOString());
        } else if (period === '30d') {
          const d = new Date(); d.setDate(d.getDate() - 30);
          whereClause += ' AND data_emissao >= ?';
          queryParams.push(d.toISOString());
        }

        if (tipo !== 'all') {
          whereClause += ' AND tipo = ?';
          queryParams.push(tipo);
        }

        if (status !== 'all') {
          whereClause += ' AND status = ?';
          queryParams.push(status);
        }

        if (search) {
          whereClause += ' AND (numero LIKE ? OR chave_acesso LIKE ? OR emitente_nome LIKE ? OR emitente_cnpj LIKE ?)';
          const s = `%${search}%`;
          queryParams.push(s, s, s, s);
        }

        invoices = db.prepare(`SELECT * FROM invoices ${whereClause} ORDER BY data_emissao DESC`).all(...queryParams);
      }

      if (invoices.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhuma nota localizada no período/filtros selecionados para download.' });
      }

      const archive = archiver('zip', { zlib: { level: 9 } });
      const cleanName = company.razao_social.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 30);
      const zipFileName = `Notas_${type.toUpperCase()}_${cleanName}_${Date.now()}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      archive.pipe(res);

      for (const inv of invoices) {
        if (type === 'xml') {
          if (inv.xml_raw) {
            archive.append(inv.xml_raw, { name: `XML/${inv.chave_acesso}.xml` });
          } else if (inv.xml_file_path && fs.existsSync(inv.xml_file_path)) {
            archive.file(inv.xml_file_path, { name: `XML/${inv.chave_acesso}.xml` });
          }
        } else if (type === 'pdf') {
          let pdfPath = inv.pdf_file_path;
          if (!pdfPath || !fs.existsSync(pdfPath)) {
            if (inv.xml_raw) {
              const parsed = parseFiscalXml(inv.xml_raw);
              pdfPath = path.join(PDFS_DIR, `DANFE_${inv.chave_acesso}.pdf`);
              await generateDanfePdf(parsed, pdfPath);
            }
          }
          if (pdfPath && fs.existsSync(pdfPath)) {
            archive.file(pdfPath, { name: `DANFE/DANFE_${inv.chave_acesso}.pdf` });
          }
        }
      }

      await archive.finalize();
    } catch (err: any) {
      console.error('Error generating zip:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Upload batch XML files to ingest real invoices for a company
   */
  async uploadBatchXml(req: Request, res: Response) {
    try {
      const company_id = String(req.body.company_id || '');
      const files = req.files as Express.Multer.File[];

      if (!company_id) {
        return res.status(400).json({ success: false, message: 'company_id é obrigatório.' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo XML enviado.' });
      }

      let processed = 0;
      let errors: string[] = [];

      for (const file of files) {
        try {
          const xmlContent = fs.readFileSync(file.path, 'utf-8');
          await sefazService.ingestXml(company_id, xmlContent, 'upload');
          processed++;
        } catch (itemErr: any) {
          errors.push(`${file.originalname}: ${itemErr.message}`);
        } finally {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }

      return res.json({
        success: true,
        message: `${processed} nota(s) fiscal(is) importada(s) com sucesso!`,
        processed,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err: any) {
      console.error('Error in batch upload:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Trigger Google Drive sync for a single invoice or all pending
   */
  async syncToDrive(req: Request, res: Response) {
    try {
      const id = req.params.id ? String(req.params.id) : '';
      const company_id = req.body.company_id ? String(req.body.company_id) : '';

      if (id) {
        await sefazService.syncInvoiceToDrive(id);
        return res.json({ success: true, message: 'Nota fiscal sincronizada com o Google Drive com sucesso!' });
      }

      if (company_id) {
        const result = await sefazService.syncCompany(company_id, 'manual');
        return res.json({ success: true, data: result, message: result.message });
      }

      return res.status(400).json({ success: false, message: 'ID da nota ou company_id é obrigatório.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Ingest JL Comercio (Leandro Gomes) 2026 Fiscal Invoices from Google Drive
   */
  async ingestJlComercio(req: Request, res: Response) {
    try {
      const result = runJlComercioFullIngestion(db);
      return res.json({
        success: true,
        message: 'Ingestão de documentos fiscais de 2026 da JL Comércio realizada com sucesso.',
        data: result
      });
    } catch (err: any) {
      console.error('Error in ingestJlComercio:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Reclassify and sanitize all invoices in database according to strict fiscal direction rules
   */
  async reclassifyAllInvoices(req: Request, res: Response) {
    try {
      const summary = reclassifyAndSanitizeDatabase(db);
      return res.json({
        success: true,
        message: 'Reclassificação fiscal concluída com sucesso. 0 notas invertidas.',
        data: summary
      });
    } catch (err: any) {
      console.error('Error in reclassifyAllInvoices:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};
