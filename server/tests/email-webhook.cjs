const assert = require('node:assert/strict');
const path = require('path');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');

// Carrega o controlador compilado em dist
const { webhookController } = require('../dist/controllers/webhookController.js');

console.log('🧪 [TEST] Iniciando bateria de testes do Webhook Seguro de E-mail...');

// Helper para mock de Request/Response
function createMockReqRes(reqOverrides = {}) {
  const req = {
    headers: {},
    query: {},
    body: {},
    ...reqOverrides
  };

  let statusCode = 200;
  let jsonResponse = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getJsonResponse: () => jsonResponse
  };
}

(async () => {
  // Teste 1: Rejeição sem token de segurança
  {
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      body: { xml: '<xml>dummy</xml>' }
    });
    await webhookController.handleEmailInvoicesWebhook(req, res);
    assert.equal(getStatusCode(), 401, 'Deve retornar HTTP 401 sem token');
    assert.equal(getJsonResponse().code, 'UNAUTHORIZED_WEBHOOK_TOKEN');
    console.log('✅ Teste 1: Bloqueio de acesso não autenticado aprovado.');
  }

  // Teste 2: Rejeição com token incorreto
  {
    const { req, res, getStatusCode } = createMockReqRes({
      headers: { 'x-webhook-token': 'token_errado_hacker' },
      body: { xml: '<xml>dummy</xml>' }
    });
    await webhookController.handleEmailInvoicesWebhook(req, res);
    assert.equal(getStatusCode(), 401, 'Deve retornar HTTP 401 com token incorreto');
    console.log('✅ Teste 2: Bloqueio de token inválido aprovado.');
  }

  // Teste 3: Bloqueio de arquivo executável perigoso (.exe / .scr)
  {
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      headers: { 'x-webhook-token': 'vianfe_email_sec_2026_viacont' },
      body: {
        fileName: 'DANFE_NotaFiscal_9821.exe',
        xmlBase64: Buffer.from('fake exe content').toString('base64')
      }
    });
    await webhookController.handleEmailInvoicesWebhook(req, res);
    assert.equal(getStatusCode(), 403, 'Deve bloquear extensão .exe com HTTP 403');
    assert.equal(getJsonResponse().code, 'FORBIDDEN_FILE_EXTENSION');
    console.log('✅ Teste 3: Barreira anti-malware (bloqueio de .exe) aprovada.');
  }

  // Teste 4: Rejeição de payload vazio
  {
    const { req, res, getStatusCode } = createMockReqRes({
      headers: { 'x-webhook-token': 'vianfe_email_sec_2026_viacont' },
      body: {}
    });
    await webhookController.handleEmailInvoicesWebhook(req, res);
    assert.equal(getStatusCode(), 400, 'Deve retornar 400 se nenhum arquivo for enviado');
    console.log('✅ Teste 4: Rejeição de requisição vazia aprovada.');
  }

  // Teste 5: Rejeição de XML corrompido / falso
  {
    const { req, res, getStatusCode, getJsonResponse } = createMockReqRes({
      headers: { 'x-webhook-token': 'vianfe_email_sec_2026_viacont' },
      body: {
        fileName: 'nota_falsa.xml',
        xml: '<corpo>texto qualquer que nao e fiscal</corpo>'
      }
    });
    await webhookController.handleEmailInvoicesWebhook(req, res);
    assert.equal(getStatusCode(), 200);
    const json = getJsonResponse();
    assert.equal(json.summary.totalErrors, 1);
    assert.equal(json.results[0].status, 'error');
    console.log('✅ Teste 5: Rejeição de XML corrompido/não-fiscal aprovada.');
  }

  console.log('\n🎉 TODOS OS TESTES DO WEBHOOK DE E-MAIL PASSARAM COM SUCESSO!');
})().catch(err => {
  console.error('❌ Falha nos testes do webhook:', err);
  process.exit(1);
});
