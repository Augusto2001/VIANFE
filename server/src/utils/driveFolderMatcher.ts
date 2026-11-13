import fs from 'fs';
import path from 'path';

export const G_DRIVE_ROOT_PATH = 'G:\\Meu drive\\CLIENTES VIACONT';
export const G_DRIVE_BASE_PATH = 'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS';
export const G_DRIVE_INACTIVE_PATH = 'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES INATIVOS';

export interface FolderAliasMapping {
  cnpj?: string;
  aliases: string[];
  folderName: string;
}

export const KNOWN_FOLDER_ALIASES: FolderAliasMapping[] = [
  {
    cnpj: '73472235000150',
    aliases: [
      'JL COMERCIO',
      'JL COMERCIO E VENDAS',
      'JL COMERCIO E VENDAS DE PECAS',
      'JL COMERCIO E VENDAS DE PECAS E SERVICOS LTDA',
      'LEANDRO GOMES',
      'LEANDRO GOMES NOGUEIRA'
    ],
    folderName: 'LEANDRO GOMES NOGUEIRA (C)-26 (SN) ( 42 )'
  },
  {
    cnpj: '13549736000165',
    aliases: [
      'FARMACIA PRECO BOM',
      'FARMACIA PREÇO BOM',
      'FRANK DANILO'
    ],
    folderName: 'FARMACIA PREÇO BOM (FRANK DANILO) (SN) ( 26 )'
  },
  {
    cnpj: '42597616000131',
    aliases: [
      'RWM',
      'RWM FARMACIA',
      'RWM FARMÁCIA PREÇO CERTO',
      'RWM COMERCIO DE MEDICAMENTOS'
    ],
    folderName: 'RWM FARMÁCIA PREÇO CERTO (SN) ( 68 )'
  },
  {
    cnpj: '54536662000100',
    aliases: [
      'FARMACIA DIAS QUEIROZ',
      'DIAS QUEIROZ'
    ],
    folderName: 'FARMACIA DIAS QUEIROZ (SN) ( 25 )'
  },
  {
    cnpj: '50650733000140',
    aliases: [
      'PETCHIC',
      'PETCHIC SAO GONCALO'
    ],
    folderName: 'PETCHIC (SN) ( 59 )'
  },
  {
    cnpj: '51090446000195',
    aliases: [
      'CHURRASCARIA TRADICAO',
      'CHURRASCARIA TRADICAO GAUCHA'
    ],
    folderName: 'CHURRASCARIA TRADIÇÃO LTDA (SN) ( 13 )'
  },
  {
    cnpj: '11415194000102',
    aliases: [
      'BOM TODO',
      'BOM TODO COMERCIO',
      'BOM TODO COMERCIO VAREJISTA',
      'BOM TODO COMERCIO VAREJISTA LTDA',
      'BOM TODO COMERCIO VAREJISTA EIRELI'
    ],
    folderName: 'BOM TODO COMERCIO VAREJISTA EIRELI ME ( 4 ) (SN) ( 11 )'
  }
];

