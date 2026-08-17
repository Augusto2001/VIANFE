import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db, XMLS_DIR, PDFS_DIR } from '../database/db.js';
import { parseFiscalXml, ParsedFiscalInvoice } from './xmlParser.js';
import { generateDanfePdf } from './danfeGenerator.js';
import { googleDriveService } from './googleDriveService.js';
import { cleanNumeric } from '../utils/crypto.js';

export class SefazService {
  /**
   * Ingest an XML file for a specific company
   */
  public async ingestXml(
    companyId: string,
    xmlString: string,
    source: 'upload' | 'sefaz_dfe' = 'upload'
  ): Promise<{ invoiceId: string; chaveAcesso: string; action: 'created' | 'updated' }> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa cliente não encontrada (ID: ${companyId}).`);
    }

    // Parse the fiscal XML
    const parsed = parseFiscalXml(xmlString);
    const companyCnpjClean = cleanNumeric(company.cnpj);
    const emitenteCnpjClean = cleanNumeric(parsed.emitente.cnpjCpf);
    const destinatarioCnpjClean = cleanNumeric(parsed.destinatario.cnpjCpf);

    // Determine type: 'saida' (emitted by client) vs 'entrada' (received by client)
    let tipo: 'entrada' | 'saida' = 'entrada';
    if (companyCnpjClean === emitenteCnpjClean) {
      tipo = 'saida';
    } else if (companyCnpjClean === destinatarioCnpjClean) {
      tipo = 'entrada';
    } else {
      // Default to what the XML says or Entrada
      tipo = parsed.tipoOperacao === '1' ? 'saida' : 'entrada';
    }

    // Save XML file to storage
    const xmlFileName = `${parsed.chaveAcesso}.xml`;
    const xmlFilePath = path.join(XMLS_DIR, xmlFileName);
    fs.writeFileSync(xmlFilePath, xmlString, 'utf-8');

    // Generate DANFE PDF
    const pdfFileName = `DANFE_${parsed.chaveAcesso}.pdf`;
    const pdfFilePath = path.join(PDFS_DIR, pdfFileName);
    try {
      await generateDanfePdf(parsed, pdfFilePath);
    } catch (pdfErr: any) {
      console.warn(`Could not pre-generate DANFE for ${parsed.chaveAcesso}:`, pdfErr.message);
    }

    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM invoices WHERE chave_acesso = ?').get(parsed.chaveAcesso) as any;

    if (existing) {
      db.prepare(`
        UPDATE invoices SET
          company_id = ?,
          numero = ?,
          serie = ?,
          modelo = ?,
          tipo = ?,
          status = ?,
          natureza_operacao = ?,
          data_emissao = ?,
          data_saida_entrada = ?,
          emitente_cnpj = ?,
          emitente_nome = ?,
          emitente_uf = ?,
          destinatario_cnpj = ?,
          destinatario_nome = ?,
          destinatario_uf = ?,
          valor_total = ?,
          valor_produtos = ?,
          valor_icms = ?,
          valor_pis = ?,
          valor_cofins = ?,
          valor_ipi = ?,
          itens_json = ?,
          xml_raw = ?,
          xml_file_path = ?,
          pdf_file_path = ?
        WHERE id = ?
      `).run(
        companyId,
        parsed.numero,
        parsed.serie,
        parsed.modelo,
        tipo,
        parsed.status,
        parsed.naturezaOperacao,
        parsed.dataEmissao,
        parsed.dataSaidaEntrada || null,
        parsed.emitente.cnpjCpf,
        parsed.emitente.razaoSocial,
        parsed.emitente.uf,
        parsed.destinatario.cnpjCpf,
        parsed.destinatario.razaoSocial,
        parsed.destinatario.uf,
        parsed.totais.valorTotal,
        parsed.totais.valorProdutos,
        parsed.totais.valorIcms,
        parsed.totais.valorPis,
        parsed.totais.valorCofins,
        parsed.totais.valorIpi,
        JSON.stringify(parsed.itens),
        xmlString,
        xmlFilePath,
        pdfFilePath,
        existing.id
      );

      return { invoiceId: existing.id, chaveAcesso: parsed.chaveAcesso, action: 'updated' };
    }

    const newId = uuidv4();
    db.prepare(`
      INSERT INTO invoices (
        id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
        natureza_operacao, data_emissao, data_saida_entrada,
        emitente_cnpj, emitente_nome, emitente_uf,
        destinatario_cnpj, destinatario_nome, destinatario_uf,
        valor_total, valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
        itens_json, xml_raw, xml_file_path, pdf_file_path,
        gdrive_synced, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        0, ?
      )
    `).run(
      newId,
      companyId,
      parsed.chaveAcesso,
      parsed.numero,
      parsed.serie,
      parsed.modelo,
      tipo,
      parsed.status,
      parsed.naturezaOperacao,
      parsed.dataEmissao,
      parsed.dataSaidaEntrada || null,
      parsed.emitente.cnpjCpf,
      parsed.emitente.razaoSocial,
      parsed.emitente.uf,
      parsed.destinatario.cnpjCpf,
      parsed.destinatario.razaoSocial,
      parsed.destinatario.uf,
      parsed.totais.valorTotal,
      parsed.totais.valorProdutos,
      parsed.totais.valorIcms,
      parsed.totais.valorPis,
      parsed.totais.valorCofins,
      parsed.totais.valorIpi,
      JSON.stringify(parsed.itens),
      xmlString,
      xmlFilePath,
      pdfFilePath,
      now
    );

    return { invoiceId: newId, chaveAcesso: parsed.chaveAcesso, action: 'created' };
  }

  /**
   * Synchronize single invoice or pending invoices to Google Drive
   */
  public async syncInvoiceToDrive(invoiceId: string): Promise<boolean> {
    const invoice = db.prepare(`
      SELECT i.*, c.razao_social as company_name, g.folder_id as drive_folder_id, g.is_active as gdrive_active
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      LEFT JOIN gdrive_configs g ON c.id = g.company_id
      WHERE i.id = ?
    `).get(invoiceId) as any;

    if (!invoice) {
      throw new Error(`Nota Fiscal não encontrada (ID: ${invoiceId}).`);
    }

    const baseFolderId = invoice.drive_folder_id || 'root';
    const emissionDate = new Date(invoice.data_emissao || Date.now());
    const year = String(emissionDate.getFullYear());
    const month = String(emissionDate.getMonth() + 1).padStart(2, '0');

    try {
      // 1. Upload XML
      if (invoice.xml_file_path && fs.existsSync(invoice.xml_file_path)) {
        const xmlFolderId = await googleDriveService.ensureCompanyFolderStructure(
          baseFolderId,
          invoice.company_name,
          year,
          month,
          'XMLs'
        );

        await googleDriveService.uploadFile(
          invoice.xml_file_path,
          `${invoice.chave_acesso}.xml`,
          xmlFolderId,
          'application/xml'
        );
      }

      // 2. Upload PDF
      if (invoice.pdf_file_path && fs.existsSync(invoice.pdf_file_path)) {
        const pdfFolderId = await googleDriveService.ensureCompanyFolderStructure(
          baseFolderId,
          invoice.company_name,
          year,
          month,
          'PDFs'
        );

        const uploadRes = await googleDriveService.uploadFile(
          invoice.pdf_file_path,
          `DANFE_${invoice.chave_acesso}.pdf`,
          pdfFolderId,
          'application/pdf'
        );

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE invoices SET
            gdrive_synced = 1,
            gdrive_file_id = ?,
            gdrive_synced_at = ?
          WHERE id = ?
        `).run(uploadRes.fileId, now, invoice.id);
      }

      return true;
    } catch (err: any) {
      console.error(`Erro ao sincronizar nota ${invoice.chave_acesso} no Google Drive:`, err.message);
      throw err;
    }
  }

  /**
   * Run full sync for a specific company (SEFAZ query + Google Drive upload)
   */
  public async syncCompany(
    companyId: string,
    triggerType: 'manual' | 'agendado' = 'manual'
  ): Promise<{ found: number; downloaded: number; uploadedToDrive: number; message: string }> {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
    if (!company) {
      throw new Error(`Empresa não encontrada: ${companyId}`);
    }

    const logId = uuidv4();
    const startTime = new Date().toISOString();

    db.prepare(`
      INSERT INTO sync_logs (id, company_id, trigger_type, service_type, status, invoices_found, invoices_downloaded, gdrive_uploaded, message, executed_at)
      VALUES (?, ?, ?, 'geral', 'processando', 0, 0, 0, 'Iniciando sincronização...', ?)
    `).run(logId, companyId, triggerType, startTime);

    let downloadedCount = 0;
    let uploadedCount = 0;

    try {
      // Find pending invoices for this company that need Drive sync
      const pendingInvoices = db.prepare(`
        SELECT id FROM invoices 
        WHERE company_id = ? AND gdrive_synced = 0
      `).all(companyId) as any[];

      for (const inv of pendingInvoices) {
        try {
          await this.syncInvoiceToDrive(inv.id);
          uploadedCount++;
        } catch (uploadErr) {
          console.warn(`Failed to sync invoice ${inv.id} to Drive:`, uploadErr);
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE companies SET last_sync_at = ? WHERE id = ?
      `).run(now, companyId);

      const msg = `Sincronização concluída com sucesso. ${uploadedCount} documento(s) enviados para o Google Drive.`;

      db.prepare(`
        UPDATE sync_logs SET
          status = 'sucesso',
          invoices_found = ?,
          invoices_downloaded = ?,
          gdrive_uploaded = ?,
          message = ?
        WHERE id = ?
      `).run(pendingInvoices.length, downloadedCount, uploadedCount, msg, logId);

      // Update Drive Config timestamp
      db.prepare(`
        UPDATE gdrive_configs SET
          last_sync_at = ?,
          last_sync_status = 'success',
          last_sync_message = ?
        WHERE company_id = ?
      `).run(now, msg, companyId);

      return {
        found: pendingInvoices.length,
        downloaded: downloadedCount,
        uploadedToDrive: uploadedCount,
        message: msg,
      };
    } catch (err: any) {
      const errorMsg = `Erro na sincronização: ${err.message}`;
      db.prepare(`
        UPDATE sync_logs SET
          status = 'erro',
          message = ?
        WHERE id = ?
      `).run(errorMsg, logId);

      db.prepare(`
        UPDATE gdrive_configs SET
          last_sync_status = 'error',
          last_sync_message = ?
        WHERE company_id = ?
      `).run(errorMsg, companyId);

      throw err;
    }
  }
}

export const sefazService = new SefazService();
