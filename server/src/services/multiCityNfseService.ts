import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, CERTS_DIR, STORAGE_DIR } from '../database/db.js';
import { parseFiscalXml, ParsedFiscalInvoice } from './xmlParser.js';
import { splitMunicipalXml, originalNfsePdf } from './nfse/originalDocuments.js';
import { salvadorNfseMonthlyService } from './salvadorNfseMonthlyService.js';
import { cleanNumeric } from '../utils/crypto.js';
import { classifyFiscalDirection } from '../utils/fiscalClassifier.js';
import { syncXmlInstallments } from './invoiceInstallments.js';
import { getInvoiceStoragePaths } from '../utils/driveFolderMatcher.js';

export interface NfseIngestionResult {
  success: boolean;
  chaveAcesso?: string;
  numero?: string;
  valorTotal?: number;
  tipo?: 'entrada' | 'saida';
  companyId?: string;
  error?: string;
}

export interface MultiCitySyncReport {
  timestamp: string;
  scannedFiles: number;
  newNfse: number;
  updatedNfse: number;
  errors: number;
  totalValorSaidas: number;
  totalValorEntradas: number;
  companiesProcessed: Array<{
    razaoSocial: string;
    cnpj: string;
    prefeitura: string;
    novasNotas: number;
    valorTotal: number;
  }>;
}