export function normalizeFolderText(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

export function cleanCnpjDigits(cnpj?: string): string {
  return (cnpj || '').replace(/\D/g, '');
}

/**
 * Checks whether a folder name matches a client CNPJ (with or without punctuation/mask,
 * or via known legacy CNPJ folder alias).
 */
export function folderMatchesCnpj(folderName: string, cnpj?: string): boolean {
  const cleanCnpj = cleanCnpjDigits(cnpj);
  if (cleanCnpj.length !== 14) return false;

  const folderDigits = (folderName || '').replace(/\D/g, '');
  if (folderDigits.includes(cleanCnpj)) {
    return true;
  }

  const matchedAlias = KNOWN_FOLDER_ALIASES.find(a => a.cnpj === cleanCnpj);
  if (matchedAlias) {
    const normFolder = normalizeFolderText(folderName);
    const normAlias = normalizeFolderText(matchedAlias.folderName);
    if (normFolder === normAlias || normFolder.includes(normAlias)) {
      return true;
    }
  }

  return false;
}

/**
 * Identifies active/inactive container directories (e.g. CLIENTES ATIVOS, CLIENTES INATIVOS, ATIVOS, INATIVOS).
 */
export function isActiveOrInactiveGroupFolder(folderName: string): boolean {
  const norm = normalizeFolderText(folderName);
  if (!norm) return false;
  if (/\d{14}/.test((folderName || '').replace(/\D/g, ''))) return false;
  return /\b(ATIVOS?|INATIVOS?|ATIVAS?|INATIVAS?|CLIENTES\s+VIACONT)\b/.test(norm);
}

function isDirectorySafe(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Collects candidate root and active/inactive subdirectories to search for client folders.
 */
export function getCandidateSearchDirs(basePath: string = process.env.VIANFE_DRIVE_BASE_PATH || G_DRIVE_BASE_PATH): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const addDir = (dir: string) => {
    if (!dir) return;
    const key = path.resolve(dir);
    if (seen.has(key)) return;
    if (!isDirectorySafe(dir)) return;
    seen.add(key);
    result.push(dir);
  };

  const scanSubGroups = (dir: string, depth: number = 0) => {
    if (depth > 2 || !isDirectorySafe(dir)) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (isActiveOrInactiveGroupFolder(entry)) {
          const full = path.join(dir, entry);
          if (isDirectorySafe(full)) {
            addDir(full);
            scanSubGroups(full, depth + 1);
          }
        }
      }
    } catch {
      // Ignore unreadable directories
    }
  };

  if (isDirectorySafe(basePath)) {
    addDir(basePath);
    scanSubGroups(basePath, 0);
  }

  const baseName = path.basename(basePath);
  if (isActiveOrInactiveGroupFolder(baseName)) {
    const parentDir = path.dirname(basePath);
    if (parentDir && parentDir !== basePath && isDirectorySafe(parentDir)) {
      addDir(parentDir);
      scanSubGroups(parentDir, 0);
    }
  }

  return result;
}

/**
 * Finds an existing client folder by CNPJ (with or without mask in the folder name),
 * searching the base path as well as active and inactive subdirectories.
 * Never creates a new root client folder; logs a warning when not found.
 */
export function getClientFolderInGDrive(
  companyName: string,
  cnpj?: string,
  nomeFantasia?: string,
  basePath: string = process.env.VIANFE_DRIVE_BASE_PATH || G_DRIVE_BASE_PATH
): string | null {
  try {
    const searchDirs = getCandidateSearchDirs(basePath);
    if (searchDirs.length === 0) {
      return null;
    }

    let cleanCnpj = cleanCnpjDigits(cnpj);
    if (cleanCnpj.length !== 14) {
      const fromName = cleanCnpjDigits(companyName);
      if (fromName.length === 14) {
        cleanCnpj = fromName;
      } else {
        const targetName = normalizeFolderText(companyName);
        const targetFantasia = normalizeFolderText(nomeFantasia || '');
        const aliasMatch = KNOWN_FOLDER_ALIASES.find(a =>
          a.cnpj && a.aliases.some(alias => {
            const normAlias = normalizeFolderText(alias);
            return (targetName && targetName.includes(normAlias)) || (targetFantasia && targetFantasia.includes(normAlias));
          })
        );
        if (aliasMatch?.cnpj) {
          cleanCnpj = aliasMatch.cnpj;
        }
      }
    }

    if (cleanCnpj.length !== 14) {
      console.warn(`[DriveMatcher] CNPJ inválido ou não informado para localizar pasta do cliente (${companyName || 'Sem razão social'}). Nenhuma pasta raiz foi criada.`);
      return null;
    }

    for (const dir of searchDirs) {
      let existingEntries: string[] = [];
      try {
        existingEntries = fs.readdirSync(dir);
      } catch {
        continue;
      }

      for (const entry of existingEntries) {
        if (isActiveOrInactiveGroupFolder(entry)) continue;
        const fullEntryPath = path.join(dir, entry);
        if (!isDirectorySafe(fullEntryPath)) continue;

        if (folderMatchesCnpj(entry, cleanCnpj)) {
          return fullEntryPath;
        }
      }
    }

    console.warn(`[DriveMatcher] Pasta do cliente não encontrada no Drive para o CNPJ ${cleanCnpj} (${companyName || 'Sem razão social'}). Nenhuma pasta raiz foi criada.`);
    return null;
  } catch (err: any) {
    console.warn(`[DriveMatcher] Erro ao buscar pasta em Drive: ${err.message}`);
    return null;
  }
}

/**
 * Ensures a single child subfolder exists inside parentDir without creating duplicates
 * if a case/accent-insensitive match already exists.
 */
