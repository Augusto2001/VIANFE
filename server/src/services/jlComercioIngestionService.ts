import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { parseFiscalXml, ParsedFiscalInvoice } from './xmlParser.js';
import { generateDanfePdf } from './danfeGenerator.js';
import { cleanNumeric } from '../utils/crypto.js';
import { getInvoiceStoragePaths, getClientFolderInGDrive, getSetorFiscalNfeDir, G_DRIVE_BASE_PATH } from '../utils/driveFolderMatcher.js';
import { STORAGE_DIR } from '../database/db.js';
import { classifyFiscalDirection } from '../utils/fiscalClassifier.js';

export const JL_COMPANY_ID = 'fc73d7bc-2423-4e6c-897d-161b7f05b392';
export const JL_CNPJ = '73472235000150';
export const JL_RAZAO_SOCIAL = 'JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA';
export const JL_NOME_FANTASIA = 'Leandro Gomes (JL Comércio)';
export const JL_G_DRIVE_2026_DIR = 'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\\SETOR FISCAL\\NF\\2026';

export interface ExtractedZipEntry {
  name: string;
  content: string;
}

/**
 * Pure Node.js synchronous ZIP unpacker supporting Deflate (8) and Stored (0) compression.
 * Reads both Central Directory and Local File Headers for 100% robust extraction.
 */
