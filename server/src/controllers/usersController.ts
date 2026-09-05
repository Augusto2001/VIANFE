import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';

export const usersController = {
  /**
   * GET /api/users — List all users (Admin only)
   */
  async listUsers(req: Request, res: Response) {
    try {
      const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.is_active, u.last_login_at, u.created_at
        FROM users u
        ORDER BY u.created_at DESC
      `).all() as any[];

      for (const u of users) {
        if (u.role === 'admin') {
          u.companyNames = ['Todas as Empresas (Admin Master)'];
        } else if (u.role === 'staff') {
          u.companyNames = ['Todas as Empresas do Escritório (Equipe Fiscal/Contábil)'];
        } else {
          const comps = db.prepare(`
            SELECT c.razao_social 
            FROM user_companies uc 
            JOIN companies c ON uc.company_id = c.id 
            WHERE uc.user_id = ?
          `).all(u.id) as any[];
          u.companyNames = comps.map(c => c.razao_social);
        }
      }

      return res.json({ success: true, users });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao listar usuários: ${err.message}` });
    }
  },

  /**
   * POST /api/users — Create new user (Admin only)
   */
  async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, role = 'staff', companyIds = [] } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios.' });
      }

      if (password.trim().length < 4) {
        return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 4 caracteres.' });
      }

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: 'E-mail já cadastrado no sistema.' });
      }

      const id = `usr_${uuidv4()}`;
      const passwordHash = bcrypt.hashSync(password.trim(), 10);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, name.trim(), email.trim().toLowerCase(), passwordHash, role, now, now);

      // Associate assigned companies for client users
      if (role === 'client' && Array.isArray(companyIds)) {
        const stmt = db.prepare('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)');
        for (const cid of companyIds) {
          try {
            stmt.run(id, cid);
          } catch (e) {
            // Ignore duplicate insert
          }
        }
      }

      return res.json({ success: true, message: `Usuário "${name}" criado com sucesso!`, userId: id });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao criar usuário: ${err.message}` });
    }
  },

  /**
   * PUT /api/users/:id/password — Master direct password change
   */
  async updatePassword(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.trim().length < 4) {
        return res.status(400).json({ success: false, message: 'Informe uma nova senha com no mínimo 4 caracteres.' });
      }

      const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id) as any;
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuário não localizado.' });
      }

      const passwordHash = bcrypt.hashSync(newPassword.trim(), 10);
      const now = new Date().toISOString();

      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, id);

      console.log(`🔑 [MASTER SECURITY] Senha alterada diretamente pelo Master para o usuário: ${user.email}`);

      return res.json({
        success: true,
        message: `Senha do usuário "${user.name}" atualizada com sucesso!`
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao alterar senha: ${err.message}` });
    }
  },

  /**
   * DELETE /api/users/:id
   */
  async deleteUser(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (id === 'usr_admin_viacont_master') {
        return res.status(400).json({ success: false, message: 'Não é possível excluir o Administrador Master Viacont.' });
      }

      db.prepare('DELETE FROM user_companies WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return res.json({ success: true, message: 'Usuário removido com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao remover usuário: ${err.message}` });
    }
  },
};
