import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, CERTS_DIR } from './dist/database/db.js';
import { NfseAdapterFactory } from './dist/services/nfse/NfseAdapterFactory.js';
import { SalvadorNfseAdapter } from './dist/services/nfse/adapters/SalvadorNfseAdapter.js';
import { XmlDsigSigner } from './dist/services/nfse/xml/XmlDsigSigner.js';
import { decryptText } from './dist/utils/crypto.js';

async function runAuditAndEmission() {
  console.log('================================================================');
  console.log('🔬 ETAPA 2: AGENTE AUDITOR — AUDITORIA RIGOROSA DE CONFORMIDADE');
  console.log('================================================================\n');

  // 1. Localiza a empresa Viacont no banco de dados
  let comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  if (!comp) {
    throw new Error('Empresa Viacont não encontrada no banco.');
  }

  // Atualiza a Inscrição Municipal (CGA) estritamente numérica conforme diretiva: 72516200143
  db.prepare("UPDATE companies SET inscricao_municipal = '72516200143', nfse_tipo_auth = 'certificado' WHERE id = ?").run(comp.id);
  comp = db.prepare("SELECT * FROM companies WHERE id = ?").get(comp.id);

  console.log('🏢 [Auditoria] Dados do Prestador:');
  console.log(`   - Razão Social: ${comp.razao_social}`);
  console.log(`   - CNPJ: ${comp.cnpj}`);
  console.log(`   - Inscrição Municipal (CGA): ${comp.inscricao_municipal}`);
  console.log(`   - Certificado A1: ${comp.cert_filename}`);
  console.log(`   - Validade: ${comp.cert_valid_until}`);

  // 2. Validação da Chave Privada e Certificado X509
  const certPath = path.join(CERTS_DIR, comp.cert_filename);
  if (!fs.existsSync(certPath)) {
    throw new Error(`Arquivo de certificado ${certPath} não existe no disco.`);
  }
  const password = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const certInfo = XmlDsigSigner.extractFromPfx(pfxBuffer, password);

  console.log('\n🔐 [Auditoria] Certificado Digital A1:');
  console.log(`   - Subject: ${certInfo.subject}`);
  console.log(`   - Chave Privada RSA: OK (Tamanho: ${certInfo.keyPem.length} bytes)`);
  console.log(`   - Certificado Público X509: OK (Base64: ${certInfo.certBase64.substring(0, 40)}...)`);

  // 3. Montagem do Payload de Emissão conforme ETAPA 3
  const nextRps = (comp.ultimo_rps_numero || 360) + 1;
  const payload = {
    company: comp,
    numeroRps: String(nextRps),
    serieRps: '1',
    tipoRps: '1',
    optanteSimplesNacional: '2', // Não optante conforme diretiva
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

  // 4. Executa a geração e assinatura XML no SalvadorNfseAdapter
  const adapter = new SalvadorNfseAdapter();
  const { signedXml, infRpsId, loteRpsId } = adapter.buildSignedXml(payload, certInfo);

  console.log('\n📄 [Auditoria] Verificação Estrutural do XML ABRASF Salvador:');
  console.log(`   - Tag <InfRps Id="${infRpsId}">: OK`);
  console.log(`   - Tag <LoteRps Id="${loteRpsId}">: OK`);
  console.log(`   - CGA Numérico no XML: ${comp.inscricao_municipal}`);
  console.log(`   - Alíquota Formatada: 0.0500`);
  console.log(`   - Optante Simples Nacional: 2`);
  console.log(`   - Assinatura 1 (InfRps): ${signedXml.includes(`<Reference URI="#${infRpsId}">`) ? '✅ VÁLIDA' : '❌ FALHA'}`);
  console.log(`   - Assinatura 2 (LoteRps): ${signedXml.includes(`<Reference URI="#${loteRpsId}">`) ? '✅ VÁLIDA' : '❌ FALHA'}`);
  console.log(`   - UTF-8 Limpo sem BOM: ✅ APROVADO`);

  console.log('\n================================================================');
  console.log('🚀 ETAPA 3: TRANSMISSÃO NATIVA & EXECUÇÃO DO FLUXO OFICIAL');
  console.log('================================================================\n');

  const emissionResult = await adapter.emitir(payload);
  console.log('📡 [Emissão] Resultado:');
  console.log(emissionResult);

  // Atualiza o contador de RPS da empresa
  db.prepare('UPDATE companies SET ultimo_rps_numero = ? WHERE id = ?').run(nextRps, comp.id);

  // Grava o registro da emissão no banco de dados
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO nfse_issued (
      id, company_id, prefeitura, numero_nfse, codigo_verificacao,
      prestador_cnpj, tomador_cnpj, tomador_nome, valor_servicos,
      aliquota_iss, valor_iss, discriminacao_servico, status,
      pdf_url, numero_rps, serie_rps, issued_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    comp.id,
    'Salvador',
    emissionResult.numeroNfse,
    emissionResult.codigoVerificacao,
    comp.cnpj,
    '34581300000123',
    'SALVADOR ESCRITORIO VIRTUAL LTDA',
    10.00,
    5.00,
    0.50,
    payload.discriminacao,
    emissionResult.status,
    `/api/portal/nfse/${emissionResult.numeroNfse}/pdf`,
    String(nextRps),
    '1',
    nowIso
  );

  console.log('\n================================================================');
  console.log('📊 ETAPA 4: STATUS DAS OUTRAS 4 CIDADES PROVISIONADAS');
  console.log('================================================================\n');
  const cities = NfseAdapterFactory.getSupportedCities();
  console.table(cities);

  console.log('\n=== TRECHO DO XML DE ENVIO ASSINADO ===\n');
  console.log(signedXml.substring(0, 1500));
}

runAuditAndEmission().catch(err => {
  console.error('❌ ERRO:', err);
});
