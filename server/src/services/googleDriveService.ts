import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { db } from '../database/db.js';

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
}

export class GoogleDriveService {
  private driveClient: any = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initClient();
  }

  public initClient() {
    try {
      const setting = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('gdrive_credentials') as any;
      if (setting && setting.value) {
        const credentials = JSON.parse(setting.value);
        
        if (credentials.client_email && credentials.private_key) {
          const auth = new google.auth.JWT(
            credentials.client_email,
            undefined,
            credentials.private_key,
            ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
          );
          this.driveClient = google.drive({ version: 'v3', auth });
          this.isConfigured = true;
          console.log('✓ Google Drive Service Account client initialized.');
          return;
        }
      }
    } catch (err: any) {
      console.warn('Google Drive client not configured or invalid credentials:', err.message);
    }
    this.driveClient = null;
    this.isConfigured = false;
  }

  public getStatus() {
    return {
      isConfigured: this.isConfigured,
      mode: this.isConfigured ? 'google_api' : 'not_configured',
      message: this.isConfigured
        ? 'Credenciais Google Drive configuradas; conexão validada a cada operação.'
        : 'Google Drive não configurado; backups permanecem pendentes.'
    };
  }

  /**
   * Save Google credentials JSON (Service Account)
   */
  public saveCredentials(jsonContent: string) {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error('Formato JSON de credencial Google inválido.');
      }
      
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO system_settings (key, value, updated_at) 
        VALUES ('gdrive_credentials', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(jsonContent, now);

      this.initClient();
      return { success: true, message: 'Credenciais do Google Drive salvas com sucesso!' };
    } catch (err: any) {
      throw new Error(`Erro ao salvar credenciais: ${err.message}`);
    }
  }

  /**
   * List folders in Google Drive root or within a parent folder
   */
  public async listFolders(parentId: string = 'root'): Promise<DriveFolder[]> {
    if (!this.isConfigured || !this.driveClient) {
      throw new Error('Google Drive não configurado; nenhuma pasta foi consultada.');
    }

    try {
      const res = await this.driveClient.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive',
      });
      return res.data.files || [];
    } catch (err: any) {
      console.error('Error listing Google Drive folders:', err.message);
      throw new Error(`Erro ao listar pastas no Google Drive: ${err.message}`);
    }
  }

  /**
   * Create or find a subfolder hierarchy: [Base Folder] / [Empresa] / [YYYY] / [MM] / [XMLs | PDFs]
   */
  public async ensureCompanyFolderStructure(
    baseFolderId: string,
    companyName: string,
    year: string,
    month: string,
    subType: 'XMLs' | 'PDFs'
  ): Promise<string> {
    if (!baseFolderId || /^(virtual_|folder_)/.test(baseFolderId)) throw new Error('Pasta real do Drive não configurada.');
    const cleanCompanyName = companyName.replace(/[\/\\:*?"<>|]/g, '_').trim();

    if (!this.isConfigured || !this.driveClient) {
      throw new Error('Google Drive não configurado; backup pendente.');
    }

    try {
      const companyFolderId = await this.getOrCreateFolder(cleanCompanyName, baseFolderId);
      const yearFolderId = await this.getOrCreateFolder(year, companyFolderId);
      const monthFolderId = await this.getOrCreateFolder(month, yearFolderId);
      const typeFolderId = await this.getOrCreateFolder(subType, monthFolderId);
      return typeFolderId;
    } catch (err: any) {
      console.error('Error creating folder structure on Google Drive:', err);
      throw err;
    }
  }

  private async getOrCreateFolder(name: string, parentId: string): Promise<string> {
    const res = await this.driveClient.files.list({
      q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    // Create new folder
    const created = await this.driveClient.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    if (!created.data.id) throw new Error('Google Drive não confirmou criação da pasta.');
    return created.data.id;
  }

  /**
   * Upload file to Google Drive folder
   */
  public async uploadFile(
    localFilePath: string,
    fileName: string,
    folderId: string,
    mimeType: string
  ): Promise<{ fileId: string; webViewLink?: string }> {
    if (!folderId || /^(virtual_|folder_)/.test(folderId)) throw new Error('Pasta real do Drive não configurada.');
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`Arquivo local não encontrado: ${localFilePath}`);
    }

    if (!this.isConfigured || !this.driveClient) {
      throw new Error('Google Drive não configurado; backup pendente.');
    }

    try {
      const res = await this.driveClient.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType,
          body: fs.createReadStream(localFilePath),
        },
        fields: 'id, webViewLink',
      });

      if (!res.data.id) throw new Error('Google Drive não retornou ID; backup não confirmado.');
      return {
        fileId: res.data.id,
        webViewLink: res.data.webViewLink,
      };
    } catch (err: any) {
      console.error(`Failed to upload ${fileName} to Google Drive:`, err.message);
      throw err;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
