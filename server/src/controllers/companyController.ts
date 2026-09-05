import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db, CERTS_DIR } from '../database/db.js';
import { cleanNumeric, encryptText } from '../utils/crypto.js';
import { validatePfxCertificate } from '../utils/pfxLoader.js';
import { sefazDfeClient } from '../services/sefazDfeClient.js';

export const companyController = {
  /**
   * List all registered client companies
   */
  async list(req: Request, res: Response) {
    try {
      const companies = db.prepare(`
        SELECT 
          c.*,
          g.folder_id as gdrive_folder_id,
          g.folder_name as gdrive_folder_name,
          g.sync_frequency as gdrive_sync_frequency,
          g.is_active as gdrive_active,
          g.last_sync_status as gdrive_last_status,
          (SELECT COUNT(*) FROM invoices WHERE company_id = c.id) as total_invoices,
          (SELECT COUNT(*) FROM invoices WHERE company_id = c.id AND gdrive_synced = 1) as total_synced_invoices,
          (SELECT COALESCE(SUM(valor_total), 0) FROM invoices WHERE company_id = c.id) as total_volume_financeiro
        FROM companies c
        LEFT JOIN gdrive_configs g ON c.id = g.company_id
        ORDER BY c.razao_social ASC
      `).all();

      return res.json({ success: true, data: companies });
    } catch (err: any) {
      console.error('Error listing companies:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Get single company details
   */
  async getById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const company = db.prepare(`
        SELECT c.*, g.folder_id as gdrive_folder_id, g.folder_name as gdrive_folder_name, g.sync_frequency, g.is_active as gdrive_active
        FROM companies c
        LEFT JOIN gdrive_configs g ON c.id = g.company_id
        WHERE c.id = ?
      `).get(id);

      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      return res.json({ success: true, data: company });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Create a new client company
   */
  async create(req: Request, res: Response) {
    try {
      const {
        cnpj, razao_social, nome_fantasia, ie, uf, email, telefone, sefaz_ambiente, 
        gdrive_folder_name, sync_frequency, inscricao_municipal, item_servico_padrao,
        cnae_padrao, codigo_tributacao_municipio, emite_nfse, nfse_tipo_auth,
        nfse_usuario_prefeitura, nfse_senha_prefeitura, nfse_prefeitura_padrao,
        nfse_aliquota_padrao, nfse_iss_retido_padrao
      } = req.body;

      if (!cnpj || !razao_social || !uf) {
        return res.status(400).json({ success: false, message: 'CNPJ, Razão Social e UF são obrigatórios.' });
      }

      const cleanCnpj = cleanNumeric(String(cnpj));
      if (cleanCnpj.length !== 14) {
        return res.status(400).json({ success: false, message: 'CNPJ inválido (deve conter 14 dígitos).' });
      }

      const existing = db.prepare('SELECT id FROM companies WHERE cnpj = ?').get(cleanCnpj);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Já existe uma empresa cadastrada com este CNPJ.' });
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO companies (
          id, cnpj, razao_social, nome_fantasia, ie, uf, email, telefone,
          status, sefaz_ambiente, inscricao_municipal, item_servico_padrao,
          cnae_padrao, codigo_tributacao_municipio, emite_nfse, nfse_tipo_auth,
          nfse_usuario_prefeitura, nfse_senha_prefeitura, nfse_prefeitura_padrao,
          nfse_aliquota_padrao, nfse_iss_retido_padrao, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          'ativo', ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        id,
        cleanCnpj,
        String(razao_social).trim(),
        nome_fantasia ? String(nome_fantasia).trim() : null,
        ie ? String(ie).trim() : null,
        String(uf).trim().toUpperCase(),
        email ? String(email).trim() : null,
        telefone ? String(telefone).trim() : null,
        sefaz_ambiente ? String(sefaz_ambiente) : 'producao',
        inscricao_municipal ? String(inscricao_municipal).trim() : null,
        item_servico_padrao ? String(item_servico_padrao).trim() : '17.01',
        cnae_padrao ? String(cnae_padrao).trim() : null,
        codigo_tributacao_municipio ? String(codigo_tributacao_municipio).trim() : null,
        emite_nfse ? 1 : 0,
        nfse_tipo_auth || 'certificado',
        nfse_usuario_prefeitura ? String(nfse_usuario_prefeitura).trim() : null,
        (nfse_senha_prefeitura && String(nfse_senha_prefeitura).trim().length > 0) ? encryptText(String(nfse_senha_prefeitura).trim()) : null,
        nfse_prefeitura_padrao || 'Salvador',
        Number(nfse_aliquota_padrao || 5.0),
        nfse_iss_retido_padrao ? 1 : 0,
        now,
        now
      );

      // Create initial Google Drive config
      const gdriveConfigId = uuidv4();
      db.prepare(`
        INSERT INTO gdrive_configs (
          id, company_id, folder_name, sync_frequency, is_active, last_sync_status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 1, 'never', ?, ?
        )
      `).run(
        gdriveConfigId,
        id,
        gdrive_folder_name ? String(gdrive_folder_name) : `Contabilidade/${String(razao_social).trim().replace(/[\/\\:*?"<>|]/g, '_')}`,
        sync_frequency ? String(sync_frequency) : 'daily',
        now,
        now
      );

      const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      return res.status(201).json({ success: true, data: created, message: 'Empresa cadastrada com sucesso!' });
    } catch (err: any) {
      console.error('Error creating company:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Update client company
   */
  async update(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { 
        razao_social, nome_fantasia, ie, uf, email, telefone, status, sefaz_ambiente, 
        gdrive_folder_name, sync_frequency, gdrive_active, inscricao_municipal, 
        item_servico_padrao, cnae_padrao, codigo_tributacao_municipio, emite_nfse, 
        nfse_tipo_auth, nfse_usuario_prefeitura, nfse_senha_prefeitura, 
        nfse_prefeitura_padrao, nfse_aliquota_padrao, nfse_iss_retido_padrao 
      } = req.body;

      const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE companies SET
          razao_social = COALESCE(?, razao_social),
          nome_fantasia = COALESCE(?, nome_fantasia),
          ie = COALESCE(?, ie),
          uf = COALESCE(?, uf),
          email = COALESCE(?, email),
          telefone = COALESCE(?, telefone),
          status = COALESCE(?, status),
          sefaz_ambiente = COALESCE(?, sefaz_ambiente),
          inscricao_municipal = COALESCE(?, inscricao_municipal),
          item_servico_padrao = COALESCE(?, item_servico_padrao),
          cnae_padrao = COALESCE(?, cnae_padrao),
          codigo_tributacao_municipio = COALESCE(?, codigo_tributacao_municipio),
          emite_nfse = COALESCE(?, emite_nfse),
          nfse_tipo_auth = COALESCE(?, nfse_tipo_auth),
          nfse_usuario_prefeitura = COALESCE(?, nfse_usuario_prefeitura),
          nfse_senha_prefeitura = COALESCE(?, nfse_senha_prefeitura),
          nfse_prefeitura_padrao = COALESCE(?, nfse_prefeitura_padrao),
          nfse_aliquota_padrao = COALESCE(?, nfse_aliquota_padrao),
          nfse_iss_retido_padrao = COALESCE(?, nfse_iss_retido_padrao),
          updated_at = ?
        WHERE id = ?
      `).run(
        razao_social ? String(razao_social).trim() : null,
        nome_fantasia ? String(nome_fantasia).trim() : null,
        ie ? String(ie).trim() : null,
        uf ? String(uf).trim().toUpperCase() : null,
        email ? String(email).trim() : null,
        telefone ? String(telefone).trim() : null,
        status ? String(status) : null,
        sefaz_ambiente ? String(sefaz_ambiente) : null,
        inscricao_municipal !== undefined ? (inscricao_municipal ? String(inscricao_municipal).trim() : null) : null,
        item_servico_padrao ? String(item_servico_padrao).trim() : null,
        cnae_padrao ? String(cnae_padrao).trim() : null,
        codigo_tributacao_municipio ? String(codigo_tributacao_municipio).trim() : null,
        emite_nfse !== undefined ? (emite_nfse ? 1 : 0) : null,
        nfse_tipo_auth ? String(nfse_tipo_auth) : null,
        nfse_usuario_prefeitura !== undefined ? (nfse_usuario_prefeitura ? String(nfse_usuario_prefeitura).trim() : null) : null,
        (nfse_senha_prefeitura && String(nfse_senha_prefeitura).trim().length > 0) ? encryptText(String(nfse_senha_prefeitura).trim()) : null,
        nfse_prefeitura_padrao ? String(nfse_prefeitura_padrao) : null,
        nfse_aliquota_padrao !== undefined ? Number(nfse_aliquota_padrao) : null,
        nfse_iss_retido_padrao !== undefined ? (nfse_iss_retido_padrao ? 1 : 0) : null,
        now,
        id
      );

      // Update Drive config
      if (gdrive_folder_name !== undefined || sync_frequency !== undefined || gdrive_active !== undefined) {
        db.prepare(`
          UPDATE gdrive_configs SET
            folder_name = COALESCE(?, folder_name),
            sync_frequency = COALESCE(?, sync_frequency),
            is_active = COALESCE(?, is_active),
            updated_at = ?
          WHERE company_id = ?
        `).run(
          gdrive_folder_name ? String(gdrive_folder_name) : null,
          sync_frequency ? String(sync_frequency) : null,
          gdrive_active !== undefined ? (gdrive_active ? 1 : 0) : null,
          now,
          id
        );
      }

      const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      return res.json({ success: true, data: updated, message: 'Empresa atualizada com sucesso!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Delete client company
   */
  async delete(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      // Delete certificate file if exists
      if (company.cert_filename) {
        const certPath = path.join(CERTS_DIR, company.cert_filename);
        if (fs.existsSync(certPath)) {
          fs.unlinkSync(certPath);
        }
      }

      db.prepare('DELETE FROM companies WHERE id = ?').run(id);
      return res.json({ success: true, message: `Empresa ${company.razao_social} excluída com sucesso.` });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Upload A1 Digital Certificate (.pfx / .p12) with Pre-Upload CNPJ & Expiration Validation
   */
  async uploadCertificate(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { password } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, message: 'Arquivo do certificado (.pfx/.p12) é obrigatório.' });
      }

      const company = db.prepare('SELECT id, cnpj, razao_social FROM companies WHERE id = ?').get(id) as any;
      if (!company) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      const pfxBuffer = fs.readFileSync(file.path);
      const certValidation = validatePfxCertificate(pfxBuffer, password || '');

      if (!certValidation.valid) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          message: `Certificado A1 inválido: ${certValidation.error || 'Verifique a senha informada.'}`
        });
      }

      // Check Expiration
      if (certValidation.validTo && new Date(certValidation.validTo).getTime() < Date.now()) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          message: `CERTIFICADO VENCIDO. O certificado A1 expirou em ${new Date(certValidation.validTo).toLocaleDateString('pt-BR')}.`
        });
      }

      // Validate CNPJ matching
      const companyCnpj = company.cnpj.replace(/\D/g, '');
      if (certValidation.extractedCnpj) {
        const certCnpj = certValidation.extractedCnpj.replace(/\D/g, '');
        if (certCnpj.length === 14 && certCnpj !== companyCnpj) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({
            success: false,
            message: `CNPJ DIVERGENTE DO CADASTRO! O CNPJ do titular no certificado (${certValidation.extractedCnpj}) não coincide com o CNPJ da empresa (${company.cnpj}).`
          });
        }
      }

      const newCertFilename = `cert_${id}_${Date.now()}.pfx`;
      const targetPath = path.join(CERTS_DIR, newCertFilename);

      // Safe cross-device copy (prevents EXDEV error across docker volumes)
      fs.copyFileSync(file.path, targetPath);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      const encPassword = password ? encryptText(String(password)) : null;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE companies SET
          cert_filename = ?,
          cert_password_enc = ?,
          cert_valid_until = ?,
          updated_at = ?
        WHERE id = ?
      `).run(newCertFilename, encPassword, certValidation.validTo || null, now, id);

      return res.json({
        success: true,
        message: 'Certificado Digital A1 validado, vinculado à empresa e criptografado em repouso com sucesso!',
        validUntil: certValidation.validTo,
        subject: certValidation.subject
      });
    } catch (err: any) {
      console.error('Error uploading certificate:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Search CNPJ online — tries multiple public APIs with fallback
   * BrasilAPI blocks server-side requests (403), so we use ReceitaWS + CNPJA as fallbacks
   */
  async searchCnpj(req: Request, res: Response) {
    try {
      const cnpj = String(req.params.cnpj);
      const clean = cleanNumeric(cnpj);

      if (clean.length !== 14) {
        return res.status(400).json({ success: false, message: 'CNPJ deve conter 14 dígitos.' });
      }

      // Helper to build normalized response
      const buildResponse = (data: any, source: string) => ({
        success: true,
        source,
        data: {
          cnpj: clean,
          razao_social: data.razao_social || data.nome || data.company?.name || '',
          nome_fantasia: data.nome_fantasia || data.fantasia || data.alias || data.company?.name || '',
          uf: data.uf || data.estabelecimento?.estado?.sigla || data.address?.state || '',
          municipio: data.municipio || data.estabelecimento?.cidade?.nome || data.address?.city || '',
          logradouro: data.logradouro || data.estabelecimento?.logradouro || data.address?.street || '',
          numero: data.numero || data.estabelecimento?.numero || data.address?.number || '',
          bairro: data.bairro || data.estabelecimento?.bairro || data.address?.district || '',
          cep: data.cep || data.estabelecimento?.cep || data.address?.zip || '',
          email: data.email || data.estabelecimento?.email || data.emails?.[0]?.address || '',
          telefone: data.telefone || data.ddd_telefone_1 || data.estabelecimento?.telefone1 || data.phones?.[0]?.number || '',
          situacao_cadastral: data.situacao || data.descricao_situacao_cadastral || data.status?.text || 'ATIVA',
          cnae_principal: data.atividade_principal?.[0]?.text || data.cnae_fiscal_descricao || data.mainActivity?.text || '',
        }
      });

      // 1. Try ReceitaWS (free, no auth needed, good uptime)
      try {
        const r1 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'application/json', 'User-Agent': 'DFeHub/1.0' }
        });
        if (r1.ok) {
          const d1: any = await r1.json();
          if (d1 && !d1.status?.includes('ERROR') && (d1.nome || d1.razao_social)) {
            return res.json(buildResponse(d1, 'ReceitaWS'));
          }
        }
      } catch (e1: any) {
        console.warn('[CNPJ] ReceitaWS falhou:', e1.message);
      }

      // 2. Try CNPJA (open API, no auth)
      try {
        const r2 = await fetch(`https://open.cnpja.com/office/${clean}`, {
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'application/json', 'User-Agent': 'DFeHub/1.0' }
        });
        if (r2.ok) {
          const d2: any = await r2.json();
          if (d2 && (d2.company?.name || d2.alias)) {
            // CNPJA uses different field names
            const mapped = {
              razao_social: d2.company?.name || '',
              nome_fantasia: d2.alias || d2.company?.name || '',
              uf: d2.address?.state || '',
              municipio: d2.address?.city || '',
              logradouro: d2.address?.street || '',
              numero: d2.address?.number || '',
              bairro: d2.address?.district || '',
              cep: d2.address?.zip || '',
              email: d2.emails?.[0]?.address || '',
              telefone: d2.phones?.[0]?.number || '',
              situacao_cadastral: d2.status?.text || 'ATIVA',
              cnae_principal: d2.mainActivity?.text || '',
            };
            return res.json(buildResponse(mapped, 'CNPJA'));
          }
        }
      } catch (e2: any) {
        console.warn('[CNPJ] CNPJA falhou:', e2.message);
      }

      // 3. Try BrasilAPI (may be rate-limited)
      try {
        const r3 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'application/json', 'User-Agent': 'DFeHub/1.0' }
        });
        if (r3.ok) {
          const d3: any = await r3.json();
          if (d3 && (d3.razao_social || d3.nome)) {
            return res.json(buildResponse(d3, 'BrasilAPI'));
          }
        }
      } catch (e3: any) {
        console.warn('[CNPJ] BrasilAPI falhou:', e3.message);
      }

      return res.status(404).json({ success: false, message: 'CNPJ não localizado nas bases públicas de dados da Receita Federal. Verifique se o CNPJ está correto.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Falha ao consultar CNPJ: ${err.message}` });
    }
  },

  /**
   * Test / Validate the company's A1 certificate
   */
  async testCertificate(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const result = sefazDfeClient.validateCertificate(id);

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Certificado inválido.',
        });
      }

      return res.json({
        success: true,
        message: 'Certificado Digital A1 validado com sucesso! Pronto para consultar a SEFAZ.',
        data: {
          subject: result.subject,
          issuer: result.issuer,
          validTo: result.validTo,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Trigger SEFAZ DFe sync for a specific company
   */
  async syncSefaz(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      if (!company.cert_filename) {
        return res.status(400).json({
          success: false,
          message: 'Esta empresa não possui Certificado Digital A1 cadastrado. Faça o upload do certificado .pfx primeiro.',
        });
      }

      // Validate cert before calling SEFAZ
      const certCheck = sefazDfeClient.validateCertificate(id);
      if (!certCheck.valid) {
        return res.status(400).json({
          success: false,
          message: certCheck.error,
        });
      }

      // Import sefazService dynamically to avoid circular dependency
      const { sefazService } = await import('../services/sefazService.js');
      const result = await sefazService.syncCompany(id, 'manual');

      return res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (err: any) {
      console.error('Error in SEFAZ sync:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};