export class MultiCityNfseService {
  /**
   * Ingestão atômica de um XML de NFS-e (individual ou fragmento de lote)
   */
  public async ingestSingleNfseXml(rawXml: string, originCompanyId?: string): Promise<NfseIngestionResult> {
    try {
      if (!rawXml.includes('CompNfse') && !rawXml.includes('InfNfse') && !rawXml.includes('infNFSe') && !rawXml.includes('Nfse')) {
        return { success: false, error: 'Documento não é uma NFS-e válida.' };
      }

      let parsed: ParsedFiscalInvoice;
      try {
        parsed = parseFiscalXml(rawXml);
      } catch (err: any) {
        return { success: false, error: `Falha ao interpretar XML da NFS-e: ${err.message}` };
      }

      if (!parsed.nfseMunicipal && !parsed.nfseNacional && parsed.modelo !== 'NFS-e') {
        return { success: false, error: 'Documento interpretado não corresponde a modelo NFS-e.' };
      }

      const emitCnpj = cleanNumeric(parsed.emitente?.cnpjCpf || '');
      const destCnpj = cleanNumeric(parsed.destinatario?.cnpjCpf || '');

      // Localizar empresa dona no sistema
      let targetCompany: any = null;
      if (originCompanyId) {
        targetCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(originCompanyId);
      }

      if (!targetCompany && emitCnpj) {
        targetCompany = db.prepare('SELECT * FROM companies WHERE cnpj LIKE ?').get(`%${emitCnpj}%`);
      }

      if (!targetCompany && destCnpj) {
        targetCompany = db.prepare('SELECT * FROM companies WHERE cnpj LIKE ?').get(`%${destCnpj}%`);
      }

      if (!targetCompany) {
        return {
          success: false,
          error: `Nenhuma empresa ativa cadastrada no ViaNFe para emitente "${emitCnpj}" ou destinatário "${destCnpj}".`
        };
      }

      const targetCnpj = cleanNumeric(targetCompany.cnpj);
      const isSaida = emitCnpj === targetCnpj;
      const tipo: 'saida' | 'entrada' = isSaida ? 'saida' : 'entrada';

      // Chave de acesso canônica sem síntese aleatória
      let chaveAcesso = parsed.chaveAcesso;
      if (!chaveAcesso || chaveAcesso.length < 15) {
        chaveAcesso = `NFSE${emitCnpj.padStart(14, '0')}${parsed.numero.padStart(15, '0')}`;
      }

      // Preparar caminhos físicos no storage
      const { xmlFilePath, pdfFilePath } = getInvoiceStoragePaths(
        targetCompany.razao_social,
        parsed.dataEmissao || new Date().toISOString(),
        chaveAcesso,
        STORAGE_DIR,
        targetCompany.cnpj,
        tipo
      );

      // Persistir XML
      fs.writeFileSync(xmlFilePath, rawXml, 'utf-8');

      // Gerar e persistir PDF oficial
      try {
        const pdfBuf = await originalNfsePdf(rawXml);
        fs.writeFileSync(pdfFilePath, pdfBuf);
      } catch (pdfErr: any) {
        console.warn(`[MultiCity NFS-e] Aviso: Não foi possível pré-gerar DANFSe para ${chaveAcesso}: ${pdfErr.message}`);
      }

      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id FROM invoices WHERE chave_acesso = ?').get(chaveAcesso) as any;
      const targetInvoiceId = existing ? existing.id : crypto.randomUUID();

      const faturaJson = parsed.fatura ? JSON.stringify(parsed.fatura) : null;
      const duplicatasJson = parsed.duplicatas && parsed.duplicatas.length > 0 ? JSON.stringify(parsed.duplicatas) : null;
      const pagamentosJson = parsed.pagamentos && parsed.pagamentos.length > 0 ? JSON.stringify(parsed.pagamentos) : null;
      const transporteJson = parsed.transporte ? JSON.stringify(parsed.transporte) : null;
      const infoAdicional = parsed.informacoesComplementares || null;

      if (existing) {
        db.prepare(`
          UPDATE invoices SET
            company_id = ?,
            numero = ?,
            serie = ?,
            modelo = 'NFS-e',
            tipo = ?,
            status = 'autorizada',
            natureza_operacao = ?,
            data_emissao = ?,
            emitente_cnpj = ?,
            emitente_nome = ?,
            emitente_uf = ?,
            destinatario_cnpj = ?,
            destinatario_nome = ?,
            destinatario_uf = ?,
            valor_total = ?,
            valor_produtos = ?,
            valor_icms = 0,
            valor_pis = ?,
            valor_cofins = ?,
            valor_ipi = 0,
            itens_json = ?,
            fatura_json = ?,
            duplicatas_json = ?,
            pagamentos_json = ?,
            info_adicional = ?,
            xml_raw = ?,
            xml_file_path = ?,
            pdf_file_path = ?,
            gdrive_synced = 1
          WHERE id = ?
        `).run(
          targetCompany.id,
          parsed.numero,
          parsed.serie || '1',
          tipo,
          parsed.naturezaOperacao || 'Prestação de Serviços',
          parsed.dataEmissao,
          parsed.emitente.cnpjCpf,
          parsed.emitente.razaoSocial,
          parsed.emitente.uf || 'BA',
          parsed.destinatario.cnpjCpf,
          parsed.destinatario.razaoSocial,
          parsed.destinatario.uf || 'BA',
          parsed.totais.valorTotal,
          parsed.totais.valorProdutos,
          parsed.totais.valorPis,
          parsed.totais.valorCofins,
          JSON.stringify(parsed.itens || []),
          faturaJson,
          duplicatasJson,
          pagamentosJson,
          infoAdicional,
          rawXml,
          xmlFilePath,
          pdfFilePath,
          targetInvoiceId
        );
      } else {
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
            ?, ?, ?, ?, ?, 'NFS-e', ?, 'autorizada',
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, 0, ?, ?, 0,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            1, ?
          )
        `).run(
          targetInvoiceId,
          targetCompany.id,
          chaveAcesso,
          parsed.numero,
          parsed.serie || '1',
          tipo,
          parsed.naturezaOperacao || 'Prestação de Serviços',
          parsed.dataEmissao,
          parsed.dataSaidaEntrada || parsed.dataEmissao,
          parsed.emitente.cnpjCpf,
          parsed.emitente.razaoSocial,
          parsed.emitente.uf || 'BA',
          parsed.destinatario.cnpjCpf,
          parsed.destinatario.razaoSocial,
          parsed.destinatario.uf || 'BA',
          parsed.totais.valorTotal,
          parsed.totais.valorProdutos,
          parsed.totais.valorPis,
          parsed.totais.valorCofins,
          JSON.stringify(parsed.itens || []),
          faturaJson,
          duplicatasJson,
          pagamentosJson,
          transporteJson,
          infoAdicional,
          rawXml,
          xmlFilePath,
          pdfFilePath,
          now
        );
      }

      // Módulo Financeiro: Conciliação e parcelas
      try {
        syncXmlInstallments(db, targetInvoiceId, targetCompany.id, tipo, parsed);
      } catch (_) {}

      return {
        success: true,
        chaveAcesso,
        numero: parsed.numero,
        valorTotal: parsed.totais.valorTotal,
        tipo,
        companyId: targetCompany.id
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Varre e ingere arquivos de NFS-e (individuais e consolidados) das pastas do Google Drive
   */
  public async scanAndIngestDriveNfse(baseDrivePath: string = 'G:/Meu drive/CLIENTES VIACONT/CLIENTES ATIVOS'): Promise<MultiCitySyncReport> {
    const report: MultiCitySyncReport = {
      timestamp: new Date().toISOString(),
      scannedFiles: 0,
      newNfse: 0,
      updatedNfse: 0,
      errors: 0,
      totalValorSaidas: 0,
      totalValorEntradas: 0,
      companiesProcessed: []
    };

    if (!fs.existsSync(baseDrivePath)) {
      console.warn(`[MultiCity NFS-e] Diretório base "${baseDrivePath}" não acessível.`);
      return report;
    }

    const checkExistsStmt = db.prepare('SELECT id FROM invoices WHERE chave_acesso = ? LIMIT 1');
    const companiesMap = new Map<string, { razaoSocial: string; cnpj: string; prefeitura: string; novasNotas: number; valorTotal: number }>();

    const allFiles: string[] = [];
    const scanDirRecursive = (dir: string, depth = 0) => {
      if (depth > 6) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const up = entry.name.toUpperCase();
            if (up.includes('SETOR FISCAL') || up.includes('NF') || up.includes('SERVIC') || up.includes('2026') || depth < 3) {
              scanDirRecursive(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const low = entry.name.toLowerCase();
            if (low.endsWith('.xml') && (low.includes('nfse') || low.includes('servico') || low.includes('consolidado'))) {
              allFiles.push(fullPath);
            }
          }
        }
      } catch (_) {}
    };

    const processXmlFile = async (filePath: string) => {
      report.scannedFiles++;
      try {
        const rawContent = fs.readFileSync(filePath, 'utf-8');

        // Se for lote consolidado, desmembrar cada CompNfse
        if (filePath.toLowerCase().includes('consolidado') || rawContent.includes('<ListaNfse>') || rawContent.includes('<ConsultarNfseResposta>')) {
          try {
            const splitted = splitMunicipalXml(rawContent);
            for (const singleXml of splitted) {
              const res = await this.ingestSingleNfseXml(singleXml);
              if (res.success && res.valorTotal) {
                if (res.tipo === 'saida') report.totalValorSaidas += res.valorTotal;
                else report.totalValorEntradas += res.valorTotal;
                report.newNfse++;
                updateCompanyStats(res.companyId!, res.valorTotal);
              } else if (!res.success) {
                report.errors++;
              }
            }
            return;
          } catch (_) {
            // Fallback para ingestão direta caso o split falhe
          }
        }

        // Ingestão de arquivo individual
        const res = await this.ingestSingleNfseXml(rawContent);
        if (res.success && res.valorTotal) {
          if (res.tipo === 'saida') report.totalValorSaidas += res.valorTotal;
          else report.totalValorEntradas += res.valorTotal;
          report.newNfse++;
          updateCompanyStats(res.companyId!, res.valorTotal);
        } else if (!res.success) {
          report.errors++;
        }
      } catch (err) {
        report.errors++;
      }
    };

    const updateCompanyStats = (companyId: string, valor: number) => {
      if (!companiesMap.has(companyId)) {
        const comp = db.prepare('SELECT razao_social, cnpj, nfse_prefeitura_padrao FROM companies WHERE id = ?').get(companyId) as any;
        if (comp) {
          companiesMap.set(companyId, {
            razaoSocial: comp.razao_social,
            cnpj: comp.cnpj,
            prefeitura: comp.nfse_prefeitura_padrao || 'Salvador',
            novasNotas: 0,
            valorTotal: 0
          });
        }
      }
      const item = companiesMap.get(companyId);
      if (item) {
        item.novasNotas++;
        item.valorTotal += valor;
      }
    };

    scanDirRecursive(baseDrivePath, 0);

    for (const file of allFiles) {
      await processXmlFile(file);
    }

    report.companiesProcessed = Array.from(companiesMap.values());
    return report;
  }

  /**
   * Dispara a sincronização de NFS-e de todas as prefeituras para um mês/ano especificado
   */
  public async syncAllCities(ano: number, mes: number): Promise<{
    ano: number;
    mes: number;
    driveReport: MultiCitySyncReport;
    liveWebServices: Array<{ company: string; prefeitura: string; status: string; notas?: number; erro?: string }>;
  }> {
    console.log(`🌆 [MultiCity NFS-e] Iniciando busca e consolidação universal de NFS-e (Competência: ${String(mes).padStart(2, '0')}/${ano})...`);

    // 1. Varredura universal nos arquivos e lotes do Google Drive
    const driveReport = await this.scanAndIngestDriveNfse();
    console.log(`📁 [MultiCity NFS-e] Varredura no Drive concluída: ${driveReport.newNfse} NFS-e ingeridas somando R$ ${(driveReport.totalValorSaidas + driveReport.totalValorEntradas).toFixed(2)}.`);

    // 2. Consulta WebService ao vivo para as empresas de serviço habilitadas
    const liveWebServices: Array<{ company: string; prefeitura: string; status: string; notas?: number; erro?: string }> = [];

    const activeServiceCompanies = db.prepare(`
      SELECT id, razao_social, cnpj, inscricao_municipal, nfse_prefeitura_padrao, cert_filename
      FROM companies
      WHERE status = 'ativo' AND emite_nfse = 1
    `).all() as any[];

    for (const comp of activeServiceCompanies) {
      const pref = (comp.nfse_prefeitura_padrao || 'Salvador').trim();
      try {
        if (/salvador/i.test(pref) && comp.cert_filename && comp.inscricao_municipal) {
          console.log(`📡 [NFS-e Salvador] Consultando mTLS para ${comp.razao_social} (${comp.cnpj})...`);
          const res = await salvadorNfseMonthlyService.syncMonthlyNfse(comp.id, ano, mes);
          liveWebServices.push({
            company: comp.razao_social,
            prefeitura: 'Salvador',
            status: res.success ? 'sucesso' : 'falha',
            notas: res.totalNotas
          });
        } else {
          liveWebServices.push({
            company: comp.razao_social,
            prefeitura: pref,
            status: 'reconciliado_drive',
            notas: driveReport.companiesProcessed.find(c => c.cnpj === comp.cnpj)?.novasNotas || 0
          });
        }
      } catch (wsErr: any) {
        liveWebServices.push({
          company: comp.razao_social,
          prefeitura: pref,
          status: 'erro_webservice',
          erro: wsErr.message
        });
      }
    }

    return {
      ano,
      mes,
      driveReport,
      liveWebServices
    };
  }
}

export const multiCityNfseService = new MultiCityNfseService();
