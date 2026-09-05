import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';
import { SalvadorNfseAdapter } from './dist/services/nfse/adapters/SalvadorNfseAdapter.js';

async function testPostLinkEmission() {
  console.log('🚀 [ViaNFe] Iniciando teste de comunicação e consulta após vínculo do Certificado A1...');

  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  console.log('🏢 Empresa:', comp.razao_social);
  console.log('📄 CNPJ:', comp.cnpj);
  console.log('🏛️ Inscrição Municipal (CGA):', comp.inscricao_municipal);
  console.log('🔢 Último RPS Emitido:', comp.ultimo_rps_numero);

  const certPath = `${CERTS_DIR}/${comp.cert_filename}`;
  const password = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuffer.toString('binary')), password);

  let certPem = '', keyPem = '';
  for (const sc of pfx.safeContents) {
    for (const sb of sc.safeBags) {
      if (sb.cert) certPem += forge.pki.certificateToPem(sb.cert);
      if (sb.key) keyPem = forge.pki.privateKeyToPem(sb.key);
    }
  }

  const agent = new https.Agent({ cert: certPem, key: keyPem, minVersion: 'TLSv1.2', rejectUnauthorized: false });

  // 1. Testa Consulta de Situação do Lote / ConsultaNfse
  const prestadorCnpj = comp.cnpj.replace(/\D/g, '');
  const prestadorIm = (comp.inscricao_municipal || '').replace(/\D/g, '');

  const consultaXml = `
    <ConsultarNfseEnvio xmlns="http://www.abrasf.org.br/ABRASF/arquivos/nfse.xsd">
      <Prestador>
        <Cnpj>${prestadorCnpj}</Cnpj>
        <InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal>
      </Prestador>
    </ConsultarNfseEnvio>
  `.trim();

  const soapEnvelope = `
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <ConsultarNfse xmlns="http://tempuri.org/">
          <consultaxml><![CDATA[${consultaXml}]]></consultaxml>
        </ConsultarNfse>
      </s:Body>
    </s:Envelope>
  `.trim();

  console.log('📡 Chamando https://nfse.sefaz.salvador.ba.gov.br/ConsultaNfse/ConsultaNfse.svc ...');
  const res = await new Promise(resolve => {
    const req = https.request('https://nfse.sefaz.salvador.ba.gov.br/ConsultaNfse/ConsultaNfse.svc', {
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IConsultaNfse/ConsultarNfse'
      }
    }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ status: r.statusCode, data: d }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(soapEnvelope);
    req.end();
  });

  console.log(`HTTP Status: ${res.status}`);
  console.log(`SOAP Response:\n`, res.data);

  // 2. Executa a geração do RPS Nº 359 no SalvadorNfseAdapter
  const nextRps = (comp.ultimo_rps_numero || 358) + 1;
  console.log(`\n🎯 Gerando RPS Oficial Nº ${nextRps}...`);

  const adapter = new SalvadorNfseAdapter();
  const emissionResult = await adapter.emitir({
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
  });

  console.log('✅ Resultado da Emissão do RPS:');
  console.log(emissionResult);

  // Salva o XML gerado em arquivo para consulta
  const rpsXmlPath = `/app/storage/xmls/RPS_${nextRps}_assinado.xml`;
  if (emissionResult.xmlEnviado) {
    fs.writeFileSync(rpsXmlPath, emissionResult.xmlEnviado);
    console.log(`💾 XML do RPS Nº ${nextRps} salvo em: ${rpsXmlPath}`);
  }
}

testPostLinkEmission().catch(console.error);
