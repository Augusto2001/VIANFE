const assert = require('assert');
const path = require('path');

console.log('🧪 INICIANDO BATERIA DE TESTES DA FASE 1 — GOOGLE DRIVE & REPROCESSAMENTO');

const { GoogleDriveService } = require('../dist/services/googleDriveService.js');

// Teste 1: Mock de DB sem credenciais
let mockValue = null;
const mockDb = {
  prepare: (sql) => ({
    get: (key) => mockValue ? { value: mockValue } : undefined,
    run: (val, now) => { mockValue = val; }
  })
};

// Teste 1: Instancia sem credencial
const service = new GoogleDriveService();
// Force inject mock db behavior if needed or test functions
console.log('\n[TESTE 1] Validando status not_configured quando sem credenciais...');
assert.equal(service.getStatus().isConfigured, false);
assert.equal(service.getStatus().mode, 'not_configured');
console.log('✅ [APROVADO] Status correto quando sem credenciais.');

// Teste 2: Validar rejeição de JSON inválido
console.log('\n[TESTE 2] Validando rejeição de JSON de credencial sem campos obrigatórios...');
assert.throws(() => {
  service.saveCredentials(JSON.stringify({ some_other_field: "123" }));
}, /Formato JSON de credencial Google inválido/);
console.log('✅ [APROVADO] Rejeitou JSON inválido com sucesso.');

// Teste 3: Validar que aceita formato OAuth2 (sem gravar senhas reais)
console.log('\n[TESTE 3] Validando que saveCredentials aceita estrutura OAuth2 válida...');
// Mock db insertion for testing
const originalPrepare = require('../dist/database/db.js').db.prepare;
let savedJson = null;
require('../dist/database/db.js').db.prepare = (sql) => {
  if (sql.includes('INSERT INTO system_settings')) {
    return {
      run: (json, now) => { savedJson = json; }
    };
  }
  if (sql.includes('SELECT value FROM system_settings')) {
    return {
      get: (key) => savedJson ? { value: savedJson } : undefined
    };
  }
  return { get: () => undefined, run: () => {}, all: () => [] };
};

const dummyOAuth = {
  clientId: 'dummy-client-id.apps.googleusercontent.com',
  clientSecret: 'dummy-secret',
  oauthTokenData: {
    refresh_token: 'dummy-refresh-token',
    access_token: 'dummy-access-token'
  }
};

const saveRes = service.saveCredentials(JSON.stringify(dummyOAuth));
assert.equal(saveRes.success, true);
assert.equal(service.getStatus().isConfigured, true);
assert.equal(service.getStatus().mode, 'google_api');
console.log('✅ [APROVADO] Credencial OAuth2 salva e status alterado para google_api.');

// Restore db.prepare
require('../dist/database/db.js').db.prepare = originalPrepare;

console.log('\n🏁 [TODOS OS TESTES DA FASE 1 FORAM APROVADOS COM SUCESSO]');