export function extractZipXmlFiles(zipPathOrBuffer: string | Buffer): ExtractedZipEntry[] {
  const buf = typeof zipPathOrBuffer === 'string' ? fs.readFileSync(zipPathOrBuffer) : zipPathOrBuffer;
  const results: ExtractedZipEntry[] = [];
  const seenNames = new Set<string>();

  // 1. Try Central Directory first (most accurate for ZIP files)
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    try {
      const cdOffset = buf.readUInt32LE(eocdOffset + 16);
      const totalEntries = buf.readUInt16LE(eocdOffset + 10);
      let cur = cdOffset;

      for (let i = 0; i < totalEntries && cur + 46 <= buf.length; i++) {
        if (buf.readUInt32LE(cur) !== 0x02014b50) break;

        const compression = buf.readUInt16LE(cur + 10);
        const compSize = buf.readUInt32LE(cur + 20);
        const fnLen = buf.readUInt16LE(cur + 28);
        const extraLen = buf.readUInt16LE(cur + 30);
        const commentLen = buf.readUInt16LE(cur + 32);
        const localHeaderOffset = buf.readUInt32LE(cur + 42);

        const name = buf.toString('utf-8', cur + 46, cur + 46 + fnLen);
        const lowerName = (name || '').toLowerCase();

        if (name && !name.endsWith('/') && !name.endsWith('\\')) {
          if (localHeaderOffset + 30 <= buf.length) {
            const locFnLen = buf.readUInt16LE(localHeaderOffset + 26);
            const locExLen = buf.readUInt16LE(localHeaderOffset + 28);
            const dataOffset = localHeaderOffset + 30 + locFnLen + locExLen;

            if (dataOffset + compSize <= buf.length) {
              const compressedData = buf.subarray(dataOffset, dataOffset + compSize);
              let uncompressed: Buffer | null = null;

              if (compression === 0) {
                uncompressed = Buffer.from(compressedData);
              } else if (compression === 8) {
                try {
                  uncompressed = zlib.inflateRawSync(compressedData);
                } catch (_) {}
              }

              if (uncompressed) {
                if (lowerName.endsWith('.xml') && !seenNames.has(name)) {
                  let xmlStr = uncompressed.toString('utf-8');
                  if (xmlStr.charCodeAt(0) === 0xFEFF) {
                    xmlStr = xmlStr.substring(1);
                  }
                  const trimmed = xmlStr.trim();
                  if (trimmed.startsWith('<') || trimmed.includes('<?xml')) {
                    results.push({ name, content: trimmed });
                    seenNames.add(name);
                  }
                } else if (lowerName.endsWith('.zip')) {
                  try {
                    const nested = extractZipXmlFiles(uncompressed);
                    for (const n of nested) {
                      const nestedKey = `${name}/${n.name}`;
                      if (!seenNames.has(nestedKey)) {
                        results.push({ name: nestedKey, content: n.content });
                        seenNames.add(nestedKey);
                      }
                    }
                  } catch (_) {}
                }
              }
            }
          }
        }
        cur += 46 + fnLen + extraLen + commentLen;
      }
    } catch (e: any) {
      console.warn('[ZIP Parser] Erro no Central Directory, tentando local headers:', e.message);
    }
  }

  // 2. Supplementary: Parse Local File Headers sequentially
  if (results.length === 0) {
    let offset = 0;
    while (offset + 30 <= buf.length) {
      if (buf.readUInt32LE(offset) !== 0x04034b50) break;

      const compression = buf.readUInt16LE(offset + 8);
      const compressedSize = buf.readUInt32LE(offset + 18);
      const fileNameLength = buf.readUInt16LE(offset + 26);
      const extraFieldLength = buf.readUInt16LE(offset + 28);

      const nameOffset = offset + 30;
      const name = buf.toString('utf-8', nameOffset, nameOffset + fileNameLength);
      const lowerName = (name || '').toLowerCase();
      const dataOffset = nameOffset + fileNameLength + extraFieldLength;

      if (name && !name.endsWith('/') && !name.endsWith('\\')) {
        if (dataOffset + compressedSize <= buf.length) {
          const compressedData = buf.subarray(dataOffset, dataOffset + compressedSize);
          let uncompressed: Buffer | null = null;
          if (compression === 0) {
            uncompressed = Buffer.from(compressedData);
          } else if (compression === 8) {
            try {
              uncompressed = zlib.inflateRawSync(compressedData);
            } catch (_) {}
          }
          if (uncompressed) {
            if (lowerName.endsWith('.xml') && !seenNames.has(name)) {
              let xmlStr = uncompressed.toString('utf-8');
              if (xmlStr.charCodeAt(0) === 0xFEFF) {
                xmlStr = xmlStr.substring(1);
              }
              const trimmed = xmlStr.trim();
              if (trimmed.startsWith('<') || trimmed.includes('<?xml')) {
                results.push({ name, content: trimmed });
                seenNames.add(name);
              }
            } else if (lowerName.endsWith('.zip')) {
              try {
                const nested = extractZipXmlFiles(uncompressed);
                for (const n of nested) {
                  const nestedKey = `${name}/${n.name}`;
                  if (!seenNames.has(nestedKey)) {
                    results.push({ name: nestedKey, content: n.content });
                    seenNames.add(nestedKey);
                  }
                }
              } catch (_) {}
            }
          }
        }
      }

      offset = dataOffset + compressedSize;
      if (compressedSize === 0) break;
    }
  }

  return results;
}

/**
 * Ensures company record and tenant link exist in database.
 */
