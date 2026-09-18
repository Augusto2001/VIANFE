import fs from 'fs';
import path from 'path';

export const G_DRIVE_BASE_PATH = 'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS';

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
  }
];

/**
 * Enhanced folder matcher that finds client folder by CNPJ, known aliases, or fuzzy name matching.
 */
export function getClientFolderInGDrive(companyName: string, cnpj?: string, nomeFantasia?: string): string | null {
  if (!fs.existsSync(G_DRIVE_BASE_PATH)) {
    return null;
  }

  try {
    const existingFolders = fs.readdirSync(G_DRIVE_BASE_PATH);
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const norm = (str: string) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const targetName = norm(companyName);
    const targetFantasia = norm(nomeFantasia || '');

    // 0. Check Known Folder Aliases (e.g. JL Comércio -> LEANDRO GOMES NOGUEIRA)
    const matchedAlias = KNOWN_FOLDER_ALIASES.find(a => {
      if (cleanCnpj && a.cnpj && cleanCnpj === a.cnpj) return true;
      if (a.aliases.some(alias => targetName.includes(norm(alias)) || (targetFantasia && targetFantasia.includes(norm(alias))))) return true;
      return false;
    });

    if (matchedAlias) {
      const aliasFolder = existingFolders.find(f => norm(f) === norm(matchedAlias.folderName) || norm(f).includes(norm(matchedAlias.folderName)));
      if (aliasFolder) {
        return path.join(G_DRIVE_BASE_PATH, aliasFolder);
      }
      const directPath = path.join(G_DRIVE_BASE_PATH, matchedAlias.folderName);
      if (fs.existsSync(directPath)) {
        return directPath;
      }
    }

    // 1. Try matching by clean CNPJ in folder name
    if (cleanCnpj && cleanCnpj.length === 14) {
      const matchByCnpj = existingFolders.find(f => f.replace(/\D/g, '').includes(cleanCnpj));
      if (matchByCnpj) {
        return path.join(G_DRIVE_BASE_PATH, matchByCnpj);
      }
    }

    // 2. Fuzzy name matching
    const words = targetName.split(/\s+/).filter(w => w.length > 3 && !['LTDA', 'EIRELI', 'ME', 'EPP', 'COMERCIO', 'SERVICOS', 'CONVENIENCIA'].includes(w));

    let bestMatch: string | null = null;
    let maxMatchedWords = 0;

    for (const folder of existingFolders) {
      const normFolder = norm(folder);
      let matchedCount = 0;
      for (const w of words) {
        if (normFolder.includes(w)) {
          matchedCount++;
        }
      }
      if (matchedCount > maxMatchedWords) {
        maxMatchedWords = matchedCount;
        bestMatch = folder;
      }
    }

    if (bestMatch && maxMatchedWords >= 1) {
      return path.join(G_DRIVE_BASE_PATH, bestMatch);
    }

    // 3. Fallback to first word match
    const firstWord = targetName.split(/\s+/)[0];
    const matchByFirstWord = existingFolders.find(f => norm(f).includes(firstWord));
    if (matchByFirstWord) {
      return path.join(G_DRIVE_BASE_PATH, matchByFirstWord);
    }

    // 4. If no folder exists, create new clean folder
    const newFolderName = companyName.replace(/[\/\\:*?"<>|]/g, '_').toUpperCase();
    const newFolderPath = path.join(G_DRIVE_BASE_PATH, newFolderName);
    fs.mkdirSync(newFolderPath, { recursive: true });
    return newFolderPath;
  } catch (err: any) {
    console.warn(`[DriveMatcher] Erro ao buscar pasta em G: ${err.message}`);
    return null;
  }
}

/**
 * Ensures SETOR FISCAL\NFe or SETOR FISCAL\NF folder exists inside the client folder.
 * Supports both "NF" and "NFe" subdirectories seamlessly.
 */
export function getSetorFiscalNfeDir(clientFolderPath: string): string {
  let setorFiscalDir = path.join(clientFolderPath, 'SETOR FISCAL');
  if (!fs.existsSync(setorFiscalDir)) {
    const subItems = fs.readdirSync(clientFolderPath);
    const existingSetor = subItems.find(i => i.toUpperCase().includes('SETOR FISCAL') || i.toUpperCase().includes('FISCAL'));
    if (existingSetor) {
      setorFiscalDir = path.join(clientFolderPath, existingSetor);
    } else {
      try {
        fs.mkdirSync(setorFiscalDir, { recursive: true });
      } catch (e: any) {
        return clientFolderPath;
      }
    }
  }

  if (!fs.existsSync(setorFiscalDir)) {
    return clientFolderPath;
  }

  const setorItems = fs.readdirSync(setorFiscalDir);
  const nfeFolder = setorItems.find(i => i.trim().toUpperCase() === 'NFE');
  const nfFolder = setorItems.find(i => i.trim().toUpperCase() === 'NF');

  if (nfeFolder) {
    return path.join(setorFiscalDir, nfeFolder);
  }

  if (nfFolder) {
    return path.join(setorFiscalDir, nfFolder);
  }

  const finalNfeDir = path.join(setorFiscalDir, 'NFe');
  if (!fs.existsSync(finalNfeDir)) {
    try {
      fs.mkdirSync(finalNfeDir, { recursive: true });
    } catch (e: any) {
      return setorFiscalDir;
    }
  }

  return finalNfeDir;
}

/**
 * Returns storage paths targeting G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\[CLIENTE]\SETOR FISCAL\[NFe|NF]\[ANO]\[MÊS]\[Entradas|Saidas]\
 */
export function getInvoiceStoragePaths(
  companyName: string,
  dataEmissaoStr: string,
  chaveAcesso: string,
  fallbackStorageDir: string,
  cnpj?: string,
  tipo: 'entrada' | 'saida' = 'entrada',
  nomeFantasia?: string
): { xmlFilePath: string; pdfFilePath: string } {
  const emissionDate = new Date(dataEmissaoStr || Date.now());
  const year = String(emissionDate.getFullYear());
  const month = String(emissionDate.getMonth() + 1).padStart(2, '0');
  const subFolder = tipo === 'saida' ? 'Saidas' : 'Entradas';

  const gDriveClientFolder = getClientFolderInGDrive(companyName, cnpj, nomeFantasia);

  if (gDriveClientFolder && fs.existsSync(gDriveClientFolder)) {
    const setorFiscalNfe = getSetorFiscalNfeDir(gDriveClientFolder);
    
    // Check if direct XMLs folder exists or create subfolder Entradas/Saidas
    const directXmls = path.join(setorFiscalNfe, year, month, 'XMLs');
    let xmlDir = path.join(setorFiscalNfe, year, month, subFolder, 'XMLs');
    let pdfDir = path.join(setorFiscalNfe, year, month, subFolder, 'PDFs');

    // If direct XMLs exists (legacy flat month structure), write to flat month or subfolder
    if (fs.existsSync(directXmls) && !fs.existsSync(path.join(setorFiscalNfe, year, month, subFolder))) {
      xmlDir = directXmls;
      pdfDir = path.join(setorFiscalNfe, year, month, 'PDFs');
    }

    try {
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(pdfDir, { recursive: true });

      return {
        xmlFilePath: path.join(xmlDir, `${chaveAcesso}.xml`),
        pdfFilePath: path.join(pdfDir, `DANFE_${chaveAcesso}.pdf`),
      };
    } catch (err: any) {
      console.warn(`[DriveMatcher] Aviso ao gravar pastas em G: ${err.message}. Usando armazenamento padrão.`);
    }
  }

  // Fallback to local storage/xmls/EMPRESA/ANO/MES/SUBFOLDER
  const cleanCompanyName = companyName.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 40).toUpperCase();
  const xmlDir = path.join(fallbackStorageDir, 'xmls', cleanCompanyName, year, month, subFolder);
  const pdfDir = path.join(fallbackStorageDir, 'pdfs', cleanCompanyName, year, month, subFolder);

  fs.mkdirSync(xmlDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  return {
    xmlFilePath: path.join(xmlDir, `${chaveAcesso}.xml`),
    pdfFilePath: path.join(pdfDir, `DANFE_${chaveAcesso}.pdf`),
  };
}
