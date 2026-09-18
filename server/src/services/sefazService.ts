import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db, XMLS_DIR, PDFS_DIR, STORAGE_DIR } from '../database/db.js';
import { parseFiscalXml, ParsedFiscalInvoice } from './xmlParser.js';
import { generateDanfePdf } from './danfeGenerator.js';
import { googleDriveService } from './googleDriveService.js';
import { sefazDfeClient } from './sefazDfeClient.js';
import { cleanNumeric } from '../utils/crypto.js';
import { getInvoiceStoragePaths } from '../utils/driveFolderMatcher.js';
import { classifyFiscalDirection, isSameCompany } from '../utils/fiscalClassifier.js';

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
    let actualCompany = company;
    let actualCompanyId = companyId;

    // Apenas se a empresa ativa NÃO for parte na nota (nem emitente nem destinatária),
    // verifica se outra empresa cadastrada é o emitente ou destinatário legítimo (ex: upload em empresa incorreta)
    const isCurrentCompanyParty = isSameCompany(emitenteCnpjClean, companyCnpjClean) ||
                                  isSameCompany(destinatarioCnpjClean, companyCnpjClean);

    if (!isCurrentCompanyParty) {
      const allCompanies = db.prepare('SELECT id, cnpj, razao_social, uf FROM companies').all() as any[];
      if (emitenteCnpjClean) {
        const foundEmit = allCompanies.find(c => isSameCompany(c.cnpj, emitenteCnpjClean));
        if (foundEmit) {
          actualCompany = foundEmit;
          actualCompanyId = foundEmit.id;
        }
      }
      if (actualCompanyId === companyId && destinatarioCnpjClean) {
        const foundDest = allCompanies.find(c => isSameCompany(c.cnpj, destinatarioCnpjClean));
        if (foundDest) {
          actualCompany = foundDest;
          actualCompanyId = foundDest.id;
        }
      }
    }

    const actualCompanyCnpjClean = cleanNumeric(actualCompany.cnpj);

    // Fill destinatario only for resNFe / resCTe summaries queried by SEFAZ DFe for an incoming invoice
    if (!parsed.destinatario.cnpjCpf || parsed.destinatario.cnpjCpf === '') {
      if (source === 'sefaz_dfe' && emitenteCnpjClean !== actualCompanyCnpjClean) {
        parsed.destinatario.cnpjCpf = actualCompany.cnpj;
        parsed.destinatario.razaoSocial = actualCompany.razao_social;
        parsed.destinatario.uf = actualCompany.uf;
      } else {
        parsed.destinatario.cnpjCpf = '';
        if (!parsed.destinatario.razaoSocial || parsed.destinatario.razaoSocial.trim() === '') {
          parsed.destinatario.razaoSocial = 'Consumidor Final - Venda Balcão';
        }
      }
    }

    // Deterministic fiscal direction classification:
    // - tpNF === '0' -> tipo = 'entrada' (emissão própria de entrada para devolução/remessa)
    // - emitente === company.cnpj & tpNF === '1' -> tipo = 'saida' (Venda / Faturamento)
    // - destinatario === company.cnpj & tpNF === '1' -> tipo = 'entrada' (Compra / Fornecedor)
    // - Eliminates any logic classifying notes emitted by the company as 'entrada'
    const classification = classifyFiscalDirection(
      actualCompany.cnpj,
      parsed.emitente.cnpjCpf,
      parsed.destinatario.cnpjCpf,
      parsed.tipoOperacao,
      parsed.modelo,
      parsed.destinatario.razaoSocial
    );

    const tipo = classification.tipo;
    parsed.destinatario.cnpjCpf = classification.destinatarioCnpj;
    parsed.destinatario.razaoSocial = classification.destinatarioNome;

    // Build file paths targeting G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS or local fallback
    const { xmlFilePath, pdfFilePath } = getInvoiceStoragePaths(
      actualCompany.razao_social,
      parsed.dataEmissao,
      parsed.chaveAcesso,
      STORAGE_DIR,
      actualCompany.cnpj,
      tipo
    );

    // Save XML file
    fs.writeFileSync(xmlFilePath, xmlString, 'utf-8');

    // Generate DANFE PDF
    try {
      await generateDanfePdf(parsed, pdfFilePath);
    } catch (pdfErr: any) {
      console.warn(`Could not pre-generate DANFE for ${parsed.chaveAcesso}:`, pdfErr.message);
    }

    const now = new Date().toISOString();
    const existing = db.prepare('SELECT id FROM invoices WHERE chave_acesso = ?').get(parsed.chaveAcesso) as any;

    const faturaJson = parsed.fatura ? JSON.stringify(parsed.fatura) : null;
    const duplicatasJson = parsed.duplicatas && parsed.duplicatas.length > 0 ? JSON.stringify(parsed.duplicatas) : null;
    const pagamentosJson = parsed.pagamentos && parsed.pagamentos.length > 0 ? JSON.stringify(parsed.pagamentos) : null;
    const transporteJson = parsed.transporte ? JSON.stringify(parsed.transporte) : null;
    const infoAdicional = parsed.informacoesComplementares || null;

    let targetInvoiceId = '';
    let action: 'created' | 'updated' = 'created';

    if (existing) {
      targetInvoiceId = existing.id;
      action = 'updated';
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
          fatura_json = ?,
          duplicatas_json = ?,
          pagamentos_json = ?,
          transporte_json = ?,
          info_adicional = ?,
          xml_raw = ?,
          xml_file_path = ?,
          pdf_file_path = ?
        WHERE id = ?
      `).run(
        actualCompanyId,
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
        faturaJson,
        duplicatasJson,
        pagamentosJson,
        transporteJson,
        infoAdicional,
        xmlString,
        xmlFilePath,
        pdfFilePath,
        existing.id
      );
    } else {
      targetInvoiceId = uuidv4();
      action = 'created';
      db.prepare(`
        INSERT INTO invoices (
          id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
          natureza_operacao, data_emissao, data_saida_entrada,
          emitente_cnpj, emitente_nome, emitente_uf,
          destinatario_cnpj, destinatario_nome, destinatario_uf,
          valor_total, valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
          itens_json, fatura_json, duplicatas_json, pagamentos_json, transporte_json, info_adicional,
          xml_raw, xml_file_path, pdf_file_path,
          gdrive_synced, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          0, ?
        )
      `).run(
        targetInvoiceId,
        actualCompanyId,
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
        faturaJson,
        duplicatasJson,
        pagamentosJson,
        transporteJson,
        infoAdicional,
        xmlString,
        xmlFilePath,
        pdfFilePath,
        now
      );
    }

    // =========================================================================
    // MÓDULO FINANCEIRO: Sincronizar Duplicatas & Parcelas (Contas a Pagar / Receber)
    // =========================================================================
    try {
      db.prepare('DELETE FROM invoice_installments WHERE invoice_id = ?').run(targetInvoiceId);

      const installmentTipo = tipo === 'entrada' ? 'pagar' : 'receber';
      const partyNome = tipo === 'entrada' ? parsed.emitente.razaoSocial : parsed.destinatario.razaoSocial;
      const partyCnpj = tipo === 'entrada' ? parsed.emitente.cnpjCpf : parsed.destinatario.cnpjCpf;
      const defaultForma = parsed.pagamentos?.[0]?.forma || 'Boleto / Duplicata';

      if (parsed.duplicatas && parsed.duplicatas.length > 0) {
        const insStmt = db.prepare(`
          INSERT INTO invoice_installments (
            id, invoice_id, company_id, tipo, numero_fatura, numero_parcela,
            data_vencimento, valor, status, forma_pagamento, fornecedor_cliente_nome,
            fornecedor_cliente_cnpj, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?)
        `);

        for (const dup of parsed.duplicatas) {
          insStmt.run(
            uuidv4(),
            targetInvoiceId,
            actualCompanyId,
            installmentTipo,
            parsed.fatura?.numero || parsed.numero,
            dup.numero,
            dup.vencimento || parsed.dataEmissao,
            dup.valor,
            defaultForma,
            partyNome,
            partyCnpj,
            now
          );
        }
      } else if (parsed.totais.valorTotal > 0) {
        db.prepare(`
          INSERT INTO invoice_installments (
            id, invoice_id, company_id, tipo, numero_fatura, numero_parcela,
            data_vencimento, valor, status, forma_pagamento, fornecedor_cliente_nome,
            fornecedor_cliente_cnpj, created_at
          ) VALUES (?, ?, ?, ?, ?, '001', ?, ?, 'pendente', ?, ?, ?, ?)
        `).run(
          uuidv4(),
          targetInvoiceId,
          actualCompanyId,
          installmentTipo,
          parsed.fatura?.numero || parsed.numero,
          parsed.dataSaidaEntrada || parsed.dataEmissao,
          parsed.totais.valorTotal,
          defaultForma,
          partyNome,
          partyCnpj,
          now
        );
      }
    } catch (finErr: any) {
      console.warn(`Aviso ao alimentar módulo financeiro para nota ${parsed.numero}:`, finErr.message);
    }

    return { invoiceId: targetInvoiceId, chaveAcesso: parsed.chaveAcesso, action };
  }

  /**
   * Synchronize single invoice to Google Drive
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
   * Helper: Verifica se está dentro da janela autorizada SEFAZ (01:00 às 03:00 - Horário de Brasília)
   */
  public isWithinSefazWindow(): boolean {
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const localDate = new Date(nowStr);
    const hour = localDate.getHours();
    return hour >= 1 && hour < 3;
  }

  /**
   * Registra log de auditoria SEFAZ no SQLite e no arquivo de log do ERP
   */
  public logSefazAudit(audit: {
    companyId: string;
    cnpj: string;
    razaoSocial: string;
    nsuInicial?: string;
    nsuFinal?: string;
    maxNsu?: string;
    notasLocalizadas: number;
    notasBaixadas: number;
    cstat?: string;
    xmotivo?: string;
    triggerType: 'agendado' | 'manual';
    duracaoMs: number;
    iniciadoEm: string;
    finalizadoEm: string;
    status: 'sucesso' | 'bloqueado_carência' | 'fora_da_janela' | 'erro';
    detalhes?: any;
  }) {
    try {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO sefaz_audit_logs (
          id, company_id, cnpj, razao_social, nsu_inicial, nsu_final, max_nsu,
          notas_localizadas, notas_baixadas, cstat, xmotivo, trigger_type,
          duracao_ms, iniciado_em, finalizado_em, status, detalhes_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        audit.companyId,
        audit.cnpj,
        audit.razaoSocial,
        audit.nsuInicial || '0',
        audit.nsuFinal || '0',
        audit.maxNsu || '0',
        audit.notasLocalizadas,
        audit.notasBaixadas,
        audit.cstat || null,
        audit.xmotivo || null,
        audit.triggerType,
        audit.duracaoMs,
        audit.iniciadoEm,
        audit.finalizadoEm,
        audit.status,
        audit.detalhes ? JSON.stringify(audit.detalhes) : null
      );

      // Escreve linha de auditoria no arquivo de logs estruturado C:\VIANFE_ERP_BPO\logs\sefaz_audit.log
      const logDirs = ['C:\\VIANFE_ERP_BPO\\logs', path.resolve(process.cwd(), 'logs')];
      const line = `[${audit.iniciadoEm}] [${audit.triggerType.toUpperCase()}] CNPJ: ${audit.cnpj} | ${audit.razaoSocial} | NSU: ${audit.nsuInicial || '0'}->${audit.nsuFinal || '0'} (max: ${audit.maxNsu || '0'}) | Localizadas: ${audit.notasLocalizadas} | Baixadas: ${audit.notasBaixadas} | cStat: ${audit.cstat || 'N/A'} | Motivo: "${audit.xmotivo || ''}" | Status: ${audit.status} | Tempo: ${audit.duracaoMs}ms\n`;

      for (const dir of logDirs) {
        try {
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.appendFileSync(path.join(dir, 'sefaz_audit.log'), line, 'utf-8');
        } catch {}
      }
    } catch (e: any) {
      console.warn('[SEFAZ Audit] Falha ao registrar log de auditoria:', e.message);
    }
  }

  /**
   * Run full sync for a specific company (Consults SEFAZ if Certificado A1 is available + Google Drive upload)
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
    const startTimeDate = new Date();
    const startTime = startTimeDate.toISOString();
    const nsuInicial = company.last_nsu || '0';

    // 1. Verificação de Janela Noturna (01:00 às 03:00) para chamadas automáticas agendadas
    if (triggerType === 'agendado' && !this.isWithinSefazWindow()) {
      const msg = `[SEFAZ] Consulta automática suspensa fora da janela noturna (01:00 às 03:00 - Horário de Brasília). CNPJ: ${company.cnpj}`;
      console.log(`🌙 ${msg}`);

      this.logSefazAudit({
        companyId,
        cnpj: company.cnpj,
        razaoSocial: company.razao_social,
        nsuInicial,
        nsuFinal: nsuInicial,
        notasLocalizadas: 0,
        notasBaixadas: 0,
        triggerType,
        duracaoMs: 0,
        iniciadoEm: startTime,
        finalizadoEm: new Date().toISOString(),
        status: 'fora_da_janela',
        xmotivo: 'Execução automática permitida apenas entre 01:00 e 03:00',
      });

      return { found: 0, downloaded: 0, uploadedToDrive: 0, message: msg };
    }

    // 2. Verificação de Bloqueio por Carência SEFAZ (evitar cStat 656)
    if (company.sefaz_locked_until) {
      const lockDate = new Date(company.sefaz_locked_until);
      const now = new Date();
      if (lockDate > now) {
        const remainMinutes = Math.ceil((lockDate.getTime() - now.getTime()) / 60000);
        const msg = `Empresa em período de carência da SEFAZ até ${company.sefaz_locked_until} (${remainMinutes} min restantes). Consulta prevenida para evitar Rejeição 656.`;
        console.log(`⏳ [SEFAZ] ${company.razao_social}: ${msg}`);

        this.logSefazAudit({
          companyId,
          cnpj: company.cnpj,
          razaoSocial: company.razao_social,
          nsuInicial,
          nsuFinal: nsuInicial,
          notasLocalizadas: 0,
          notasBaixadas: 0,
          cstat: company.sefaz_last_cstat,
          xmotivo: company.sefaz_last_xmotivo,
          triggerType,
          duracaoMs: 0,
          iniciadoEm: startTime,
          finalizadoEm: new Date().toISOString(),
          status: 'bloqueado_carência',
        });

        return { found: 0, downloaded: 0, uploadedToDrive: 0, message: msg };
      }
    }

    db.prepare(`
      INSERT INTO sync_logs (id, company_id, trigger_type, service_type, status, invoices_found, invoices_downloaded, gdrive_uploaded, message, executed_at)
      VALUES (?, ?, ?, 'geral', 'processando', 0, 0, 0, 'Consultando SEFAZ e sincronizando Drive...', ?)
    `).run(logId, companyId, triggerType, startTime);

    let downloadedCount = 0;
    let uploadedCount = 0;
    let sefazNotesFound = 0;
    let sefazMotivo = '';
    let lastCstat = '';
    let nsuFinal = nsuInicial;
    let maxNsuRetornado = '0';

    try {
      // 3. Se possuir certificado A1, consultar SEFAZ DFe em loop sequencial seguro
      if (company.cert_filename) {
        let hasMore = true;
        let loopCount = 0;
        const maxLoops = 30; // Limite de segurança por ciclo

        while (hasMore && loopCount < maxLoops) {
          loopCount++;
          try {
            console.log(`[SEFAZ Loop #${loopCount}] Consultando próximo lote para ${company.razao_social}...`);
            const sefazResult = await sefazDfeClient.queryDistributionDfe(companyId);
            sefazMotivo = sefazResult.xMotivo;
            lastCstat = sefazResult.cStat;
            nsuFinal = sefazResult.ultNSU || nsuFinal;
            maxNsuRetornado = sefazResult.maxNSU || '0';
            sefazNotesFound += sefazResult.documents.length;

            for (const doc of sefazResult.documents) {
              if (!doc.xmlContent) continue;
              const hasNfe = doc.xmlContent.includes('<infNFe') || doc.xmlContent.includes('<infNFe>');
              const hasCte = doc.xmlContent.includes('<infCte') || doc.xmlContent.includes('<infCte>');
              const isResumo = doc.xmlContent.includes('<resNFe') || doc.xmlContent.includes('<resCTe') || doc.isSummary;

              if (!hasNfe && !hasCte && !isResumo) {
                console.log(`[SEFAZ] Documento NSU=${doc.nsu} schema=${doc.schema} ignorado (não é NF-e/CT-e ou resumo)`);
                continue;
              }
              try {
                await this.ingestXml(companyId, doc.xmlContent, 'sefaz_dfe');
                downloadedCount++;
              } catch (xmlErr: any) {
                console.warn(`Erro ao processar XML da SEFAZ (NSU ${doc.nsu}):`, xmlErr.message);
              }
            }

            const ult = BigInt(sefazResult.ultNSU || '0');
            const max = BigInt(sefazResult.maxNSU || '0');

            // Caso cStat 656 (Consumo Indevido): Aplicar trava de 65 minutos
            if (sefazResult.cStat === '656') {
              hasMore = false;
              const lockUntil = new Date(Date.now() + 65 * 60 * 1000).toISOString();
              db.prepare(`
                UPDATE companies SET sefaz_locked_until = ?, sefaz_last_cstat = '656', sefaz_last_xmotivo = ? WHERE id = ?
              `).run(lockUntil, sefazResult.xMotivo, companyId);
              sefazMotivo = 'SEFAZ: Consumo Indevido (cStat 656). Carência de 65 minutos ativada.';
              console.log(`🚫 [SEFAZ] Consumo Indevido detectado para ${company.razao_social}. Bloqueando até ${lockUntil}`);
              break;
            }

            // Caso cStat 137 (Nenhum documento localizado): Aplicar trava de 60 minutos
            if (sefazResult.cStat === '137') {
              hasMore = false;
              const lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
              db.prepare(`
                UPDATE companies SET sefaz_locked_until = ?, sefaz_last_cstat = '137', sefaz_last_xmotivo = ? WHERE id = ?
              `).run(lockUntil, sefazResult.xMotivo, companyId);
              console.log(`✓ [SEFAZ] Lote em dia para ${company.razao_social} (cStat 137). Carência de 60 minutos ativada.`);
              break;
            }

            // Caso sucesso com documentos (138)
            if (sefazResult.cStat === '138') {
              if (ult >= max || sefazResult.documents.length === 0) {
                hasMore = false;
                const lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                db.prepare(`
                  UPDATE companies SET sefaz_locked_until = ?, sefaz_last_cstat = '138', sefaz_last_xmotivo = ? WHERE id = ?
                `).run(lockUntil, sefazResult.xMotivo, companyId);
                console.log(`🏁 [SEFAZ] Todos os lotes baixados até o maxNSU (${sefazResult.maxNSU}) para ${company.razao_social}.`);
              } else {
                // Intervalo de segurança anti-rajada entre lotes
                await new Promise(r => setTimeout(r, 3500));
              }
            }
          } catch (sefazErr: any) {
            console.warn(`Aviso na consulta SEFAZ para ${company.razao_social}:`, sefazErr.message);
            sefazMotivo = sefazErr.message;
            hasMore = false;
          }
        }
      }

      // 4. Upload de notas pendentes no Google Drive
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

      const finishTime = new Date().toISOString();
      const duracaoMs = Date.now() - startTimeDate.getTime();

      db.prepare(`
        UPDATE companies SET last_sync_at = ? WHERE id = ?
      `).run(finishTime, companyId);

      const msg = company.cert_filename
        ? `SEFAZ: ${sefazMotivo || 'Consulta realizada'} (${downloadedCount} notas baixadas). Drive: ${uploadedCount} arquivo(s) enviados.`
        : `Sincronização concluída. ${uploadedCount} documento(s) enviados para o Google Drive.`;

      db.prepare(`
        UPDATE sync_logs SET
          status = 'sucesso',
          invoices_found = ?,
          invoices_downloaded = ?,
          gdrive_uploaded = ?,
          message = ?
        WHERE id = ?
      `).run(sefazNotesFound, downloadedCount, uploadedCount, msg, logId);

      // Grava Log de Auditoria Detalhado
      this.logSefazAudit({
        companyId,
        cnpj: company.cnpj,
        razaoSocial: company.razao_social,
        nsuInicial,
        nsuFinal,
        maxNsu: maxNsuRetornado,
        notasLocalizadas: sefazNotesFound,
        notasBaixadas: downloadedCount,
        cstat: lastCstat,
        xmotivo: sefazMotivo,
        triggerType,
        duracaoMs,
        iniciadoEm: startTime,
        finalizadoEm: finishTime,
        status: lastCstat === '656' ? 'erro' : 'sucesso',
      });

      return {
        found: sefazNotesFound || pendingInvoices.length,
        downloaded: downloadedCount,
        uploadedToDrive: uploadedCount,
        message: msg,
      };
    } catch (err: any) {
      const errorMsg = `Erro na sincronização: ${err.message}`;
      const finishTime = new Date().toISOString();
      const duracaoMs = Date.now() - startTimeDate.getTime();

      db.prepare(`
        UPDATE sync_logs SET status = 'erro', message = ? WHERE id = ?
      `).run(errorMsg, logId);

      this.logSefazAudit({
        companyId,
        cnpj: company.cnpj,
        razaoSocial: company.razao_social,
        nsuInicial,
        nsuFinal,
        notasLocalizadas: 0,
        notasBaixadas: 0,
        cstat: 'ERR',
        xmotivo: err.message,
        triggerType,
        duracaoMs,
        iniciadoEm: startTime,
        finalizadoEm: finishTime,
        status: 'erro',
      });

      throw err;
    }
  }
}

export const sefazService = new SefazService();
