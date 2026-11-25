import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';
import { AuthenticatedRequest } from './authMiddleware.js';

const INSECURE_JWT_DEFAULTS = new Set([
  'vianfe_super_secret_jwt_key_2026_viacont',
  'vianfe_viacont_fiscal_jwt_secret_key_2026'
]);

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware dedicado de autenticação para rotas /api/nfse/pedidos*.
 * Regras (Fase 1 / NFSE_EMISSAO_SEGURA):
 * - Exige cabeçalho Authorization: Bearer <token> (não aceita token na URL/querystring).
 * - Exige JWT_SECRET privado configurado no servidor.
 * - Aceita:
 *   1) Token de serviço dedicado (NFSE_ORDERS_SERVICE_TOKEN >= 24 chars), sem acesso a /api/portal/nfse/emit;
 *   2) JWT de serviço com { type: 'service', scope: 'nfse:orders', tenant_id };
 *   3) JWT de usuário ativo do ViaNFe (validado em users.is_active = 1).
 */
export function requireNfseOrderAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || INSECURE_JWT_DEFAULTS.has(jwtSecret)) {
    return res.status(503).json({
      sucesso: false,
      erro: 'Autenticação de pedidos NFS-e não configurada com segredo privado.'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso negado. Credencial Bearer obrigatória no cabeçalho Authorization.',
      codigo: 'UNAUTHORIZED_NO_TOKEN'
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso negado. Token Bearer vazio.',
      codigo: 'UNAUTHORIZED_EMPTY_TOKEN'
    });
  }

  // 1. Token de serviço dedicado (ex.: ponte n8n autenticada via credencial segura)
  const serviceToken = (process.env.NFSE_ORDERS_SERVICE_TOKEN || '').trim();
  if (serviceToken.length >= 24 && safeEqual(token, serviceToken)) {
    req.user = {
      id: 'svc_nfse_orders',
      tenant_id: process.env.NFSE_ORDERS_TENANT_ID || 'tenant_viacont_master',
      name: 'Serviço Pedidos NFS-e',
      email: 'atendimento@viacont.com.br',
      role: 'service'
    };
    return next();
  }

  // 2. JWT assinado com JWT_SECRET privado do ViaNFe
  try {
    const decoded = jwt.verify(token, jwtSecret) as any;

    if (decoded && decoded.type === 'service' && decoded.scope === 'nfse:orders' && decoded.tenant_id) {
      req.user = {
        id: String(decoded.sub || decoded.id || 'svc_nfse_orders'),
        tenant_id: String(decoded.tenant_id),
        name: String(decoded.name || 'Serviço Pedidos NFS-e'),
        email: String(decoded.email || 'atendimento@viacont.com.br'),
        role: 'service'
      };
      return next();
    }

    if (!decoded || !decoded.id || !decoded.tenant_id) {
      return res.status(401).json({
        sucesso: false,
        erro: 'Token inválido.',
        codigo: 'UNAUTHORIZED_INVALID_TOKEN'
      });
    }

    const activeUser = db
      .prepare('SELECT id, tenant_id, name, email, role FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1')
      .get(decoded.id, decoded.tenant_id) as any;

    if (!activeUser) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Usuário sem acesso ativo.',
        codigo: 'FORBIDDEN_INACTIVE_USER'
      });
    }

    req.user = {
      id: activeUser.id,
      tenant_id: activeUser.tenant_id,
      name: activeUser.name,
      email: activeUser.email,
      role: activeUser.role || 'client'
    };
    return next();
  } catch {
    return res.status(401).json({
      sucesso: false,
      erro: 'Credencial inválida ou expirada.',
      codigo: 'UNAUTHORIZED_EXPIRED'
    });
  }
}