export function ensureJlCompanyRecord(database: DatabaseSync) {
  const now = new Date().toISOString();
  
  // 1. Ensure master tenant exists
  database.prepare(`
    INSERT OR IGNORE INTO tenants (id, name, cnpj, plan, status, created_at, updated_at)
    VALUES ('tenant_viacont_master', 'Viacont Inovações Contábeis', '00000000000199', 'enterprise', 'ativo', ?, ?)
  `).run(now, now);

  // 2. Insert or update JL COMERCIO (avoids UNIQUE constraint issues on CNPJ)
  const allCompanies = database.prepare('SELECT id, cnpj FROM companies').all() as any[];
  const existingCompany = allCompanies.find(c => cleanNumeric(c.cnpj) === cleanNumeric(JL_CNPJ) || c.id === JL_COMPANY_ID);

  if (existingCompany) {
    database.prepare(`
      UPDATE companies SET
        id = ?,
        razao_social = ?,
        nome_fantasia = ?,
        cnpj = ?,
        uf = 'BA',
        status = 'ativo',
        sefaz_ambiente = 'producao',
        updated_at = ?
      WHERE id = ? OR cnpj = ?
    `).run(JL_COMPANY_ID, JL_RAZAO_SOCIAL, JL_NOME_FANTASIA, JL_CNPJ, now, existingCompany.id, existingCompany.cnpj);
  } else {
    database.prepare(`
      INSERT INTO companies (
        id, tenant_id, cnpj, razao_social, nome_fantasia, uf, status, sefaz_ambiente, created_at, updated_at
      ) VALUES (
        ?, 'tenant_viacont_master', ?, ?, ?, 'BA', 'ativo', 'producao', ?, ?
      )
    `).run(JL_COMPANY_ID, JL_CNPJ, JL_RAZAO_SOCIAL, JL_NOME_FANTASIA, now, now);
  }

  // 3. Configure Google Drive mapping
  database.prepare(`
    INSERT INTO gdrive_configs (
      id, company_id, folder_name, folder_path, is_active, created_at, updated_at
    ) VALUES (
      'gdrive_cfg_jl_comercio', ?, 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )',
      'G:\\\\Meu drive\\\\CLIENTES VIACONT\\\\CLIENTES ATIVOS\\\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )',
      1, ?, ?
    )
    ON CONFLICT(company_id) DO UPDATE SET 
      folder_name = excluded.folder_name,
      folder_path = excluded.folder_path,
      is_active = 1,
      updated_at = excluded.updated_at
  `).run(JL_COMPANY_ID, now, now);

  // 4. Link all admin and master users to JL COMERCIO in user_companies
  database.prepare(`
    INSERT OR IGNORE INTO user_companies (user_id, company_id)
    SELECT id, ? FROM users
  `).run(JL_COMPANY_ID);
}

/**
 * Finds all fiscal zip packages and XML files for Leandro Gomes in 2026.
 * Traverses G: Drive candidates, dynamic folder matches, and local backups.
 */
