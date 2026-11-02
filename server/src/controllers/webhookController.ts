import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../database/db.js';
import { cleanNumeric } from '../utils/crypto.js';
import { isSameCompany } from '../utils/fiscalClassifier.js';
import { parseFiscalXml } from '../services/xmlParser.js';
import { sefazService } from '../services/sefazService.js';
import { extractZipXmlFiles, ExtractedZipEntry } from '../services/jlComercioIngestionService.js';

// Lista de extensões perigosas bloqueadas por segurança anti-malware
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  '.scr', '.pif', '.com', '.hta', '.cpl', '.jar', '.msi', '.ps1', '.sh',
  '.bin', '.iso', '.dmg', '.docm', '.xlsm', '.reg', '.inf'
];

export class WebhookController {
  /**
   * Valida o token de segurança do webhook (x-webhook-token, query ?token= ou Bearer)
   */
  private validateWebhookAuth(req: Request): boolean {
    const headerToken = req.headers['x-webhook-token'];
    const queryToken = req.query.token;
    let bearerToken: string | null = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const providedToken = (headerToken || queryToken || bearerToken || '').toString().trim();
    if (!providedToken) return false;

    // Obter segredo configurado no banco ou variável de ambiente
    let configuredSecret = process.env.EMAIL_WEBHOOK_SECRET || '';
    if (!configuredSecret) {
      try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'email_webhook_secret'").get() as any;
        if (row?.value) {
          configuredSecret = row.value;
        }
      } catch (_) {}
    }

    // Segredo de contingência seguro para o ambiente Viacont
    if (!configuredSecret) {
      configuredSecret = 'vianfe_email_sec_2026_viacont';
    }

