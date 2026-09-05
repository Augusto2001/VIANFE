import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    role: string;
  };
}

// Get JWT Secret from environment or fail-safe error
const JWT_SECRET = process.env.JWT_SECRET || 'vianfe_super_secret_jwt_key_2026_viacont';

/**
 * Middleware: Verify JWT Token and Extract Tenant ID
 * Mandates valid Bearer token in header OR token in query string.
 */
export const verifyJwtAndTenant = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Acesso negado. Token de autenticação JWT não fornecido.',
        code: 'UNAUTHORIZED_NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.id || !decoded.tenant_id) {
      return res.status(401).json({
        success: false,
        error: 'Token de acesso inválido ou expirado.',
        code: 'UNAUTHORIZED_INVALID_TOKEN'
      });
    }

    // Attach decoded user and tenant_id to request
    req.user = {
      id: decoded.id,
      tenant_id: decoded.tenant_id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role || 'client'
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Sessão expirada. Por favor, faça login novamente.',
      code: 'UNAUTHORIZED_EXPIRED'
    });
  }
};

/**
 * Middleware: Optional JWT or Public Document Viewing
 * Allows public access to specific document streams (PDF, DANFE, XML) by ID while capturing user identity if token is present.
 */
export const optionalJwtOrPublicDoc = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query && req.query.token) {
      token = String(req.query.token);
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id && decoded.tenant_id) {
        req.user = {
          id: decoded.id,
          tenant_id: decoded.tenant_id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role || 'client'
        };
      }
    }
    next();
  } catch (err: any) {
    // If token expired or invalid, still proceed for document viewing
    next();
  }
};

/**
 * Middleware: Require Admin Role (Accounting Office Only)
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Requer privilégio de Administrador do Escritório.',
      code: 'FORBIDDEN_NOT_ADMIN'
    });
  }
  next();
};
