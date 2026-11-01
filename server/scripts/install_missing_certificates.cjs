const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const dbPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/data/fiscal_hub.db');
const certsDir = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/certificates');
const db = new DatabaseSync(dbPath);

if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Chave AES para criptografar em repouso conforme o projeto
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'viacont_super_secret_aes_key_32bytes!!';
function encryptText(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

const defaultPasswords = [
  'Cont123@', 'Cont123', 'Cont1234', 'Cont1234@', 'Cont123#',
  '123456', '1234', '12345', '12345678', 'viacont', 'Viacont123@', 'Fellipe123'
];

function findPasswordCandidates(pfxFilePath) {
  const candidates = new Set(defaultPasswords);
  const dir = path.dirname(pfxFilePath);
  const parentDir = path.dirname(dir);

  [dir, parentDir].forEach(d => {
    if (fs.existsSync(d)) {
      try {
        const files = fs.readdirSync(d);
        for (const f of files) {
          if (f.toLowerCase().endsWith('.txt')) {
            const base = path.basename(f, '.txt').trim();
            candidates.add(base);
            const m = base.match(/(?:SENHA\s*)?([^\s]+)/i);
            if (m && m[1]) candidates.add(m[1].trim());

            try {
              const content = fs.readFileSync(path.join(d, f), 'utf8').trim();
              if (content.length > 0 && content.length < 50) {
                candidates.add(content);
                candidates.add(content.replace(/\r|\n/g, '').trim());
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  });

  return Array.from(candidates);
}

function unlockAndGetCert(pfxPath, passwordCandidates) {
  const buf = fs.readFileSync(pfxPath);
  const pfxDer = forge.util.createBuffer(buf.toString('binary'));
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);

  for (const pw of passwordCandidates) {
    try {
      const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, pw);
      let cert = null;
      for (const sc of pfx.safeContents) {
        for (const sb of sc.safeBags) {
          if (sb.cert) {
            cert = sb.cert;
            break;
          }
        }
        if (cert) break;
      }
      if (cert) {
        return {
          success: true,
          password: pw,
          validTo: cert.validity.notAfter,
          subject: cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ')
        };
      }
    } catch (_) {}
  }
  return { success: false };
}

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
  } catch (_) {}
  return res;
}

async function run() {
  console.log('🚀 INICIANDO INSTALAÇÃO AUTOMÁTICA DE CERTIFICADOS DIGITAIS A1...');

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

  const companies = db.prepare("SELECT id, cnpj, razao_social, cert_filename FROM companies WHERE status = 'ativo'").all();

  const updateStmt = db.prepare(`
    UPDATE companies SET
      cert_filename = ?,
      cert_password_enc = ?,
      cert_valid_until = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  let installedCount = 0;
  let alreadyValidCount = 0;
  let failedPasswordCount = 0;
  let notFoundCount = 0;

  for (const comp of companies) {
    const cleanCnpj = (comp.cnpj || '').replace(/\D/g, '');
    if (!cleanCnpj) continue;

    // Se já tem certificado e o arquivo existe localmente, verifica se precisa de atualização
    if (comp.cert_filename) {
      const existingCert = path.join(certsDir, comp.cert_filename);
      if (fs.existsSync(existingCert)) {
        alreadyValidCount++;
        continue;
      }
    }

    const matchedPfx = allPfx.filter(p => {
      const base = path.basename(p.path).replace(/\D/g, '');
      return base.includes(cleanCnpj);
    });

    if (matchedPfx.length === 0) {
      notFoundCount++;
      continue;
    }

    matchedPfx.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    let unlocked = null;
    let chosenPfx = null;

    for (const pfxItem of matchedPfx) {
      const pwCandidates = findPasswordCandidates(pfxItem.path);
      const res = unlockAndGetCert(pfxItem.path, pwCandidates);
      if (res.success) {
        unlocked = res;
        chosenPfx = pfxItem.path;
        break;
      }
    }

    if (unlocked && chosenPfx) {
      const targetFilename = `cert_${comp.id}_${Date.now()}.pfx`;
      const targetPath = path.join(certsDir, targetFilename);
      fs.copyFileSync(chosenPfx, targetPath);

      const encPw = encryptText(unlocked.password);
      const validUntilIso = unlocked.validTo ? new Date(unlocked.validTo).toISOString() : null;

      updateStmt.run(targetFilename, encPw, validUntilIso, comp.id);
      installedCount++;
      console.log(`✅ [INSTALADO] ${comp.cnpj} - ${comp.razao_social}`);
      console.log(`   Arquivo: ${path.basename(chosenPfx)} | Válido até: ${validUntilIso}`);
    } else {
      failedPasswordCount++;
      console.warn(`⚠️ [SENHA NÃO ENCONTRADA] ${comp.cnpj} - ${comp.razao_social} (${matchedPfx.length} arquivos testados)`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`RESUMO DA INSTALAÇÃO DE CERTIFICADOS:`);
  console.log(` - Novos certificados instalados: ${installedCount}`);
  console.log(` - Já estavam instalados e válidos: ${alreadyValidCount}`);
  console.log(` - Falha de senha: ${failedPasswordCount}`);
  console.log(` - Arquivo PFX não encontrado no Setor Legal: ${notFoundCount}`);
  console.log(`======================================================`);
}

run();
