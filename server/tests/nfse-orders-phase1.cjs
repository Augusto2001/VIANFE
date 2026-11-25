const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite');

const JWT_SECRET = 'isolated_private_jwt_secret_for_nfse_orders_phase1_test';
const SERVICE_TOKEN = 'isolated_service_token_nfse_orders_phase1_0123456789';

// 1. Test requireNfseOrderAuth middleware in isolation
const authDb = new DatabaseSync(':memory:');
authDb.exec(`
  CREATE TABLE users (id TEXT, tenant_id TEXT, name TEXT, email TEXT, role TEXT, is_active INTEGER);
  INSERT INTO users VALUES ('u_active', 'tenant_viacont_master', 'Admin', 'a@v.com', 'admin', 1);
  INSERT INTO users VALUES ('u_inactive', 'tenant_viacont_master', 'Inativo', 'i@v.com', 'admin', 0);
`);

const authCtx = {
  exports: {},
  process: { env: { JWT_SECRET, NFSE_ORDERS_SERVICE_TOKEN: SERVICE_TOKEN } },
  Buffer,
  require: (id) => {
    if (id === 'crypto') return crypto;
    if (id === 'jsonwebtoken') return jwt;
    if (id.includes('database/db')) return { db: authDb };
    return require(id);
  }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/middleware/nfseOrderAuth.js'), 'utf8'), authCtx);
const { requireNfseOrderAuth } = authCtx.exports;

function checkAuth(headers = {}, query = {}) {
  let status = 0;
  let body = null;
  let passed = false;
  const req = { headers, query };
  const res = { status: (n) => ({ json: (j) => { status = n; body = j; } }) };
  requireNfseOrderAuth(req, res, () => { passed = true; });
  return { status: passed ? 200 : status, body, user: req.user };
}

// Negative: no header
assert.equal(checkAuth({}).status, 401);
// Negative: token in query string only (must reject per NFSE_EMISSAO_SEGURA)
assert.equal(checkAuth({}, { token: SERVICE_TOKEN }).status, 401);
// Negative: wrong bearer token
assert.equal(checkAuth({ authorization: 'Bearer wrong-token' }).status, 401);
// Negative: inactive user JWT
const inactiveJwt = jwt.sign({ id: 'u_inactive', tenant_id: 'tenant_viacont_master', role: 'admin' }, JWT_SECRET);
assert.equal(checkAuth({ authorization: `Bearer ${inactiveJwt}` }).status, 403);
// Positive: dedicated service token
const svcRes = checkAuth({ authorization: `Bearer ${SERVICE_TOKEN}` });
assert.equal(svcRes.status, 200);
assert.equal(svcRes.user.role, 'service');
// Positive: scoped service JWT
const scopedJwt = jwt.sign({ type: 'service', scope: 'nfse:orders', tenant_id: 'tenant_viacont_master' }, JWT_SECRET);
assert.equal(checkAuth({ authorization: `Bearer ${scopedJwt}` }).status, 200);
// Positive: active user JWT
const activeJwt = jwt.sign({ id: 'u_active', tenant_id: 'tenant_viacont_master', role: 'admin' }, JWT_SECRET);
assert.equal(checkAuth({ authorization: `Bearer ${activeJwt}` }).status, 200);

// 2. Verify api.js attaches requireNfseOrderAuth to all /nfse/pedidos routes
const apiSource = fs.readFileSync(require.resolve('../dist/routes/api.js'), 'utf8');
assert.match(apiSource, /router\.post\(['"]\/nfse\/pedidos['"],\s*[^,]*requireNfseOrderAuth/);
assert.match(apiSource, /router\.get\(['"]\/nfse\/pedidos\/:protocolo['"],\s*[^,]*requireNfseOrderAuth/);
assert.match(apiSource, /router\.get\(['"]\/nfse\/pedidos\/:protocolo\/previa['"],\s*[^,]*requireNfseOrderAuth/);

// 3. Verify NfseOrderService blocks emite_nfse=0 and duplicate same-day orders
const orderDb = new DatabaseSync(':memory:');
orderDb.exec(`
  CREATE TABLE companies (
    id TEXT PRIMARY KEY, tenant_id TEXT, cnpj TEXT, razao_social TEXT, uf TEXT,
    status TEXT, emite_nfse INTEGER, inscricao_municipal TEXT, nfse_prefeitura_padrao TEXT
  );
  CREATE TABLE client_nfse_profiles (
    id TEXT PRIMARY KEY, company_id TEXT, tenant_id TEXT, cnpj_prestador TEXT UNIQUE,
    item_servico_lc116 TEXT, codigo_tributacao_nacional TEXT, aliquota_iss REAL,
    iss_retido INTEGER, codigo_municipio_padrao TEXT, descricao_servico_padrao TEXT,
    limite_valor_nota REAL, optante_simples_nacional TEXT, exige_aprovacao_viaos INTEGER,
    ativo INTEGER, created_at TEXT, updated_at TEXT
  );
  CREATE TABLE nfse_order_requests (
    id TEXT PRIMARY KEY, protocolo TEXT UNIQUE, company_id TEXT, cnpj_prestador TEXT,
    tomador_doc TEXT, tomador_nome TEXT, valor_servicos REAL, discriminacao TEXT,
    status TEXT, motivo_pendencia TEXT, dps_xml TEXT, dps_id TEXT, previa_pdf_path TEXT,
    viaos_tarefa_id TEXT, solicitante_telefone TEXT, solicitante_origem TEXT,
    ambiente TEXT, created_at TEXT, updated_at TEXT
  );
  INSERT INTO companies VALUES ('c_com', 'tenant_viacont_master', '54879195000110', 'COMERCIO TESTE LTDA', 'BA', 'ativo', 0, NULL, 'Salvador');
  INSERT INTO companies VALUES ('c_srv', 'tenant_viacont_master', '11156091000175', 'VIACONT INOVACOES CONTABEIS LTDA', 'BA', 'ativo', 1, '72516200143', 'Salvador');
  INSERT INTO client_nfse_profiles VALUES ('p1', 'c_srv', 'tenant_viacont_master', '11156091000175', '17.19', '1719001', 5.0, 0, '2927408', 'HONORÁRIOS CONTÁBEIS', 999999.0, '2', 1, 1, datetime('now'), datetime('now'));
`);

const os = require('node:os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nfse-orders-phase1-'));
let fetchCalls = [];
const mockFetch = async (url, opts) => {
  fetchCalls.push({ url, method: opts?.method || 'GET' });
  if (String(url).includes('/api/tarefas/meta/empresas')) {
    return { ok: true, status: 200, json: async () => ({ sucesso: true, dados: [{ id: 88, codigo: '87', cnpj: '11156091000175', nome: 'VIACONT' }] }) };
  }
  if (String(url).endsWith('/api/tarefas')) {
    return { ok: true, status: 201, json: async () => ({ sucesso: true, tarefa: { id: 'VO-2026-999999' } }) };
  }
  if (String(url).includes('/historico/anexos')) {
    return { ok: true, status: 201, json: async () => ({ sucesso: true }) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

const { nfsePdfGenerator } = require('../dist/services/nfsePdfGenerator.js');
const serviceCtx = {
  exports: {},
  console: { warn: () => {}, log: () => {}, error: () => {} },
  process: {
    cwd: () => tmpDir,
    env: { VIAOS_API_URL: 'http://viaos:3333', VIAOS_JWT_SECRET: 'isolated_viaos_jwt_secret_for_test' }
  },
  fetch: mockFetch,
  FormData,
  Blob,
  Buffer,
  require: (id) => {
    if (id === 'fs') return fs;
    if (id === 'path') return path;
    if (id === 'uuid') return { v4: () => crypto.randomUUID() };
    if (id === 'jsonwebtoken') return jwt;
    if (id.includes('database/db')) return { db: orderDb };
    if (id.includes('nfsePdfGenerator')) return { nfsePdfGenerator };
    if (id.includes('utils/crypto')) return { cleanNumeric: (v) => String(v || '').replace(/\D/g, '') };
    return require(id);
  }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/services/nfse/NfseOrderService.js'), 'utf8'), serviceCtx);
const { NfseOrderService } = serviceCtx.exports;

(async () => {
  // Commerce company emite_nfse=0 must be blocked
  const comRes = await NfseOrderService.processOrder({
    cnpj_prestador: '54879195000110',
    tomador_doc: '00000000000191',
    tomador_nome: 'TOMADOR TESTE',
    valor_servicos: 10,
    ambiente: 'homologacao',
    tenant_id: 'tenant_viacont_master'
  });
  assert.equal(comRes.sucesso, false);
  assert.equal(comRes.status, 'COM_IMPEDIMENTO');
  assert.equal(comRes.impedimento_motivo, 'EMPRESA_NAO_HABILITADA_NFSE');
  assert.equal(fetchCalls.length, 0);

  // Valid pilot order in homologacao
  const okRes = await NfseOrderService.processOrder({
    cnpj_prestador: '11156091000175',
    tomador_doc: '00000000000191',
    tomador_nome: 'TOMADOR HOMOLOGACAO TESTE',
    valor_servicos: 10,
    descricao: 'TESTE FASE 1 — NÃO EMITIR',
    protocolo_zapcont: 'PROT-20261124-000001',
    ambiente: 'homologacao',
    tenant_id: 'tenant_viacont_master'
  });
  assert.equal(okRes.sucesso, true);
  assert.equal(okRes.status, 'AGUARDANDO_APROVACAO');
  assert.equal(okRes.viaos_tarefa_id, 'VO-2026-999999');
  assert.equal(okRes.previa_anexada_viaos, true);
  assert.ok(okRes.previa_pdf_path && fs.existsSync(okRes.previa_pdf_path));
  assert.ok(fs.readFileSync(okRes.previa_pdf_path).subarray(0, 5).toString('ascii') === '%PDF-');
  assert.equal(fetchCalls.length, 3); // meta/empresas, POST /api/tarefas, POST /historico/anexos

  // Duplicate same-day order must be blocked without extra fetch or preview
  const dupRes = await NfseOrderService.processOrder({
    cnpj_prestador: '11156091000175',
    tomador_doc: '00000000000191',
    tomador_nome: 'TOMADOR HOMOLOGACAO TESTE',
    valor_servicos: 10,
    descricao: 'TESTE FASE 1 — NÃO EMITIR',
    ambiente: 'homologacao',
    tenant_id: 'tenant_viacont_master'
  });
  assert.equal(dupRes.sucesso, false);
  assert.equal(dupRes.duplicado, true);
  assert.equal(dupRes.impedimento_motivo, 'PEDIDO_DUPLICADO_MESMO_DIA');
  assert.equal(dupRes.protocolo, okRes.protocolo);
  assert.equal(fetchCalls.length, 3); // no new ViaOS calls!

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('PASS: nfse-orders-phase1 (auth, emite_nfse=0 block, preview PDF, ViaOS hook + PDF upload, anti-duplicidade).');
})().catch((err) => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
