const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const matcher = require('../dist/utils/driveFolderMatcher.js');

function loadGoogleDriveService(dbStub) {
  const exportsObj = {};
  const stub = {
    fs: { existsSync: () => true, createReadStream: () => ({}) },
    path,
    googleapis: { google: {} },
    '../database/db.js': { db: dbStub || { prepare: () => ({ get: () => undefined }) } },
  };
  const logs = [];
  const customConsole = {
    ...console,
    warn: (...args) => logs.push(args.join(' ')),
    error: (...args) => logs.push(args.join(' ')),
    log: () => {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../dist/services/googleDriveService.js'), 'utf8'),
    {
      exports: exportsObj,
      require: (n) => {
        if (n in stub) return stub[n];
        throw new Error('Unexpected dependency ' + n);
      },
      console: customConsole,
    }
  );
  return { service: exportsObj.googleDriveService, logs };
}

(async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vianfe-drive-test-'));
  try {
    const ativosDir = path.join(tmpRoot, 'CLIENTES ATIVOS');
    const inativosDir = path.join(tmpRoot, 'CLIENTES INATIVOS');
    const fallbackDir = path.join(tmpRoot, 'local-fallback');
    fs.mkdirSync(ativosDir, { recursive: true });
    fs.mkdirSync(inativosDir, { recursive: true });

    // 1. Pasta com CNPJ mascarado (pontuação) e sem máscara
    assert.equal(matcher.folderMatchesCnpj('EMPRESA ALFA LTDA - 12.345.678/0001-90', '12345678000190'), true);
    assert.equal(matcher.folderMatchesCnpj('EMPRESA BETA LTDA 98765432000110', '98.765.432/0001-10'), true);

    const maskedFolder = path.join(ativosDir, 'EMPRESA ALFA LTDA - 12.345.678-0001-90');
    const unmaskedFolder = path.join(ativosDir, 'EMPRESA BETA LTDA 98765432000110');
    const inactiveFolder = path.join(inativosDir, 'COMERCIO GAMA LTDA - 11.222.333-0001-44');

    fs.mkdirSync(maskedFolder, { recursive: true });
    fs.mkdirSync(unmaskedFolder, { recursive: true });
    fs.mkdirSync(inactiveFolder, { recursive: true });

    // Pré-criar subpastas parciais em maskedFolder para testar não duplicação
    const existingSetor = path.join(maskedFolder, 'SETOR FISCAL');
    const existingNfe = path.join(existingSetor, 'NFe');
    const existingYear = path.join(existingNfe, '2026');
    fs.mkdirSync(existingYear, { recursive: true });

    // Caso 1: CNPJ com máscara no nome da pasta + subpastas já existentes não duplicadas
    const foundMasked = matcher.getClientFolderInGDrive('EMPRESA ALFA', '12345678000190', undefined, ativosDir);
    assert.equal(foundMasked, maskedFolder);

    const pathsMasked = matcher.getInvoiceStoragePaths(
      'EMPRESA ALFA',
      '2026-11-12',
      '35261112345678000190550010000001001000001000',
      fallbackDir,
      '12.345.678/0001-90',
      'saida',
      undefined,
      ativosDir
    );
    const expectedMaskedSaidas = path.join(maskedFolder, 'SETOR FISCAL', 'NFe', '2026', '11', 'Saidas');
    assert.equal(path.dirname(pathsMasked.xmlFilePath), expectedMaskedSaidas);
    assert.equal(path.dirname(pathsMasked.pdfFilePath), expectedMaskedSaidas);
    assert.equal(fs.readdirSync(maskedFolder).filter(f => f.toUpperCase().includes('FISCAL')).length, 1);
    assert.equal(fs.readdirSync(existingSetor).filter(f => f.toUpperCase() === 'NFE').length, 1);
    assert.equal(fs.readdirSync(existingNfe).filter(f => f === '2026').length, 1);

    // Caso 2: CNPJ sem máscara no nome da pasta
    const foundUnmasked = matcher.getClientFolderInGDrive('OI OUTRO NOME', '98.765.432/0001-10', undefined, ativosDir);
    assert.equal(foundUnmasked, unmaskedFolder);
    const pathsUnmasked = matcher.getInvoiceStoragePaths(
      'OI OUTRO NOME',
      '2026-10-05',
      '29261098765432000110550010000002001000002000',
      fallbackDir,
      '98.765.432/0001-10',
      'saida',
      undefined,
      ativosDir
    );
    assert.equal(
      path.dirname(pathsUnmasked.xmlFilePath),
      path.join(unmaskedFolder, 'SETOR FISCAL', 'NFe', '2026', '10', 'Saidas')
    );

    // Caso 3: Cliente em subpasta de inativos (buscando a partir de ativosDir ou tmpRoot)
    const foundInactiveFromAtivos = matcher.getClientFolderInGDrive('COMERCIO GAMA', '11222333000144', undefined, ativosDir);
    assert.equal(foundInactiveFromAtivos, inactiveFolder);
    const foundInactiveFromRoot = matcher.getClientFolderInGDrive('COMERCIO GAMA', '11.222.333/0001-44', undefined, tmpRoot);
    assert.equal(foundInactiveFromRoot, inactiveFolder);

    // Caso 4: Cliente não encontrado gera log e não cria pasta raiz duplicada
    const ativosBefore = fs.readdirSync(ativosDir).sort();
    const inativosBefore = fs.readdirSync(inativosDir).sort();
    const rootBefore = fs.readdirSync(tmpRoot).sort();

    const warnMessages = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnMessages.push(args.join(' '));
    let notFoundResult;
    try {
      notFoundResult = matcher.getClientFolderInGDrive('EMPRESA INEXISTENTE LTDA', '55.666.777/0001-88', undefined, ativosDir);
    } finally {
      console.warn = origWarn;
    }

    assert.equal(notFoundResult, null);
    assert.ok(
      warnMessages.some(m => m.includes('55666777000188') && m.includes('não encontrada')),
      'Deve registrar em log quando a pasta do cliente não for encontrada pelo CNPJ'
    );
    assert.deepEqual(fs.readdirSync(ativosDir).sort(), ativosBefore, 'Não deve criar pasta raiz em CLIENTES ATIVOS');
    assert.deepEqual(fs.readdirSync(inativosDir).sort(), inativosBefore, 'Não deve criar pasta raiz em CLIENTES INATIVOS');
    assert.deepEqual(fs.readdirSync(tmpRoot).sort(), rootBefore, 'Não deve criar pasta na raiz do Drive');

    // =========================================================================
    // Parte 2: Simulação da API do Google Drive (GoogleDriveService mock)
    // =========================================================================
    const { service, logs } = loadGoogleDriveService();
    service.isConfigured = true;

    const folderTree = {
      root: [
        { id: 'dir_ativos', name: 'CLIENTES ATIVOS', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'dir_inativos', name: 'CLIENTES INATIVOS', mimeType: 'application/vnd.google-apps.folder' },
      ],
      dir_ativos: [
        { id: 'cli_masked', name: 'CLIENTE MASK - 12.345.678/0001-90', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'cli_unmasked', name: 'CLIENTE UNMASK 98765432000110', mimeType: 'application/vnd.google-apps.folder' },
      ],
      dir_inativos: [
        { id: 'cli_inativo', name: 'CLIENTE INATIVO - 11.222.333/0001-44', mimeType: 'application/vnd.google-apps.folder' },
      ],
      cli_inativo: [
        { id: 'sf_existing', name: 'SETOR FISCAL', mimeType: 'application/vnd.google-apps.folder' },
      ],
      sf_existing: [
        { id: 'nfe_existing', name: 'NFe', mimeType: 'application/vnd.google-apps.folder' },
      ],
      nfe_existing: [
        { id: 'year_existing', name: '2026', mimeType: 'application/vnd.google-apps.folder' },
      ],
      year_existing: [],
    };

    const createdFolders = [];
    let idSeq = 1;
    service.driveClient = {
      files: {
        list: async ({ q }) => {
          const m = q.match(/'([^']+)' in parents/);
          const parentId = m ? m[1] : 'root';
          return { data: { files: folderTree[parentId] || [] } };
        },
        create: async ({ requestBody }) => {
          const newId = `created_${idSeq++}`;
          const parentId = requestBody.parents[0];
          const entry = { id: newId, name: requestBody.name, mimeType: requestBody.mimeType };
          if (!folderTree[parentId]) folderTree[parentId] = [];
          folderTree[parentId].push(entry);
          folderTree[newId] = [];
          createdFolders.push({ id: newId, name: requestBody.name, parentId });
          return { data: { id: newId } };
        },
      },
    };

    // Mock Drive 1: Localizar com máscara, sem máscara e em inativos
    const dMasked = await service.findClientFolderByCnpj('12345678000190', 'root', 'CLIENTE MASK');
    assert.equal(dMasked?.id, 'cli_masked');

    const dUnmasked = await service.findClientFolderByCnpj('98.765.432/0001-10', 'root', 'CLIENTE UNMASK');
    assert.equal(dUnmasked?.id, 'cli_unmasked');

    const dInactive = await service.findClientFolderByCnpj('11222333000144', 'root', 'CLIENTE INATIVO');
    assert.equal(dInactive?.id, 'cli_inativo');

    // Mock Drive 2: Gravar em <pasta do cliente>/SETOR FISCAL/NFe/2026/11/Saidas sem duplicar subpastas existentes
    const saidasId = await service.ensureCompanyFolderStructure(
      'root',
      'CLIENTE INATIVO',
      '2026',
      '11',
      'Saidas',
      '11.222.333/0001-44'
    );
    assert.ok(saidasId);
    // SETOR FISCAL, NFe e 2026 já existiam em cli_inativo -> só '11' e 'Saidas' devem ter sido criadas
    assert.deepEqual(
      createdFolders.map(c => ({ name: c.name, parentId: c.parentId })),
      [
        { name: '11', parentId: 'year_existing' },
        { name: 'Saidas', parentId: 'created_1' },
      ]
    );

    // Mock Drive 3: Cliente não encontrado gera log e não cria pasta raiz duplicada
    const createdCountBefore = createdFolders.length;
    logs.length = 0;
    await assert.rejects(
      () => service.ensureCompanyFolderStructure('root', 'NAO EXISTE LTDA', '2026', '11', 'Saidas', '77.888.999/0001-00'),
      /não encontrada/
    );
    assert.equal(createdFolders.length, createdCountBefore, 'Não deve criar pasta raiz quando CNPJ não for encontrado');
    assert.ok(
      logs.some(l => l.includes('77888999000100') && l.includes('não encontrada')),
      'Deve gerar log informando que a pasta do cliente não foi encontrada'
    );

    console.log('PASS: matcher de pastas do Drive por CNPJ (com/sem máscara, inativos, subpastas sem duplicação e log sem criar raiz duplicada).');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