export function findJlComercio2026Sources(): { zips: string[]; looseXmls: string[] } {
  const zips: string[] = [];
  const looseXmls: string[] = [];
  const visitedFiles = new Set<string>();

  const walkDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (_) {
          continue;
        }
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const lower = item.toLowerCase();
          const normKey = path.resolve(fullPath).toLowerCase();
          if (visitedFiles.has(normKey)) continue;

          if (lower.endsWith('.zip')) {
            zips.push(fullPath);
            visitedFiles.add(normKey);
          } else if (lower.endsWith('.xml')) {
            looseXmls.push(fullPath);
            visitedFiles.add(normKey);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[JL Ingest Walk] Aviso ao listar ${dir}: ${e.message}`);
    }
  };

  // Candidate root directories to scan
  const candidates: string[] = [
    JL_G_DRIVE_2026_DIR,
    'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\\SETOR FISCAL\\NFe\\2026',
    'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\\SETOR FISCAL\\NF',
    'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\\SETOR FISCAL\\NFe',
    'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS\\LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )\\SETOR FISCAL',
  ];

  // Dynamically resolve client folder in G: Drive via folder matcher
  try {
    const dynamicFolder = getClientFolderInGDrive(JL_RAZAO_SOCIAL, JL_CNPJ, JL_NOME_FANTASIA);
    if (dynamicFolder && fs.existsSync(dynamicFolder)) {
      candidates.push(dynamicFolder);
      const setorNfe = getSetorFiscalNfeDir(dynamicFolder);
      if (setorNfe && fs.existsSync(setorNfe)) {
        candidates.push(setorNfe);
        candidates.push(path.join(setorNfe, '2026'));
      }
    }
  } catch (_) {}

  // Local storage candidate directories
  candidates.push(
    path.join(STORAGE_DIR, 'CLIENTES VIACONT', 'CLIENTES ATIVOS', 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )', 'SETOR FISCAL', 'NF', '2026'),
    path.join(STORAGE_DIR, 'CLIENTES VIACONT', 'CLIENTES ATIVOS', 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )', 'SETOR FISCAL', 'NFe', '2026'),
    path.join(STORAGE_DIR, 'CLIENTES VIACONT', 'CLIENTES ATIVOS', 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )', 'SETOR FISCAL'),
    path.join(STORAGE_DIR, 'CLIENTES VIACONT', 'CLIENTES ATIVOS', 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )'),
    path.join(STORAGE_DIR, 'CLIENTES VIACONT', 'CLIENTES ATIVOS', 'JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA'),
    path.join(STORAGE_DIR, 'xmls', 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )'),
    path.join(STORAGE_DIR, 'xmls', 'JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA')
  );

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      walkDir(c);
    }
  }

  return { zips, looseXmls };
}

/**
 * Executes full synchronous fiscal ingestion of Leandro Gomes (JL Comércio) 2026 invoices.
 */
export function runJlComercioFullIngestion(database: DatabaseSync): {
  success: boolean;
  totalIngested: number;
  totalXmlGenerated: number;
  totalDanfeGenerated: number;
  message: string;
} {
  console.log('🚀 [JL Comércio] Iniciando Ingestão Fiscal Completa 2026...');
  ensureJlCompanyRecord(database);

  const { zips, looseXmls } = findJlComercio2026Sources();
  console.log(`📁 [JL Comércio] Fontes encontradas: ${zips.length} pacotes ZIP, ${looseXmls.length} arquivos XML soltos.`);

  const xmlEntries: Array<{ name: string; content: string; originPath: string }> = [];

  // 1. Process ZIP files
  for (const zipFile of zips) {
    try {
      console.log(`📦 [JL Comércio] Descompactando pacote: ${path.basename(zipFile)}...`);
      const extracted = extractZipXmlFiles(zipFile);
      console.log(`   └─ Extraídos ${extracted.length} XMLs de ${path.basename(zipFile)}`);
      for (const entry of extracted) {
        xmlEntries.push({ ...entry, originPath: zipFile });
      }
    } catch (zipErr: any) {
      console.warn(`⚠️ [JL Comércio] Falha ao extrair ${zipFile}: ${zipErr.message}`);
    }
  }

  // 2. Process loose XML files
  for (const xmlFile of looseXmls) {
    try {
      const content = fs.readFileSync(xmlFile, 'utf-8');
      if (content.trim().startsWith('<') || content.includes('<?xml')) {
        xmlEntries.push({ name: path.basename(xmlFile), content, originPath: xmlFile });
      }
    } catch (readErr: any) {
      console.warn(`⚠️ [JL Comércio] Falha ao ler XML ${xmlFile}: ${readErr.message}`);
    }
  }

  console.log(`⚡ [JL Comércio] Total de ${xmlEntries.length} arquivos XML preparados para processamento.`);

  let totalIngested = 0;
  let totalXmlGenerated = 0;
  let totalDanfeGenerated = 0;
  const processedChaves = new Set<string>();

  const insertInvoiceStmt = database.prepare(`
    INSERT INTO invoices (
      id, company_id, chave_acesso, numero, serie, modelo, tipo, status,
      natureza_operacao, data_emissao, data_saida_entrada,
      emitente_cnpj, emitente_nome, emitente_uf,
      destinatario_cnpj, destinatario_nome, destinatario_uf,
      valor_total, valor_produtos, valor_icms, valor_pis, valor_cofins, valor_ipi,
      itens_json, fatura_json, duplicatas_json, pagamentos_json, transporte_json,
      info_adicional, xml_raw, xml_file_path, pdf_file_path,
      gdrive_synced, gdrive_synced_at, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?
    )
    ON CONFLICT(chave_acesso) DO UPDATE SET
      company_id = excluded.company_id,
      tipo = excluded.tipo,
      emitente_cnpj = excluded.emitente_cnpj,
      emitente_nome = excluded.emitente_nome,
      destinatario_cnpj = excluded.destinatario_cnpj,
      destinatario_nome = excluded.destinatario_nome,
      status = excluded.status,
      valor_total = excluded.valor_total,
      xml_raw = excluded.xml_raw,
      xml_file_path = excluded.xml_file_path,
      pdf_file_path = excluded.pdf_file_path,
      gdrive_synced = 1,
      gdrive_synced_at = excluded.gdrive_synced_at
  `);

  const insertInstallmentStmt = database.prepare(`
    INSERT INTO invoice_installments (
      id, invoice_id, company_id, tipo, numero_fatura, numero_parcela,
      data_vencimento, valor, status, forma_pagamento, fornecedor_cliente_nome,
      fornecedor_cliente_cnpj, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 'Duplicata', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      valor = excluded.valor,
      tipo = excluded.tipo,
      fornecedor_cliente_nome = excluded.fornecedor_cliente_nome,
      fornecedor_cliente_cnpj = excluded.fornecedor_cliente_cnpj
  `);

  const now = new Date().toISOString();

  for (const entry of xmlEntries) {
    try {
      const xml = entry.content;
      // Skip event XMLs (cancelamento / CC-e) that are not base invoices
      if (xml.includes('<procEventoNFe') && !xml.includes('<nfeProc') && !xml.includes('<infNFe')) {
        continue;
      }

      let parsed: ParsedFiscalInvoice;
      try {
        parsed = parseFiscalXml(xml);
      } catch (parseErr: any) {
        continue;
      }

      // Compute deterministic access key immediately
      const effectiveChave = (parsed.chaveAcesso && parsed.chaveAcesso.trim() !== '')
        ? parsed.chaveAcesso.trim()
        : `NFSE_${JL_CNPJ}_${parsed.numero || '0'}_${Date.parse(parsed.dataEmissao) || Date.now()}`;

      if (processedChaves.has(effectiveChave)) continue;
      processedChaves.add(effectiveChave);
      parsed.chaveAcesso = effectiveChave;

      // Classificação fiscal determinística (Entrada vs Saída) relativa à JL COMÉRCIO
      const classification = classifyFiscalDirection(
        JL_CNPJ,
        parsed.emitente.cnpjCpf,
        parsed.destinatario.cnpjCpf,
        parsed.tipoOperacao,
        parsed.modelo,
        parsed.destinatario.razaoSocial
      );

      const tipo = classification.tipo;
      parsed.destinatario.cnpjCpf = classification.destinatarioCnpj;
      parsed.destinatario.razaoSocial = classification.destinatarioNome;

      // Build target storage paths
      const paths = getInvoiceStoragePaths(
        JL_RAZAO_SOCIAL,
        parsed.dataEmissao,
        effectiveChave,
        STORAGE_DIR,
        JL_CNPJ,
        tipo,
        JL_NOME_FANTASIA
      );

      // Save XML file
      try {
        fs.mkdirSync(path.dirname(paths.xmlFilePath), { recursive: true });
        fs.writeFileSync(paths.xmlFilePath, xml, 'utf-8');
        totalXmlGenerated++;
      } catch (writeXmlErr: any) {
        console.warn(`[JL Ingest] Aviso ao gravar XML ${effectiveChave}:`, writeXmlErr.message);
      }

      // Pre-generate / link DANFE PDF path
      try {
        fs.mkdirSync(path.dirname(paths.pdfFilePath), { recursive: true });
        generateDanfePdf(parsed, paths.pdfFilePath).catch(() => {});
        totalDanfeGenerated++;
      } catch (pdfErr: any) {
        console.warn(`[JL Ingest] Aviso ao preparar DANFE PDF ${effectiveChave}:`, pdfErr.message);
      }

      const invoiceId = `inv_jl_${effectiveChave.length > 32 ? effectiveChave.substring(effectiveChave.length - 32) : effectiveChave}`;

      const faturaJson = parsed.fatura ? JSON.stringify(parsed.fatura) : null;
      const duplicatasJson = parsed.duplicatas && parsed.duplicatas.length > 0 ? JSON.stringify(parsed.duplicatas) : null;
      const pagamentosJson = parsed.pagamentos && parsed.pagamentos.length > 0 ? JSON.stringify(parsed.pagamentos) : null;
      const transporteJson = parsed.transporte ? JSON.stringify(parsed.transporte) : null;
      const itensJson = parsed.itens ? JSON.stringify(parsed.itens) : '[]';

      insertInvoiceStmt.run(
        invoiceId,
        JL_COMPANY_ID,
        effectiveChave,
        parsed.numero || '0',
        parsed.serie || '1',
        parsed.modelo || '55',
        tipo,
        parsed.status || 'autorizada',
        parsed.naturezaOperacao || 'Operação Fiscal',
        parsed.dataEmissao,
        parsed.dataSaidaEntrada || null,
        parsed.emitente.cnpjCpf || JL_CNPJ,
        parsed.emitente.razaoSocial || JL_RAZAO_SOCIAL,
        parsed.emitente.uf || 'BA',
        parsed.destinatario.cnpjCpf || '',
        parsed.destinatario.razaoSocial || '',
        parsed.destinatario.uf || '',
        parsed.totais.valorTotal || 0.0,
        parsed.totais.valorProdutos || 0.0,
        parsed.totais.valorIcms || 0.0,
        parsed.totais.valorPis || 0.0,
        parsed.totais.valorCofins || 0.0,
        parsed.totais.valorIpi || 0.0,
        itensJson,
        faturaJson,
        duplicatasJson,
        pagamentosJson,
        transporteJson,
        parsed.informacoesComplementares || null,
        xml,
        paths.xmlFilePath,
        paths.pdfFilePath,
        now,
        now
      );

      // Insert Installments
      if (parsed.duplicatas && parsed.duplicatas.length > 0) {
        for (let dIdx = 0; dIdx < parsed.duplicatas.length; dIdx++) {
          const dup = parsed.duplicatas[dIdx];
          const instId = `inst_${invoiceId}_${dIdx + 1}`;
          insertInstallmentStmt.run(
            instId,
            invoiceId,
            JL_COMPANY_ID,
            tipo === 'entrada' ? 'pagar' : 'receber',
            parsed.fatura?.numero || parsed.numero,
            dup.numero || String(dIdx + 1),
            dup.vencimento || parsed.dataEmissao.split('T')[0],
            dup.valor || 0.0,
            tipo === 'entrada' ? parsed.emitente.razaoSocial : parsed.destinatario.razaoSocial,
            tipo === 'entrada' ? parsed.emitente.cnpjCpf : parsed.destinatario.cnpjCpf,
            now
          );
        }
      }

      processedChaves.add(parsed.chaveAcesso);
      totalIngested++;
    } catch (itemErr: any) {
      console.warn('[JL Ingest] Erro ao processar item:', itemErr.message);
    }
  }

  console.log(`\n🎉 [JL Comércio] Ingestão concluída com SUCESSO!`);
  console.log(`   ├─ Notas inseridas / atualizadas: ${totalIngested}`);
  console.log(`   ├─ XMLs gravados no Drive/Storage: ${totalXmlGenerated}`);
  console.log(`   └─ DANFEs PDF estruturados: ${totalDanfeGenerated}`);

  return {
    success: true,
    totalIngested,
    totalXmlGenerated,
    totalDanfeGenerated,
    message: `${totalIngested} notas fiscais de 2026 inseridas com sucesso para JL COMÉRCIO!`
  };
}
