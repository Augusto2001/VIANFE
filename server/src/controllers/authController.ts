import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vianfe_super_secret_jwt_key_2026_viacont';

export const authController = {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Informe e-mail e senha para acessar.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.trim().toLowerCase()) as any;

      if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciais inválidas. Verifique o e-mail e senha.' });
      }

      const validPassword = bcrypt.compareSync(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Credenciais inválidas. Verifique a senha.' });
      }

      // Fetch assigned companies for client user
      let assignedCompanyIds: string[] = [];
      if (user.role === 'admin') {
        const allCompanies = db.prepare('SELECT id FROM companies').all() as any[];
        assignedCompanyIds = allCompanies.map(c => c.id);
      } else {
        const userComps = db.prepare('SELECT company_id FROM user_companies WHERE user_id = ?').all(user.id) as any[];
        assignedCompanyIds = userComps.map(c => c.company_id);
      }

      // Update last login
      const now = new Date().toISOString();
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

      // Generate JWT Token (expires in 24h) with tenant_id payload
      const tenantId = user.tenant_id || 'tenant_viacont_master';
      const token = jwt.sign(
        {
          id: user.id,
          tenant_id: tenantId,
          name: user.name,
          email: user.email,
          role: user.role,
          assignedCompanies: assignedCompanyIds,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Login realizado com sucesso!',
        token,
        user: {
          id: user.id,
          tenant_id: tenantId,
          name: user.name,
          email: user.email,
          role: user.role,
          assignedCompanyIds,
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: `Erro ao autenticar: ${err.message}` });
    }
  },

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Não autenticado.' });
      }

      const token = authHeader.split(' ')[1];
      const decoded: any = jwt.verify(token, JWT_SECRET);

      const user = db.prepare('SELECT id, tenant_id, name, email, role, is_active FROM users WHERE id = ?').get(decoded.id) as any;
      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, message: 'Usuário inativo ou não localizado.' });
      }

      let assignedCompanyIds: string[] = [];
      if (user.role === 'admin') {
        const allCompanies = db.prepare('SELECT id FROM companies').all() as any[];
        assignedCompanyIds = allCompanies.map(c => c.id);
      } else {
        const userComps = db.prepare('SELECT company_id FROM user_companies WHERE user_id = ?').all(user.id) as any[];
        assignedCompanyIds = userComps.map(c => c.company_id);
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          tenant_id: user.tenant_id || 'tenant_viacont_master',
          name: user.name,
          email: user.email,
          role: user.role,
          assignedCompanyIds,
        },
      });
    } catch (err: any) {
      return res.status(401).json({ success: false, message: 'Sessão expirada. Faça login novamente.' });
    }
  },

  /**
   * POST /api/auth/forgot-password
   * E-Mail Password Reset Request (Admin & Users)
   */
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Informe o e-mail cadastrado.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND is_active = 1').get(cleanEmail) as any;

      if (!user) {
        // Return success message to prevent user enumeration attacks
        return res.json({
          success: true,
          message: 'Se o e-mail estiver cadastrado, as instruções de redefinição serão enviadas.'
        });
      }

      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // Expire in 30 minutes
      const resetId = `reset_${Date.now()}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO password_resets (id, user_id, email, token, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `).run(resetId, user.id, user.email, resetToken, expiresAt, now);

      console.log(`🔑 [SECURITY] Password reset token generated for ${user.email}: ${resetToken}`);

      return res.json({
        success: true,
        message: 'Instruções e token de redefinição de senha enviados para o e-mail cadastrado.',
        resetToken // In production sent via SMTP email link
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao solicitar recuperação: ${err.message}` });
    }
  },

  /**
   * POST /api/auth/reset-password
   * Complete Password Reset with Security Token
   */
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'Token e nova senha (mínimo 6 caracteres) são obrigatórios.' });
      }

      const resetRecord = db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').get(token) as any;
      if (!resetRecord) {
        return res.status(400).json({ success: false, message: 'Token de redefinição inválido ou já utilizado.' });
      }

      if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ success: false, message: 'Token de redefinição expirado (validade de 30 minutos excedida).' });
      }

      // Hash new password using Bcrypt Salt 12
      const salt = bcrypt.genSaltSync(12);
      const newHash = bcrypt.hashSync(newPassword.trim(), salt);
      const now = new Date().toISOString();

      // Update user password and mark token as used
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, resetRecord.user_id);
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

      console.log(`✅ [SECURITY] Password successfully updated for user_id: ${resetRecord.user_id}`);

      return res.json({
        success: true,
        message: 'Senha alterada com sucesso! Você já pode realizar login com a nova senha.'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: `Erro ao redefinir senha: ${err.message}` });
    }
  }
};
