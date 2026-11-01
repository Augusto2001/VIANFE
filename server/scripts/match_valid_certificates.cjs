const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

function walk(dir, ext = '.pfx', maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  let res = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        res = res.concat(walk(p, ext, maxDepth, currentDepth + 1));
      } else if (p.toLowerCase().endsWith(ext)) {
        res.push({ path: p, mtime: stat.mtime, size: stat.size });
      }
    }
  } catch (e) {}
  return res;
}

console.log('🔍 Escaneando pastas do SETOR LEGAL...');
const certDirs = [
  'G:/Meu drive/SETORES/SETOR LEGAL/CERTIFICADOS DIGITAIS/CERTIFICADOS VÁLIDOS',
  'G:/Meu drive/SETORES/SETOR LEGAL/MINE MERCADO FILEZINHO',
  'G:/Meu drive/SETORES/SETOR LEGAL'
];

let allPfx = [];
const seenPaths = new Set();
for (const d of certDirs) {
  if (fs.existsSync(d)) {
    const list = walk(d, '.pfx', 3, 0);
    for (const item of list) {
      if (!seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        allPfx.push(item);
      }
    }
  }
}
console.log(`Encontrados ${allPfx.length} arquivos .pfx no Setor Legal.`);

const companies = db.prepare("SELECT id, cnpj, razao_social, nome_fantasia, cert_filename, status FROM companies WHERE status = 'ativo'").all();
console.log(`Empresas ativas no banco: ${companies.length}`);

const matches = [];
const missing = [];

for (const comp of companies) {
  const cleanCnpj = (comp.cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj) continue;

  const matchedFiles = allPfx.filter(p => {
    const base = path.basename(p.path).replace(/\D/g, '');
    return base.includes(cleanCnpj);
  });

  if (matchedFiles.length > 0) {
    matchedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const bestMatch = matchedFiles[0];
    matches.push({
      company: comp,
      pfxPath: bestMatch.path,
      mtime: bestMatch.mtime,
      alreadyHasCert: !!comp.cert_filename
    });
  } else {
    missing.push(comp);
  }
}

console.log(`\n========================================================`);
console.log(`CERTIFICADOS ENCONTRADOS PARA EMPRESAS ATIVAS: ${matches.length}`);
console.log(`========================================================`);

for (const m of matches) {
  console.log(`[${m.alreadyHasCert ? 'VINCULADO' : 'NOVO'}] ${m.company.cnpj} | ${m.company.razao_social}`);
  console.log(`   PFX: ${m.pfxPath}`);
}

console.log(`\n========================================================`);
console.log(`EMPRESAS ATIVAS SEM PFX NA PASTA SETOR LEGAL: ${missing.length}`);
console.log(`========================================================`);
for (const c of missing) {
  console.log(` - ${c.cnpj} | ${c.razao_social} (Já tem cert no banco: ${c.cert_filename ? 'SIM' : 'NÃO'})`);
}
