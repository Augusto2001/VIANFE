const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const lavoDir = 'G:/Meu drive/CLIENTES VIACONT/CLIENTES ATIVOS/LAVO JIF LAVANDERIAS LTDA (SN) ( 96 )/SETOR FISCAL/NF';

const zips = [
  '2026/08/EMITIDAS/XML/XML_LAVO JIF_08.2026.zip',
  '2026/07/EMITIDAS/XML/XML_LAVO JIF_07.2026.zip',
  '2026/06/EMITIDAS/XML/XML_LAVO JIF_06.2026.zip',
  '2026/04/LoteXMLNotasFiscais.zip',
  '2026/02/REVISADA/LoteXMLNotasFiscais.zip',
  '2026/03/LoteXMLNotasFiscais (1).zip'
];

for (const z of zips) {
  const fullZip = path.join(lavoDir, z);
  const destDir = path.dirname(fullZip);
  if (fs.existsSync(fullZip)) {
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${fullZip.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force"`);
      console.log(`✅ Extraído: ${z} -> ${destDir}`);
    } catch (e) {
      console.error(`Erro ao extrair ${z}:`, e.message);
    }
  }
}
