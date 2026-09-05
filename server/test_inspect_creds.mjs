import { db } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';

const comp = db.prepare("SELECT id, razao_social, cnpj, nfse_usuario_prefeitura, nfse_senha_prefeitura FROM companies WHERE cnpj = '11156091000175'").get();

let passDecrypted = '';
if (comp && comp.nfse_senha_prefeitura) {
  try {
    passDecrypted = decryptText(comp.nfse_senha_prefeitura);
  } catch (_) {
    passDecrypted = comp.nfse_senha_prefeitura;
  }
}

console.log('=== Credenciais Prefeitura Viacont ===');
console.log('CNPJ:', comp?.cnpj);
console.log('Usuario:', comp?.nfse_usuario_prefeitura || comp?.cnpj);
console.log('Senha cadastrada:', passDecrypted ? '****** (Comprimento: ' + passDecrypted.length + ' chars)' : 'NÃO CONFIGURADA');
