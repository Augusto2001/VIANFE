import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../database/db.js';
import { parseFiscalXml } from './xmlParser.js';
import { classifyFiscalDirection } from '../utils/fiscalClassifier.js';
import { generateDanfePdf } from './danfeGenerator.js';
import { extractZipXmlFiles } from './jlComercioIngestionService.js';
import { getClientFolderInGDrive, G_DRIVE_BASE_PATH } from '../utils/driveFolderMatcher.js';
import { svrsNfceClient } from './svrsNfceClient.js';
import { sefazService } from './sefazService.js';

export interface MorningSyncCompanyResult {
  companyId: string;
  cnpj: string;
  razaoSocial: string;
  scannedFiles: number;
  newInvoices: number;
  newSaidas: number;
  newEntradas: number;
  errors: number;
}

export interface MorningBatchSyncReport {
  success: boolean;
  triggerOrigin: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalNewInvoices: number;
  totalSaidas: number;
  totalEntradas: number;
  companies: MorningSyncCompanyResult[];
}

export class MorningSalesSyncService {
  private isRunning = false;

  /**
   * Executa a esteira matinal autônoma de ingestão e captura de vendas (NFC-e / NF-e)
   * para todas as empresas ativas. Roda diariamente às 06:00 AM (Salvador/Brasília).
   */
  public async runMorningBatchSync(triggerOrigin: string = 'MATUTINO_06H00'): Promise<MorningBatchSyncReport> {
    if (this.isRunning) {
      console.warn(`[ROBÔ MATUTINO] Sincronização matinal já em andamento. Ignorando disparo duplicado.`);
      return {
        success: false,
        triggerOrigin,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        totalNewInvoices: 0,
        totalSaidas: 0,
        totalEntradas: 0,
        companies: []
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    console.log(`🌅 [ROBÔ MATUTINO - ${triggerOrigin}] Iniciando esteira matinal de notas fiscais de vendas e faturamento...`);

    const report: MorningBatchSyncReport = {
      success: true,
      triggerOrigin,
      startedAt,
      finishedAt: '',
      durationMs: 0,
      totalNewInvoices: 0,
      totalSaidas: 0,
      totalEntradas: 0,
      companies: []
    };

    try {
      const activeCompanies = db.prepare(`
        SELECT id, razao_social, nome_fantasia, cnpj, cert_filename, last_nsu
        FROM companies
        WHERE status = 'ativo'
      `).all() as any[];

      const now = new Date();
      const currentYear = String(now.getFullYear());
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYear = String(prevDate.getFullYear());
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');

      const targetPeriods = [
        { year: currentYear, month: currentMonth },
        { year: prevYear, month: prevMonth }
      ];

      for (const comp of activeCompanies) {
        const compResult: MorningSyncCompanyResult = {
          companyId: comp.id,
          cnpj: comp.cnpj,
          razaoSocial: comp.razao_social,
          scannedFiles: 0,
          newInvoices: 0,
          newSaidas: 0,
          newEntradas: 0,
          errors: 0
        };

        try {
          const clientFolder = getClientFolderInGDrive(comp.razao_social, comp.cnpj, comp.nome_fantasia);
          if (!clientFolder || !fs.existsSync(clientFolder)) {
            report.companies.push(compResult);
            continue;
          }

          const xmlFilesToProcess: string[] = [];
          const zipFilesToProcess: string[] = [];

          // Varredura recursiva focada em pastas fiscais do ano/mês corrente e anterior
          const searchDirs: string[] = [];
          const fiscalBase = path.join(clientFolder, 'SETOR FISCAL');
          if (fs.existsSync(fiscalBase)) {
            searchDirs.push(fiscalBase);
          } else {
            searchDirs.push(clientFolder);
          }

          const findCandidateFiles = (dir: string, depth: number = 0) => {
            if (depth > 5) return;
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  // Entrar em subpastas relevantes
                  const nameUpper = entry.name.toUpperCase();
                  const isRelevant = targetPeriods.some(p => nameUpper.includes(p.year) || nameUpper.includes(p.month)) ||
                    /NF|NFE|NFCE|SAIDA|XML|APURACAO|FISCAL/i.test(nameUpper);
                  if (isRelevant || depth < 2) {
                    findCandidateFiles(fullPath, depth + 1);
                  }
                } else if (entry.isFile()) {
                  const lowerName = entry.name.toLowerCase();
                  if (lowerName.endsWith('.zip')) {
                    const isPeriodZip = targetPeriods.some(p => fullPath.includes(p.month) || fullPath.includes(p.year) || lowerName.includes(p.month));
                    if (isPeriodZip || /saida|nfc/i.test(fullPath)) {
                      zipFilesToProcess.push(fullPath);
                    }
                  } else if (lowerName.endsWith('.xml')) {
                    const isPeriodXml = targetPeriods.some(p => fullPath.includes(p.month) || fullPath.includes(p.year));
                    if (isPeriodXml || /saida|nfc/i.test(fullPath)) {
                      xmlFilesToProcess.push(fullPath);
                    }
                  }
                }
              }
            } catch (_) {}
          };

          for (const sDir of searchDirs) {
            findCandidateFiles(sDir, 0);
          }

          compResult.scannedFiles = xmlFilesToProcess.length + zipFilesToProcess.length;

          // Preparar statements de banco
          const checkExistsStmt = db.prepare('SELECT 1 FROM invoices WHERE chave_acesso = ? LIMIT 1');
          const insertInvoiceStmt = db.prepare(`
            INSERT INTO invoices (
              id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
              natureza_operacao, data_emissao, emitente_cnpj, emitente_nome, emitente_uf,
              destinatario_cnpj, destinatario_nome, destinatario_uf, valor_total,
              valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
              itens_json, xml_raw, gdrive_synced, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, 'autorizada',
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, 1, datetime('now')
            )
            ON CONFLICT(chave_acesso) DO UPDATE SET
              company_id = excluded.company_id,
              tipo = excluded.tipo,
              emitente_cnpj = excluded.emitente_cnpj,
              emitente_nome = excluded.emitente_nome,
              destinatario_cnpj = excluded.destinatario_cnpj,
              destinatario_nome = excluded.destinatario_nome,
              valor_total = excluded.valor_total,
              valor_produtos = excluded.valor_produtos,
              valor_icms = excluded.valor_icms,
              valor_pis = excluded.valor_pis,
              valor_cofins = excluded.valor_cofins,
              data_emissao = excluded.data_emissao,
              xml_raw = excluded.xml_raw
          `);

          const processXmlContent = (rawXml: string): boolean => {
            try {
              if (!rawXml.includes('<nfeProc') && !rawXml.includes('<infNFe') && !rawXml.includes('<NFe')) {
                return false;
              }

              // Extração rápida de chave
              const chMatch = rawXml.match(/Id="NFe(\d{44})"/i) || rawXml.match(/<chNFe>(\d{44})<\/chNFe>/i);
              const chaveAcesso = chMatch ? chMatch[1] : null;

              if (chaveAcesso) {
                const exists = checkExistsStmt.get(chaveAcesso);
                if (exists) {
                  return false; // Nota já está no banco
                }
              }

              const parsed = parseFiscalXml(rawXml);
              if (!parsed.chaveAcesso || parsed.chaveAcesso.length !== 44) {
                return false;
              }

              const existsParsed = checkExistsStmt.get(parsed.chaveAcesso);
              if (existsParsed) {
                return false;
              }

              const classification = classifyFiscalDirection(
                comp.cnpj,
                parsed.emitente.cnpjCpf,
                parsed.destinatario.cnpjCpf,
                parsed.tipoOperacao,
                parsed.modelo,
                parsed.destinatario.razaoSocial
              );

              const tipo = classification.tipo;
              if (tipo === 'saida') {
                compResult.newSaidas++;
              } else {
                compResult.newEntradas++;
              }

              const id = crypto.randomUUID();
              const itensJson = parsed.itens ? JSON.stringify(parsed.itens) : null;

              insertInvoiceStmt.run(
                id,
                comp.id,
                parsed.chaveAcesso,
                parsed.numero || '0',
                parsed.serie || '1',
                parsed.modelo || '65',
                tipo,
                parsed.naturezaOperacao || 'Venda',
                parsed.dataEmissao,
                parsed.emitente.cnpjCpf || comp.cnpj,
                parsed.emitente.razaoSocial || comp.razao_social,
                parsed.emitente.uf || 'BA',
                classification.destinatarioCnpj || '',
                classification.destinatarioNome || 'Consumidor Final',
                parsed.destinatario?.uf || 'BA',
                parsed.totais?.valorTotal || 0,
                parsed.totais?.valorProdutos || 0,
                parsed.totais?.valorIcms || 0,
                parsed.totais?.valorPis || 0,
                parsed.totais?.valorCofins || 0,
                parsed.totais?.valorIpi || 0,
                itensJson,
                rawXml
              );

              compResult.newInvoices++;
              return true;
            } catch (err) {
              compResult.errors++;
              return false;
            }
          };

          // 1. Processar pacotes ZIP
          for (const zipPath of zipFilesToProcess) {
            try {
              const entries = extractZipXmlFiles(zipPath);
              for (const entry of entries) {
                processXmlContent(entry.content);
              }
            } catch (err: any) {
              console.warn(`[ROBÔ MATUTINO] Erro ao extrair ZIP ${zipPath}:`, err.message);
            }
          }

          // 2. Processar XMLs avulsos
          for (const xmlPath of xmlFilesToProcess) {
            try {
              const raw = fs.readFileSync(xmlPath, 'utf-8');
              processXmlContent(raw);
            } catch (err: any) {
              compResult.errors++;
            }
          }

          if (compResult.newInvoices > 0) {
            console.log(`✅ [ROBÔ MATUTINO] ${comp.razao_social}: ${compResult.newInvoices} novas notas ingeridas (Saídas: ${compResult.newSaidas}, Entradas: ${compResult.newEntradas}).`);
          }
        } catch (compErr: any) {
          console.warn(`⚠️ [ROBÔ MATUTINO] Erro na empresa ${comp.razao_social}:`, compErr.message);
        }

        report.totalNewInvoices += compResult.newInvoices;
        report.totalSaidas += compResult.newSaidas;
        report.totalEntradas += compResult.newEntradas;
        report.companies.push(compResult);
      }

      report.durationMs = Date.now() - startTime;
      report.finishedAt = new Date().toISOString();

      console.log(`🏁 [ROBÔ MATUTINO - ${triggerOrigin}] Ciclo matinal concluído em ${report.durationMs}ms. Novas notas capturadas: ${report.totalNewInvoices} (Saídas: ${report.totalSaidas}, Entradas: ${report.totalEntradas}).`);

      // Salvar auditoria por empresa para integridade de chave estrangeira
      try {
        const insertLogStmt = db.prepare(`
          INSERT INTO sefaz_audit_logs (
            id, company_id, cnpj, razao_social, nsu_inicial, nsu_final, max_nsu,
            notas_localizadas, notas_baixadas, cstat, xmotivo, trigger_type,
            duracao_ms, iniciado_em, finalizado_em, status, detalhes_json
          ) VALUES (?, ?, ?, ?, '0', '0', '0',
            ?, ?, '100', 'Ciclo matinal de vendas concluído', ?,
            ?, ?, ?, 'sucesso', ?
          )
        `);

        for (const c of report.companies) {
          if (c.newInvoices > 0 || c.scannedFiles > 0) {
            const logId = crypto.randomUUID();
            insertLogStmt.run(
              logId,
              c.companyId,
              c.cnpj,
              c.razaoSocial,
              c.newInvoices,
              c.newInvoices,
              triggerOrigin,
              report.durationMs,
              startedAt,
              report.finishedAt,
              JSON.stringify({
                saidas: c.newSaidas,
                entradas: c.newEntradas,
                scannedFiles: c.scannedFiles,
                errors: c.errors
              })
            );
          }
        }
      } catch (logErr: any) {
        console.warn(`[ROBÔ MATUTINO] Erro ao gravar log de auditoria:`, logErr.message);
      }

    } catch (err: any) {
      console.error(`❌ [ROBÔ MATUTINO - ${triggerOrigin}] Falha crítica:`, err.message);
      report.success = false;
    } finally {
      this.isRunning = false;
    }

    return report;
  }
}

export const morningSalesSyncService = new MorningSalesSyncService();
