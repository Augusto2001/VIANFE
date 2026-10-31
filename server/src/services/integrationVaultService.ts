import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db.js';
import { encryptText, decryptText } from '../utils/crypto.js';

export interface IntegrationCredential {
  id: string;
  platform: 'hiper' | 'conta_azul' | 'pluggy' | 'sefaz';
  tenant_id: string;
  username: string;
  password?: string;
  extra_json?: any;
  status: 'ativo' | 'erro_auth' | 'pausado';
  last_sync_at?: string;
  last_sync_status?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export class IntegrationVaultService {
  /**
   * Armazena ou atualiza credencial criptografada no cofre seguro
   */
  public saveCredential(
    platform: 'hiper' | 'conta_azul' | 'pluggy' | 'sefaz',
    username: string,
    passwordPlain: string,
    extra: any = {},
    tenantId: string = 'tenant_viacont_master'
  ): IntegrationCredential {
    const now = new Date().toISOString();
    const existing = db.prepare(
      'SELECT id FROM integration_credentials WHERE platform = ? AND tenant_id = ?'
    ).get(platform, tenantId) as any;

    const passwordEnc = encryptText(passwordPlain);
    const extraStr = JSON.stringify(extra);

    if (existing) {
      db.prepare(`
        UPDATE integration_credentials
        SET username = ?, password_enc = ?, extra_json = ?, status = 'ativo', last_error = NULL, updated_at = ?
        WHERE id = ?
      `).run(username, passwordEnc, extraStr, now, existing.id);

      return {
        id: existing.id,
        platform,
        tenant_id: tenantId,
        username,
        extra_json: extra,
        status: 'ativo',
        created_at: now,
        updated_at: now
      };
    } else {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO integration_credentials (
          id, platform, tenant_id, username, password_enc, extra_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?, ?)
      `).run(id, platform, tenantId, username, passwordEnc, extraStr, now, now);

      return {
        id,
        platform,
        tenant_id: tenantId,
        username,
        extra_json: extra,
        status: 'ativo',
        created_at: now,
        updated_at: now
      };
    }
  }

  /**
   * Recupera a credencial decriptografada para uso exclusivo dos robôs de extração
   */
  public getCredential(
    platform: 'hiper' | 'conta_azul' | 'pluggy' | 'sefaz',
    tenantId: string = 'tenant_viacont_master'
  ): { username: string; password: string; extra: any; status: string; id: string } | null {
    const row = db.prepare(
      'SELECT id, username, password_enc, extra_json, status FROM integration_credentials WHERE platform = ? AND tenant_id = ?'
    ).get(platform, tenantId) as any;

    if (!row) return null;

    const password = decryptText(row.password_enc);
    let extra = {};
    try {
      extra = row.extra_json ? JSON.parse(row.extra_json) : {};
    } catch (_) {}

    return {
      id: row.id,
      username: row.username,
      password,
      extra,
      status: row.status
    };
  }

  /**
   * Atualiza o log e status de sincronização
   */
  public recordSyncResult(
    id: string,
    success: boolean,
    message?: string,
    extraUpdates?: any
  ): void {
    const now = new Date().toISOString();
    const status = success ? 'ativo' : 'erro_auth';
    const lastSyncStatus = success ? 'sucesso' : 'falha';

    if (extraUpdates) {
      db.prepare(`
        UPDATE integration_credentials
        SET status = ?, last_sync_at = ?, last_sync_status = ?, last_error = ?, extra_json = ?, updated_at = ?
        WHERE id = ?
      `).run(status, now, lastSyncStatus, message || null, JSON.stringify(extraUpdates), now, id);
    } else {
      db.prepare(`
        UPDATE integration_credentials
        SET status = ?, last_sync_at = ?, last_sync_status = ?, last_error = ?, updated_at = ?
        WHERE id = ?
      `).run(status, now, lastSyncStatus, message || null, now, id);
    }
  }

  /**
   * Lista o status geral das integrações cadastradas (sem expor senhas)
   */
  public listIntegrations(tenantId: string = 'tenant_viacont_master'): any[] {
    return db.prepare(`
      SELECT id, platform, username, status, last_sync_at, last_sync_status, last_error, updated_at
      FROM integration_credentials
      WHERE tenant_id = ?
    `).all(tenantId);
  }
}

export const integrationVaultService = new IntegrationVaultService();
