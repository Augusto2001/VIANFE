import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db.js';

export function nfseAccess(req: Request, res: Response, next: NextFunction) {
  if (!process.env.JWT_SECRET || ['vianfe_super_secret_jwt_key_2026_viacont','vianfe_viacont_fiscal_jwt_secret_key_2026'].includes(process.env.JWT_SECRET)) { res.status(503).json({error:'Autenticação fiscal não configurada com segredo privado.'}); return; }
  const identity=(req as any).user;
  const user=identity && db.prepare('SELECT id, tenant_id, role FROM users WHERE id=? AND tenant_id=? AND is_active=1').get(identity.id,identity.tenant_id) as any;
  if (!user) { res.status(403).json({error:'Usuário sem acesso ativo.'}); return; }
  let companyId=req.body?.company_id || req.query.company_id;
  if (req.params.id) {
    const record=db.prepare('SELECT company_id FROM nfse_issued WHERE id=?').get(String(req.params.id)) as any;
    companyId=record?.company_id;
    if (!companyId) companyId=(db.prepare('SELECT company_id FROM nfse_recurring_clients WHERE id=?').get(String(req.params.id)) as any)?.company_id;
  } else if(req.path.endsWith('/webhook-whatsapp')) {
    const company=db.prepare('SELECT id FROM companies WHERE cnpj=? AND tenant_id=?').get(String(req.body?.company_cnpj || '').replace(/\D/g,''),user.tenant_id) as any;
    companyId=company?.id;
  }
  const company=companyId && db.prepare('SELECT id FROM companies WHERE id=? AND tenant_id=?').get(String(companyId),user.tenant_id);
  const assigned=company && (user.role==='admin' || db.prepare('SELECT 1 FROM user_companies WHERE user_id=? AND company_id=?').get(user.id,String(companyId)));
  if (!assigned) { res.status(403).json({error:'Empresa não identificada ou não autorizada para este usuário.'}); return; }
  next();
}