    return providedToken === configuredSecret;
  }

  /**
   * Endpoint de recepção segura de notas fiscais enviadas por e-mail (Conta Azul, Hiper, ERPs)
   * Aceita:
   *  - XML direto (body.xml ou body.xmlBase64)
   *  - ZIP em Base64 (body.zipBase64)
   *  - Lista de arquivos (body.files: [{ name, content }])
   *  - Upload multipart de arquivo único ou lote (req.file / req.files)
   */
  public handleEmailInvoicesWebhook = async (req: Request, res: Response): Promise<void> => {
    // 1. Verificação de Autenticação Segura
    if (!this.validateWebhookAuth(req)) {
      res.status(401).json({
        success: false,
        error: 'Acesso negado: token do webhook de e-mail inválido ou ausente.',
        code: 'UNAUTHORIZED_WEBHOOK_TOKEN'
      });
      return;
    }

    const senderEmail = (req.body?.senderEmail || req.headers['x-sender-email'] || 'desconhecido').toString();
    const subject = (req.body?.subject || req.headers['x-email-subject'] || '').toString();

    console.log(`📥 [EMAIL WEBHOOK] Requisição recebida de "${senderEmail}" | Assunto: "${subject}"`);

    // Coletor de XMLs extraídos
    const rawXmlEntries: { name: string; content: string }[] = [];

    try {
      // 2. Extração e Descompactação com Blindagem Anti-Malware
      const filesToCheck: { name: string; buffer?: Buffer; base64?: string; text?: string }[] = [];

      // A) Multipart form-data
      if (req.file) {
        filesToCheck.push({ name: req.file.originalname, buffer: fs.readFileSync(req.file.path) });
        // Limpar arquivo temporário de upload
        fs.unlink(req.file.path, () => {});
      } else if (Array.isArray(req.files)) {
        for (const f of req.files) {
          filesToCheck.push({ name: f.originalname, buffer: fs.readFileSync(f.path) });
          fs.unlink(f.path, () => {});
        }
      }

      // B) JSON: zipBase64
      if (req.body?.zipBase64) {
        const name = req.body?.fileName || 'anexo.zip';
        filesToCheck.push({ name, base64: req.body.zipBase64 });
      }

      // C) JSON: xmlBase64
      if (req.body?.xmlBase64) {
        const name = req.body?.fileName || 'nota.xml';
        const decoded = Buffer.from(req.body.xmlBase64, 'base64').toString('utf-8');
        filesToCheck.push({ name, text: decoded });
      }

      // D) JSON: xml (texto puro)
      if (req.body?.xml && typeof req.body.xml === 'string') {
        const name = req.body?.fileName || 'nota.xml';
        filesToCheck.push({ name, text: req.body.xml });
      }

      // E) JSON: files array
      if (Array.isArray(req.body?.files)) {
        for (const item of req.body.files) {
          if (item?.name && item?.content) {
            filesToCheck.push({ name: item.name, text: item.content });
          }
        }
      }

      // F) Raw XML body (Content-Type: application/xml ou text/xml)
      if (typeof req.body === 'string' && (req.body.trim().startsWith('<') || req.body.includes('<?xml'))) {
        filesToCheck.push({ name: 'payload.xml', text: req.body });
      }

      if (filesToCheck.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhum arquivo XML ou ZIP válido foi detectado no payload enviado.'
        });
        return;
      }

      // 3. Inspeção e Barreira de Segurança
      for (const item of filesToCheck) {
        const lowerName = item.name.toLowerCase();

        // Checagem de extensão proibida
        const isDangerous = DANGEROUS_EXTENSIONS.some(ext => lowerName.endsWith(ext));
        if (isDangerous) {
          console.warn(`🚨 [SEGURANÇA] Bloqueado anexo com extensão proibida/perigosa: "${item.name}"`);
          res.status(403).json({
            success: false,
            error: `Segurança: Arquivo suspeito ou com extensão não permitida descartado ("${item.name}").`,
            code: 'FORBIDDEN_FILE_EXTENSION'
          });
          return;
        }

        // Se for ZIP
        if (lowerName.endsWith('.zip')) {
          let zipBuf: Buffer | null = null;
          if (item.buffer) zipBuf = item.buffer;
          else if (item.base64) zipBuf = Buffer.from(item.base64, 'base64');
          else if (item.text) zipBuf = Buffer.from(item.text, 'base64');

          if (zipBuf) {
            // Trava de tamanho máximo: 25 MB
            if (zipBuf.length > 25 * 1024 * 1024) {
              res.status(413).json({ success: false, error: 'Arquivo ZIP excede o limite máximo permitido de 25 MB.' });
              return;
            }

            const extracted = extractZipXmlFiles(zipBuf);
            for (const entry of extracted) {
              const entryLower = entry.name.toLowerCase();
              if (DANGEROUS_EXTENSIONS.some(ext => entryLower.endsWith(ext))) {
                console.warn(`🚨 [SEGURANÇA] Arquivo perigoso encontrado dentro do ZIP: "${entry.name}"`);
                res.status(403).json({
                  success: false,
                  error: `Segurança: Arquivo proibido localizado dentro do pacote ZIP ("${entry.name}").`,
                  code: 'MALWARE_DETECTED_IN_ZIP'
                });
                return;
              }
              if (entryLower.endsWith('.xml')) {
                rawXmlEntries.push(entry);
              }
            }
          }
        } else if (lowerName.endsWith('.xml') || (item.text && item.text.trim().startsWith('<'))) {
          // Arquivo XML individual
          let xmlStr = item.text || (item.buffer ? item.buffer.toString('utf-8') : '');
          if (item.base64 && !xmlStr) {
            xmlStr = Buffer.from(item.base64, 'base64').toString('utf-8');
          }

          if (xmlStr) {
            rawXmlEntries.push({ name: item.name, content: xmlStr });
          }
        }
      }

      if (rawXmlEntries.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Nenhum documento fiscal XML legível foi localizado nos arquivos enviados.'
        });
        return;
      }

      console.log(`📦 [EMAIL WEBHOOK] Total de ${rawXmlEntries.length} arquivo(s) XML pronto(s) para validação fiscal.`);

      // 4. Carregar cadastro de empresas ativas para Cruzamento de Carteira
      const allCompanies = db.prepare('SELECT id, cnpj, razao_social, nome_fantasia FROM companies').all() as any[];

      const results: {
        file: string;
        chaveAcesso?: string;
        numero?: string;
        status: 'ingested' | 'ignored' | 'error';
        tipo?: 'saida' | 'entrada';
        company?: string;
        motivo?: string;
      }[] = [];

      let totalIngested = 0;
      let totalIgnored = 0;
      let totalErrors = 0;

      // 5. Ingestão e Processamento de cada XML
      for (const entry of rawXmlEntries) {
        try {
          let xmlContent = entry.content.trim();
          // Remove UTF-8 BOM se presente
          if (xmlContent.charCodeAt(0) === 0xFEFF) {
            xmlContent = xmlContent.substring(1).trim();
          }

          const parsed = parseFiscalXml(xmlContent);
          if (!parsed || !parsed.chaveAcesso) {
            totalErrors++;
            results.push({
              file: entry.name,
              status: 'error',
              motivo: 'Estrutura XML não reconhecida ou ausência de chave de acesso válida.'
            });
            continue;
          }

          const emitCnpj = cleanNumeric(parsed.emitente?.cnpjCpf || '');
          const destCnpj = cleanNumeric(parsed.destinatario?.cnpjCpf || '');

          // Cruzar com as empresas da Viacont
          const compEmit = allCompanies.find(c => isSameCompany(c.cnpj, emitCnpj));
          const compDest = allCompanies.find(c => isSameCompany(c.cnpj, destCnpj));

          if (!compEmit && !compDest) {
            totalIgnored++;
            results.push({
              file: entry.name,
              chaveAcesso: parsed.chaveAcesso,
              numero: parsed.numero,
              status: 'ignored',
              motivo: `CNPJ do emitente (${emitCnpj}) e destinatário (${destCnpj}) não pertencem à carteira de empresas cadastradas no ViaNFe.`
            });
            continue;
          }

          // Se o emitente é nosso cliente -> Venda (Saída)
          // Se o destinatário é nosso cliente -> Compra (Entrada)
          const targetCompany = compEmit || compDest;
          const tipo = compEmit ? 'saida' : 'entrada';

          // Executa ingestão com preservação de estado, cálculo de impostos, DANFE PDF e upload Drive
          const ingestRes = await sefazService.ingestXml(targetCompany.id, xmlContent, 'upload');

          totalIngested++;
          results.push({
            file: entry.name,
            chaveAcesso: parsed.chaveAcesso,
            numero: parsed.numero,
            status: 'ingested',
            tipo,
            company: targetCompany.razao_social,
            motivo: `Nota ${ingestRes.action === 'created' ? 'gravada' : 'atualizada'} com sucesso.`
          });
        } catch (itemErr: any) {
          totalErrors++;
          results.push({
            file: entry.name,
            status: 'error',
            motivo: itemErr.message
          });
        }
      }

      console.log(`✅ [EMAIL WEBHOOK] Processamento concluído: ${totalIngested} ingeridas, ${totalIgnored} ignoradas (fora da carteira), ${totalErrors} erros.`);

      res.status(200).json({
        success: true,
        message: `Lote processado com sucesso: ${totalIngested} nota(s) ingerida(s), ${totalIgnored} ignorada(s), ${totalErrors} erro(s).`,
        summary: {
          totalFiles: rawXmlEntries.length,
          totalIngested,
          totalIgnored,
          totalErrors
        },
        results
      });
    } catch (err: any) {
      console.error('❌ [EMAIL WEBHOOK] Erro inesperado ao processar webhook:', err);
      res.status(500).json({
        success: false,
        error: `Falha interna no processamento do webhook: ${err.message}`
      });
    }
  };
}

export const webhookController = new WebhookController();
