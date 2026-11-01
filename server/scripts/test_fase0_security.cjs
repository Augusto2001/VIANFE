const assert = require('assert');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.log('🧪 INICIANDO BATERIA DE TESTES DA FASE 0 — ESTABILIDADE & SEGURANÇA');

// Teste 1: Importar o companyController compilado (dist)
const { companyController } = require('../dist/controllers/companyController.js');

let listResponseData = null;
let getByIdResponseData = null;

const mockReqList = {};
const mockResList = {
  json: (body) => { listResponseData = body; return mockResList; },
  status: (code) => mockResList
};

// Executar companyController.list()
companyController.list(mockReqList, mockResList).then(async () => {
  console.log('\n[TESTE 1] Validando lista branca em GET /api/companies...');
  assert(listResponseData && listResponseData.success === true, 'A resposta de list() deve ter success: true');
  assert(Array.isArray(listResponseData.data), 'data deve ser um array de empresas');
  assert(listResponseData.data.length > 0, 'Deve retornar ao menos 1 empresa');

  const forbiddenKeys = ['cert_password_enc', 'nfse_senha_prefeitura', 'focus_nfe_token'];
  
  for (const comp of listResponseData.data) {
    for (const key of forbiddenKeys) {
      assert(comp[key] === undefined, `FALHA DE SEGURANÇA: Empresa ${comp.razao_social} expõe o campo '${key}'!`);
    }
    // Validar presença de campos públicos essenciais
    assert(comp.id, 'Deve conter id');
    assert(comp.cnpj, 'Deve conter cnpj');
    assert(comp.razao_social, 'Deve conter razao_social');
  }
  console.log(`✅ [APROVADO] Todas as ${listResponseData.data.length} empresas listadas SEM expor cert_password_enc, nfse_senha_prefeitura ou focus_nfe_token.`);

  // Teste 2: Validar getById()
  console.log('\n[TESTE 2] Validando lista branca em GET /api/companies/:id...');
  const firstId = listResponseData.data[0].id;
  const mockReqGet = { params: { id: firstId } };
  const mockResGet = {
    json: (body) => { getByIdResponseData = body; return mockResGet; },
    status: (code) => mockResGet
  };

  await companyController.getById(mockReqGet, mockResGet);
  assert(getByIdResponseData && getByIdResponseData.success === true, 'getById deve retornar success: true');
  const single = getByIdResponseData.data;
  for (const key of forbiddenKeys) {
    assert(single[key] === undefined, `FALHA DE SEGURANÇA: getById expõe o campo '${key}'!`);
  }
  console.log(`✅ [APROVADO] getById para ${single.razao_social} validado: nenhum segredo vazado.`);

  // Teste 3: Validar middleware requireMaster
  console.log('\n[TESTE 3] Validando trava de alçada requireMaster...');
  const { requireMaster } = require('../dist/middleware/authMiddleware.js');
  
  let rejectedStatus = null;
  let rejectedBody = null;
  const mockResAuth = {
    status: (code) => { rejectedStatus = code; return mockResAuth; },
    json: (body) => { rejectedBody = body; return mockResAuth; }
  };

  // 3.1: Sem usuário logado -> 401
  let nextCalled = false;
  requireMaster({}, mockResAuth, () => { nextCalled = true; });
  assert.strictEqual(rejectedStatus, 401, 'Deve retornar 401 sem autenticação');
  assert(!nextCalled, 'next() não deve ser chamado');

  // 3.2: Usuário comum (client) -> 403
  nextCalled = false;
  requireMaster({ user: { id: 'u1', role: 'client', email: 'user@empresa.com' } }, mockResAuth, () => { nextCalled = true; });
  assert.strictEqual(rejectedStatus, 403, 'Deve retornar 403 para role client');
  assert(!nextCalled, 'next() não deve ser chamado');

  // 3.3: Usuário admin comum (não-master) -> 403
  nextCalled = false;
  requireMaster({ user: { id: 'u2', role: 'admin', email: 'assistente@viacont.com.br', name: 'Assistente' } }, mockResAuth, () => { nextCalled = true; });
  assert.strictEqual(rejectedStatus, 403, 'Deve retornar 403 para admin não-master');
  assert(!nextCalled, 'next() não deve ser chamado');

  // 3.4: Diretor Augusto (Master) -> next() aprovado
  nextCalled = false;
  requireMaster({ user: { id: 'u3', role: 'admin', email: 'augusto@viacont.com.br', name: 'Augusto' } }, mockResAuth, () => { nextCalled = true; });
  assert(nextCalled, 'next() DEVE ser chamado para Diretor Augusto');

  // 3.5: Diretora Val (Master) -> next() aprovado
  nextCalled = false;
  requireMaster({ user: { id: 'u4', role: 'admin', email: 'val@viacont.com.br', name: 'Val' } }, mockResAuth, () => { nextCalled = true; });
  assert(nextCalled, 'next() DEVE ser chamado para Diretora Val');

  console.log('✅ [APROVADO] Middleware requireMaster validado: restringe exclusivamente à Diretoria Executiva.');

  // Teste 4: Validar controller.delete()
  console.log('\n[TESTE 4] Validando controller.delete()...');
  let deleteStatus = null;
  let deleteBody = null;
  const mockResDel = {
    status: (code) => { deleteStatus = code; return mockResDel; },
    json: (body) => { deleteBody = body; return mockResDel; }
  };
  await companyController.delete({ params: { id: firstId } }, mockResDel);
  assert.strictEqual(deleteStatus, 403, 'delete deve responder 403 para preservar acervo probatório');
  console.log('✅ [APROVADO] companyController.delete responde 403 resguardando acervo fiscal probatório.');

  console.log('\n🎉 TODOS OS TESTES DA FASE 0 PASSARAM COM SUCESSO ABSOLUTO!');
}).catch(err => {
  console.error('❌ ERRO NO TESTE DA FASE 0:', err);
  process.exit(1);
});
