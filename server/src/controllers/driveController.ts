import { Request, Response } from 'express';
import { googleDriveService } from '../services/googleDriveService.js';
import { db } from '../database/db.js';

export const driveController = {
  /**
   * Get Google Drive connection status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const status = googleDriveService.getStatus();
      return res.json({ success: true, data: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Save Google Service Account or OAuth credentials
   */
  async saveCredentials(req: Request, res: Response) {
    try {
      const credentialsJson = String(req.body.credentialsJson || '');
      if (!credentialsJson) {
        return res.status(400).json({ success: false, message: 'JSON de credenciais é obrigatório.' });
      }

      const result = googleDriveService.saveCredentials(credentialsJson);
      return res.json({ success: true, message: result.message });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },

  /**
   * List folders in Google Drive
   */
  async listFolders(req: Request, res: Response) {
    try {
      const parentId = String(req.query.parentId || 'root');
      const folders = await googleDriveService.listFolders(parentId);
      return res.json({ success: true, data: folders });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * List synchronization audit logs
   */
  async getLogs(req: Request, res: Response) {
    try {
      const company_id = req.query.company_id ? String(req.query.company_id) : '';
      const limit = Number(req.query.limit || 50);

      let logs: any[];
      if (company_id) {
        logs = db.prepare(`
          SELECT l.*, c.razao_social as company_name
          FROM sync_logs l
          JOIN companies c ON l.company_id = c.id
          WHERE l.company_id = ?
          ORDER BY l.executed_at DESC
          LIMIT ?
        `).all(company_id, limit);
      } else {
        logs = db.prepare(`
          SELECT l.*, c.razao_social as company_name
          FROM sync_logs l
          JOIN companies c ON l.company_id = c.id
          ORDER BY l.executed_at DESC
          LIMIT ?
        `).all(limit);
      }

      return res.json({ success: true, data: logs });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
};
