import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { db } from '../database/db.js';

export interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
}

const KNOWN_CNPJ_FOLDER_ALIASES: Array<{ cnpj: string; folderName: string }> = [
  { cnpj: '73472235000150', folderName: 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )' },
  { cnpj: '13549736000165', folderName: 'FARMACIA PREÇO BOM (FRANK DANILO) (SN) ( 26 )' },
  { cnpj: '42597616000131', folderName: 'RWM FARMÁCIA PREÇO CERTO (SN) ( 68 )' },
  { cnpj: '54536662000100', folderName: 'FARMACIA DIAS QUEIROZ (SN) ( 25 )' },
  { cnpj: '50650733000140', folderName: 'PETCHIC (SN) ( 59 )' },
  { cnpj: '51090446000195', folderName: 'CHURRASCARIA TRADIÇÃO LTDA (SN) ( 13 )' },
  { cnpj: '11415194000102', folderName: 'BOM TODO COMERCIO VAREJISTA EIRELI ME ( 4 ) (SN) ( 11 )' },
];

function normText(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function cleanCnpj(cnpj?: string): string {
  return (cnpj || '').replace(/\D/g, '');
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
        
        // 1. Service Account (JWT)
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

        // 2. OAuth2 Client (e.g. from Google Cloud / n8n / Viacont)
        const clientId = credentials.client_id || credentials.clientId;
        const clientSecret = credentials.client_secret || credentials.clientSecret;
        const refreshToken = credentials.refresh_token || credentials.oauthTokenData?.refresh_token;
        const accessToken = credentials.access_token || credentials.oauthTokenData?.access_token;

        if (clientId && clientSecret && refreshToken) {
          const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
          oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken,
          });
          this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
          this.isConfigured = true;
          console.log('✓ Google Drive OAuth2 client initialized.');
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
   * Save Google credentials JSON (Service Account or OAuth2)
   */
  public saveCredentials(jsonContent: string) {
    try {
      const parsed = JSON.parse(jsonContent);
      const isServiceAccount = !!(parsed.client_email && parsed.private_key);
      const clientId = parsed.client_id || parsed.clientId;
      const clientSecret = parsed.client_secret || parsed.clientSecret;
      const refreshToken = parsed.refresh_token || parsed.oauthTokenData?.refresh_token;
      const isOAuth = !!(clientId && clientSecret && refreshToken);

      if (!isServiceAccount && !isOAuth) {
        throw new Error('Formato JSON de credencial Google inválido (exige Service Account ou OAuth2).');
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

  public folderMatchesCnpj(folderName: string, cnpj?: string): boolean {
    const targetCnpj = cleanCnpj(cnpj);
    if (targetCnpj.length !== 14) return false;

    const digits = (folderName || '').replace(/\D/g, '');
    if (digits.includes(targetCnpj)) {
      return true;
    }

    const alias = KNOWN_CNPJ_FOLDER_ALIASES.find(a => a.cnpj === targetCnpj);
    if (alias) {
      const nFolder = normText(folderName);
      const nAlias = normText(alias.folderName);
      if (nFolder === nAlias || nFolder.includes(nAlias)) {
        return true;
      }
    }

    return false;
  }

  private isStatusGroupFolder(folderName: string): boolean {
    const norm = normText(folderName);
    if (!norm) return false;
    if (/\d{14}/.test((folderName || '').replace(/\D/g, ''))) return false;
    return /\b(ATIVOS?|INATIVOS?|ATIVAS?|INATIVAS?|CLIENTES)\b/.test(norm);
  }

  /**
   * Locate existing client folder by CNPJ (with or without mask in name),
   * searching rootFolderId and active/inactive subfolders.
   * Never creates a new client folder; logs a warning when not found.
   */
  public async findClientFolderByCnpj(
    cnpj: string,
    rootFolderId: string = 'root',
    companyName: string = ''
  ): Promise<DriveFolder | null> {
    if (!this.isConfigured || !this.driveClient) {
      throw new Error('Google Drive não configurado; nenhuma pasta foi consultada.');
    }

    const targetCnpj = cleanCnpj(cnpj);
    if (targetCnpj.length !== 14) {
      console.warn(`[GoogleDrive] CNPJ inválido ou não informado para localizar pasta (${companyName || cnpj}). Nenhuma pasta raiz foi criada.`);
      return null;
    }

    const visitedParents = new Set<string>();
    const searchParent = async (parentId: string, depth: number): Promise<DriveFolder | null> => {
      if (depth > 2 || visitedParents.has(parentId)) return null;
      visitedParents.add(parentId);

      const folders = await this.listFolders(parentId);
      const directMatch = folders.find(f => this.folderMatchesCnpj(f.name, targetCnpj));
      if (directMatch) {
        return directMatch;
      }

      for (const f of folders) {
        if (this.isStatusGroupFolder(f.name)) {
          const nestedMatch = await searchParent(f.id, depth + 1);
          if (nestedMatch) {
            return nestedMatch;
          }
        }
      }

      return null;
    };

    const found = await searchParent(rootFolderId, 0);
    if (!found) {
      console.warn(`[GoogleDrive] Pasta do cliente não encontrada para o CNPJ ${targetCnpj} (${companyName || 'Sem razão social'}). Nenhuma pasta raiz foi criada.`);
    }
    return found;
  }

  /**
   * Locate existing client folder by CNPJ and ensure:
   * <pasta do cliente>/SETOR FISCAL/NFe/AAAA/MM/Saidas
   * creating only missing subfolders and never duplicating existing ones or creating a new client root folder.
   */
  public async ensureCompanyFolderStructure(
    baseFolderId: string,
    companyName: string,
    year: string,
    month: string,
    subType: string = 'Saidas',
    cnpj?: string
  ): Promise<string> {
    if (!baseFolderId || /^(virtual_|folder_)/.test(baseFolderId)) throw new Error('Pasta real do Drive não configurada.');

    if (!this.isConfigured || !this.driveClient) {
      throw new Error('Google Drive não configurado; backup pendente.');
    }

    try {
      let resolvedCnpj = cleanCnpj(cnpj);
      if (resolvedCnpj.length !== 14) {
        const cnpjInName = cleanCnpj(companyName);
        if (cnpjInName.length === 14) {
          resolvedCnpj = cnpjInName;
        } else {
          try {
            const row = db.prepare('SELECT cnpj FROM companies WHERE razao_social = ?').get(companyName) as any;
            if (row?.cnpj) {
              resolvedCnpj = cleanCnpj(row.cnpj);
            }
          } catch {
            // Ignore DB lookup failure in isolated mocks
          }
        }
      }

      let companyFolderId = '';
      if (resolvedCnpj.length === 14) {
        const matched = await this.findClientFolderByCnpj(resolvedCnpj, baseFolderId, companyName);
        if (!matched) {
          throw new Error(`Pasta do cliente não encontrada no Google Drive para o CNPJ ${resolvedCnpj} (${companyName}); nenhuma pasta raiz foi criada.`);
        }
        companyFolderId = matched.id;
      } else {
        console.warn(`[GoogleDrive] CNPJ não informado para localizar pasta existente de "${companyName}". Nenhuma pasta raiz foi criada.`);
        throw new Error(`CNPJ obrigatório para localizar pasta existente do cliente (${companyName}) no Google Drive.`);
      }

      const setorFiscalId = await this.getOrCreateFolder('SETOR FISCAL', companyFolderId);
      const nfeFolderId = await this.getOrCreateFolder('NFe', setorFiscalId);
      const yearFolderId = await this.getOrCreateFolder(String(year), nfeFolderId);
      const monthFolderId = await this.getOrCreateFolder(String(month).padStart(2, '0'), yearFolderId);
      const targetSubFolder = subType && normText(subType) === 'ENTRADAS' ? 'Saidas' : 'Saidas';
      const saidasFolderId = await this.getOrCreateFolder(targetSubFolder, monthFolderId);
      return saidasFolderId;
    } catch (err: any) {
      console.error('Error ensuring folder structure on Google Drive:', err.message || err);
      throw err;
    }
  }

  private async getOrCreateFolder(name: string, parentId: string): Promise<string> {
    const res = await this.driveClient.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      spaces: 'drive',
    });

    const targetNorm = normText(name);
    const files: Array<{ id: string; name?: string }> = res?.data?.files || [];
    const existing = files.find(f => f && f.id && normText(f.name || '') === targetNorm);
    if (existing) {
      return existing.id;
    }

    // Create only the missing subfolder
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
