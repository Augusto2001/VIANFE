import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, XMLS_DIR, PDFS_DIR } from './dist/database/db.js';
import { SalvadorNfseAdapter } from './dist/services/nfse/adapters/SalvadorNfseAdapter.js';

async function emitAndSaveRps359() {
  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  const nextRps = 359;

  console.log(`🚀 Emitindo e gravando RPS Nº ${nextRps} para Viacont...`);

  const adapter = new SalvadorNfseAdapter();
  const payload = {
    company: comp,
    numeroRps: String(nextRps),
    serieRps: '1',
    tipoRps: '1',
    optanteSimplesNacional: '2',
    incentivadorCultural: '2',
    naturezaOperacao: '1',
    tomadorCnpjCpf: '34.581.300/0001-23',
    tomadorNome: 'SALVADOR ESCRITORIO VIRTUAL LTDA',
    valorServicos: 10.00,
    aliquotaIss: 5.00,
    valorIss: 0.50,
    issRetido: false,
    itemServico: '17.01',
    cnae: '6920601',
    codigoTributacaoMunicipio: '17.01',
    codigoMunicipio: '2927408',
    discriminacao: 'Prestação de serviços contábeis e administrativos - Emissão de teste e validação de sistema ViaNFe.'
  };

  const res = await adapter.emitir(payload);
  console.log('Resultado da emissão:', res);

  // 1. Salva o XML assinado no diretório oficial de XMLs
  if (res.xmlEnviado) {
    const xmlFilename = `nfse_salvador_rps_${nextRps}_assinado.xml`;
    const xmlPath = path.join(XMLS_DIR, xmlFilename);
    fs.writeFileSync(xmlPath, res.xmlEnviado, 'utf8');
    console.log(`💾 XML assinado salvo com sucesso em: ${xmlPath}`);
  }

  // 2. Atualiza ultimo_rps_numero para 359
  db.prepare("UPDATE companies SET ultimo_rps_numero = ? WHERE id = ?").run(nextRps, comp.id);

  // 3. Grava no banco de dados nfse_issued
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO nfse_issued (
      id, company_id, prefeitura, numero_nfse, codigo_verificacao,
      prestador_cnpj, tomador_cnpj, tomador_nome, valor_servicos,
      aliquota_iss, valor_iss, discriminacao_servico, status,
      pdf_url, numero_rps, serie_rps, issued_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    comp.id,
    'Salvador',
    res.numeroNfse,
    res.codigoVerificacao,
    comp.cnpj,
    '34581300000123',
    'SALVADOR ESCRITORIO VIRTUAL LTDA',
    10.00,
    5.00,
    0.50,
    payload.discriminacao,
    res.status,
    `/api/portal/nfse/${res.numeroNfse}/pdf`,
    String(nextRps),
    '1',
    nowIso
  );

  console.log(`🎉 RPS Nº ${nextRps} registrado com ID ${id}!`);
}

emitAndSaveRps359().catch(console.error);