export function ensureSubfolderNoDuplicate(parentDir: string, desiredName: string): string {
  const targetNorm = normalizeFolderText(desiredName);
  try {
    const items = fs.readdirSync(parentDir);
    const existing = items.find(item => {
      const full = path.join(parentDir, item);
      return isDirectorySafe(full) && normalizeFolderText(item) === targetNorm;
    });
    if (existing) {
      return path.join(parentDir, existing);
    }
  } catch {
    // Proceed to create if directory cannot be listed
  }

  const newDir = path.join(parentDir, desiredName);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }
  return newDir;
}

/**
 * Ensures <pasta do cliente>/SETOR FISCAL/NFe exists, creating only missing subfolders.
 */
export function getSetorFiscalNfeDir(clientFolderPath: string): string {
  try {
    const setorFiscalDir = ensureSubfolderNoDuplicate(clientFolderPath, 'SETOR FISCAL');
    return ensureSubfolderNoDuplicate(setorFiscalDir, 'NFe');
  } catch {
    return clientFolderPath;
  }
}

/**
 * Ensures <pasta do cliente>/SETOR FISCAL/NFe/AAAA/MM/Saidas exists,
 * reusing existing subfolders and creating only the ones that are missing.
 */
export function ensureClientNfeSaidasDir(clientFolderPath: string, year: string, month: string): string {
  const setorFiscalNfe = getSetorFiscalNfeDir(clientFolderPath);
  const yearDir = ensureSubfolderNoDuplicate(setorFiscalNfe, String(year));
  const monthDir = ensureSubfolderNoDuplicate(yearDir, String(month).padStart(2, '0'));
  return ensureSubfolderNoDuplicate(monthDir, 'Saidas');
}

function extractYearAndMonth(dataEmissaoStr?: string): { year: string; month: string } {
  const isoMatch = String(dataEmissaoStr || '').trim().match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return { year: isoMatch[1], month: isoMatch[2] };
  }
  const emissionDate = new Date(dataEmissaoStr || Date.now());
  if (!isNaN(emissionDate.getTime())) {
    return {
      year: String(emissionDate.getFullYear()),
      month: String(emissionDate.getMonth() + 1).padStart(2, '0')
    };
  }
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0')
  };
}

/**
 * Returns storage paths targeting <pasta do cliente>/SETOR FISCAL/NFe/AAAA/MM/Saidas
 * when the existing client folder is found by CNPJ (never creating a duplicate client root folder).
 */
export function getInvoiceStoragePaths(
  companyName: string,
  dataEmissaoStr: string,
  chaveAcesso: string,
  fallbackStorageDir: string,
  cnpj?: string,
  tipo: 'entrada' | 'saida' = 'saida',
  nomeFantasia?: string,
  basePath: string = process.env.VIANFE_DRIVE_BASE_PATH || G_DRIVE_BASE_PATH
): { xmlFilePath: string; pdfFilePath: string } {
  const { year, month } = extractYearAndMonth(dataEmissaoStr);

  const gDriveClientFolder = getClientFolderInGDrive(companyName, cnpj, nomeFantasia, basePath);

  if (gDriveClientFolder && fs.existsSync(gDriveClientFolder)) {
    try {
      const saidasDir = ensureClientNfeSaidasDir(gDriveClientFolder, year, month);
      return {
        xmlFilePath: path.join(saidasDir, `${chaveAcesso}.xml`),
        pdfFilePath: path.join(saidasDir, `DANFE_${chaveAcesso}.pdf`),
      };
    } catch (err: any) {
      console.warn(`[DriveMatcher] Aviso ao gravar subpastas em Drive: ${err.message}. Usando armazenamento local.`);
    }
  }

  // Fallback to local storage (never inside Drive root)
  const subFolder = tipo === 'entrada' ? 'Entradas' : 'Saidas';
  const cleanCompanyName = (companyName || 'EMPRESA').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 40).toUpperCase();
  const xmlDir = path.join(fallbackStorageDir, 'xmls', cleanCompanyName, year, month, subFolder);
  const pdfDir = path.join(fallbackStorageDir, 'pdfs', cleanCompanyName, year, month, subFolder);

  fs.mkdirSync(xmlDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  return {
    xmlFilePath: path.join(xmlDir, `${chaveAcesso}.xml`),
    pdfFilePath: path.join(pdfDir, `DANFE_${chaveAcesso}.pdf`),
  };
}
