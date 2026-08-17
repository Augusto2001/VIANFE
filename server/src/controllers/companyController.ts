import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db, CERTS_DIR } from '../database/db.js';
import { cleanNumeric, encryptText } from '../utils/crypto.js';

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
      const { cnpj, razao_social, nome_fantasia, ie, uf, email, telefone, sefaz_ambiente, gdrive_folder_name, sync_frequency } = req.body;

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
          status, sefaz_ambiente, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          'ativo', ?, ?, ?
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
      const { razao_social, nome_fantasia, ie, uf, email, telefone, status, sefaz_ambiente, gdrive_folder_name, sync_frequency, gdrive_active } = req.body;

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
   * Upload A1 Digital Certificate (.pfx / .p12)
   */
  async uploadCertificate(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { password } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, message: 'Arquivo do certificado (.pfx/.p12) é obrigatório.' });
      }

      const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
      if (!company) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      const newCertFilename = `cert_${id}_${Date.now()}.pfx`;
      const targetPath = path.join(CERTS_DIR, newCertFilename);

      fs.renameSync(file.path, targetPath);

      const encPassword = password ? encryptText(String(password)) : null;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE companies SET
          cert_filename = ?,
          cert_password_enc = ?,
          updated_at = ?
        WHERE id = ?
      `).run(newCertFilename, encPassword, now, id);

      return res.json({
        success: true,
        message: 'Certificado Digital A1 importado com sucesso e criptografado em repouso!'
      });
    } catch (err: any) {
      console.error('Error uploading certificate:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Search CNPJ online (BrasilAPI / ReceitaWS) for instant auto-fill
   */
  async searchCnpj(req: Request, res: Response) {
    try {
      const cnpj = String(req.params.cnpj);
      const clean = cleanNumeric(cnpj);

      if (clean.length !== 14) {
        return res.status(400).json({ success: false, message: 'CNPJ deve conter 14 dígitos.' });
      }

      // Query BrasilAPI
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!response.ok) {
        return res.status(404).json({ success: false, message: 'CNPJ não localizado na base pública.' });
      }

      const data: any = await response.json();
      return res.json({
        success: true,
        data: {
          cnpj: data.cnpj,
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia || data.razao_social,
          uf: data.uf,
          municipio: data.municipio,
          logradouro: data.logradouro,
          numero: data.numero,
          bairro: data.bairro,
          cep: data.cep,
          email: data.email,
          telefone: data.ddd_telefone_1,
          cnae_principal: data.cnae_fiscal_descricao,
          situacao_cadastral: data.descricao_situacao_cadastral
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Falha ao consultar CNPJ: ${err.message}` });
    }
  }
};
