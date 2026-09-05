import fs from 'fs';
import path from 'path';

export const G_DRIVE_BASE_PATH = 'G:\\Meu drive\\CLIENTES VIACONT\\CLIENTES ATIVOS';

/**
 * Enhanced folder matcher that finds client folder by CNPJ or fuzzy name matching.
 */
export function getClientFolderInGDrive(companyName: string, cnpj?: string): string | null {
  if (!fs.existsSync(G_DRIVE_BASE_PATH)) {
    return null;
  }

  try {
    const existingFolders = fs.readdirSync(G_DRIVE_BASE_PATH);
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');

    // 1. Try matching by clean CNPJ
    if (cleanCnpj && cleanCnpj.length === 14) {
      const matchByCnpj = existingFolders.find(f => f.replace(/\D/g, '').includes(cleanCnpj));
      if (matchByCnpj) {
        return path.join(G_DRIVE_BASE_PATH, matchByCnpj);
      }
    }

    // 2. Fuzzy name matching
    const norm = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const targetName = norm(companyName);
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
    const firstWord = norm(companyName).split(/\s+/)[0];
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
 * Ensures SETOR FISCAL\NFe folder exists inside the client folder.
 * If a folder named "NF" exists inside SETOR FISCAL, renames it to "NFe".
 */
export function getSetorFiscalNfeDir(clientFolderPath: string): string {
  let setorFiscalDir = path.join(clientFolderPath, 'SETOR FISCAL');
  if (!fs.existsSync(setorFiscalDir)) {
    const subItems = fs.readdirSync(clientFolderPath);
    const existingSetor = subItems.find(i => i.toUpperCase().includes('SETOR FISCAL') || i.toUpperCase().includes('FISCAL'));
    if (existingSetor) {
      setorFiscalDir = path.join(clientFolderPath, existingSetor);
    } else {
      fs.mkdirSync(setorFiscalDir, { recursive: true });
    }
  }

  const setorItems = fs.readdirSync(setorFiscalDir);
  const nfFolder = setorItems.find(i => i.trim() === 'NF' || i.trim() === 'nf');
  const nfeFolder = setorItems.find(i => i.trim().toUpperCase() === 'NFE');

  if (nfFolder && !nfeFolder) {
    const oldNfPath = path.join(setorFiscalDir, nfFolder);
    const newNfePath = path.join(setorFiscalDir, 'NFe');
    try {
      fs.renameSync(oldNfPath, newNfePath);
      console.log(`[DriveMatcher] Pasta "${nfFolder}" renomeada para "NFe" em ${setorFiscalDir}`);
    } catch (e: any) {
      console.warn(`[DriveMatcher] Não foi possível renomear NF para NFe: ${e.message}`);
    }
  }

  const finalNfeDir = path.join(setorFiscalDir, 'NFe');
  if (!fs.existsSync(finalNfeDir)) {
    fs.mkdirSync(finalNfeDir, { recursive: true });
  }

  return finalNfeDir;
}

/**
 * Returns storage paths targeting G:\Meu drive\CLIENTES VIACONT\CLIENTES ATIVOS\[CLIENTE]\SETOR FISCAL\NFe\[ANO]\[MÊS]\[Entradas|Saidas]\
 */
export function getInvoiceStoragePaths(
  companyName: string,
  dataEmissaoStr: string,
  chaveAcesso: string,
  fallbackStorageDir: string,
  cnpj?: string,
  tipo: 'entrada' | 'saida' = 'entrada'
): { xmlFilePath: string; pdfFilePath: string } {
  const emissionDate = new Date(dataEmissaoStr || Date.now());
  const year = String(emissionDate.getFullYear());
  const month = String(emissionDate.getMonth() + 1).padStart(2, '0');
  const subFolder = tipo === 'saida' ? 'Saidas' : 'Entradas';

  const gDriveClientFolder = getClientFolderInGDrive(companyName, cnpj);

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

    fs.mkdirSync(xmlDir, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });

    return {
      xmlFilePath: path.join(xmlDir, `${chaveAcesso}.xml`),
      pdfFilePath: path.join(pdfDir, `DANFE_${chaveAcesso}.pdf`),
    };
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
