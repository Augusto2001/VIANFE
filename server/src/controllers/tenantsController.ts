import { Request, Response } from 'express';
import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export const tenantsController = {
  // 1. List all accounting offices (Tenants)
  async listTenants(req: Request, res: Response): Promise<void> {
    try {
      const tenants = db.prepare(`
        SELECT 
          t.*,
          (SELECT COUNT(*) FROM companies c WHERE c.tenant_id = t.id) as total_companies,
          (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as total_users,
          (SELECT COUNT(*) FROM invoices i JOIN companies c ON i.company_id = c.id WHERE c.tenant_id = t.id) as total_invoices
        FROM tenants t
        ORDER BY t.created_at DESC
      `).all() as any[];

      res.json({ success: true, data: tenants });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 2. Create a new partner accounting office (Tenant + Master Admin User)
  async createTenant(req: Request, res: Response): Promise<void> {
    try {
      const { name, cnpj, admin_name, admin_email, admin_password, plan } = req.body;

      if (!name || !admin_email || !admin_password) {
        res.status(400).json({ error: 'Nome do escritório, e-mail do admin e senha são obrigatórios' });
        return;
      }

      // Check if email already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(admin_email);
      if (existingUser) {
        res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema' });
        return;
      }

      const tenantId = `tenant_${uuidv4().substring(0, 8)}`;
      const userId = uuidv4();
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(admin_password, salt);

      // 1. Create Tenant
      db.prepare(`
        INSERT INTO tenants (id, name, cnpj, plan, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ativo', datetime('now'), datetime('now'))
      `).run(tenantId, name, cnpj || '', plan || 'pro');

      // 2. Create Admin User for this Tenant
      db.prepare(`
        INSERT INTO users (id, tenant_id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'admin', 1, datetime('now'), datetime('now'))
      `).run(userId, tenantId, admin_name || name, admin_email, passwordHash);

      const created = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);

      res.json({
        success: true,
        message: 'Escritório parceiro e usuário administrador criados com sucesso!',
        data: created
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 3. Update tenant
  async updateTenant(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { name, cnpj, plan, status } = req.body;

      db.prepare(`
        UPDATE tenants 
        SET name = COALESCE(?, name),
            cnpj = COALESCE(?, cnpj),
            plan = COALESCE(?, plan),
            status = COALESCE(?, status),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(name, cnpj, plan, status, id);

      const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
      res.json({ success: true, message: 'Escritório atualizado com sucesso!', data: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // 4. Delete / Deactivate tenant
  async deleteTenant(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      if (id === 'tenant_viacont_master') {
        res.status(400).json({ error: 'O escritório master Viacont não pode ser excluído.' });
        return;
      }

      db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
      res.json({ success: true, message: 'Escritório parceiro removido com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
};
