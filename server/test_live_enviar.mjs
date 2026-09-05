import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import crypto from 'crypto';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';
import { XmlDsigSigner } from './dist/services/nfse/xml/XmlDsigSigner.js';

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function testWithoutRootNamespace() {
  console.log('🚀 [ViaNFe] Testando sem default xmlns no root para compatibilidade com SelectSingleNode do .NET...');

  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  const certPath = `${CERTS_DIR}/${comp.cert_filename}`;
  const password = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const certInfo = XmlDsigSigner.extractFromPfx(pfxBuffer, password);

  const agent = new https.Agent({
    cert: certInfo.certPem,
    key: certInfo.keyPem,
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  });

  const prestadorCnpj = comp.cnpj.replace(/\D/g, '');
  const prestadorIm = (comp.inscricao_municipal || '72516200143').replace(/\D/g, '');
  const nowIso = new Date().toISOString().split('.')[0];

  const infRpsXml = `
<InfRps>
  <IdentificacaoRps>
    <Numero>359</Numero>
    <Serie>1</Serie>
    <Tipo>1</Tipo>
  </IdentificacaoRps>
  <DataEmissao>${nowIso}</DataEmissao>
  <NaturezaOperacao>1</NaturezaOperacao>
  <OptanteSimplesNacional>2</OptanteSimplesNacional>
  <IncentivadorCultural>2</IncentivadorCultural>
  <Status>1</Status>
  <Servico>
    <Valores>
      <ValorServicos>10.00</ValorServicos>
      <ValorDeducoes>0.00</ValorDeducoes>
      <ValorPis>0.00</ValorPis>
      <ValorCofins>0.00</ValorCofins>
      <ValorInss>0.00</ValorInss>
      <ValorIr>0.00</ValorIr>
      <ValorCsll>0.00</ValorCsll>
      <IssRetido>2</IssRetido>
      <ValorIss>0.50</ValorIss>
      <ValorIssRetido>0.00</ValorIssRetido>
      <OutrasRetencoes>0.00</OutrasRetencoes>
      <BaseCalculo>10.00</BaseCalculo>
      <Aliquota>0.0500</Aliquota>
      <ValorLiquidoNfse>10.00</ValorLiquidoNfse>
      <DescontoIncondicionado>0.00</DescontoIncondicionado>
      <DescontoCondicionado>0.00</DescontoCondicionado>
    </Valores>
    <ItemListaServico>17.19</ItemListaServico>
    <CodigoCnae>6920601</CodigoCnae>
    <CodigoTributacaoMunicipio>1719001</CodigoTributacaoMunicipio>
    <Discriminacao>Prestacao de servicos contabeis e administrativos - Emissao de teste e validacao de sistema ViaNFe.</Discriminacao>
    <CodigoMunicipio>2927408</CodigoMunicipio>
    <NBS>101010100</NBS>
    <cClassTrib>010101</cClassTrib>
    <INDOP>1</INDOP>
  </Servico>
  <Prestador>
    <Cnpj>${prestadorCnpj}</Cnpj>
    <InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal>
  </Prestador>
  <Tomador>
    <IdentificacaoTomador>
      <CpfCnpj>
        <Cnpj>34581300000123</Cnpj>
      </CpfCnpj>
    </IdentificacaoTomador>
    <RazaoSocial>SALVADOR ESCRITORIO VIRTUAL LTDA</RazaoSocial>
  </Tomador>
</InfRps>
  `.trim();

  // Assinatura RPS
  const canonicalRps = XmlDsigSigner.canonicalize(infRpsXml);
  const digestRps = crypto.createHash('sha1').update(canonicalRps, 'utf8').digest('base64');
  const signedInfoRps = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestRps}</DigestValue></Reference></SignedInfo>`;
  
  const mdRps = forge.md.sha1.create();
  mdRps.update(signedInfoRps, 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(certInfo.keyPem);
  const sigValRps = forge.util.encode64(privateKey.sign(mdRps));
  const rpsSignature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoRps}<SignatureValue>${sigValRps}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certInfo.certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  const loteRpsContent = `
<LoteRps>
  <NumeroLote>359</NumeroLote>
  <Cnpj>${prestadorCnpj}</Cnpj>
  <InscricaoMunicipal>${prestadorIm}</InscricaoMunicipal>
  <QuantidadeRps>1</QuantidadeRps>
  <ListaRps>
    <Rps>
      ${infRpsXml}
      ${rpsSignature}
    </Rps>
  </ListaRps>
</LoteRps>
  `.trim();

  // Assinatura Lote
  const canonicalLote = XmlDsigSigner.canonicalize(loteRpsContent);
  const digestLote = crypto.createHash('sha1').update(canonicalLote, 'utf8').digest('base64');
  const signedInfoLote = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestLote}</DigestValue></Reference></SignedInfo>`;
  
  const mdLote = forge.md.sha1.create();
  mdLote.update(signedInfoLote, 'utf8');
  const sigValLote = forge.util.encode64(privateKey.sign(mdLote));
  const loteSignature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoLote}<SignatureValue>${sigValLote}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certInfo.certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  const finalXml = `
<EnviarLoteRpsEnvio>
  ${loteRpsContent}
  ${loteSignature}
</EnviarLoteRpsEnvio>
  `.trim();

  const escapedLoteXml = escapeXml(finalXml);

  const soapEnvelope = `
    <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
        <EnviarLoteRPS xmlns="http://tempuri.org/">
          <loteXML>${escapedLoteXml}</loteXML>
        </EnviarLoteRPS>
      </s:Body>
    </s:Envelope>
  `.trim();

  console.log('📡 Disparando para https://nfse.salvador.ba.gov.br/rps/ENVIOLOTERPS/EnvioLoteRps.svc ...');
  const res = await new Promise(resolve => {
    const req = https.request('https://nfse.salvador.ba.gov.br/rps/ENVIOLOTERPS/EnvioLoteRps.svc', {
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IEnvioLoteRPS/EnviarLoteRPS'
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
}

testWithoutRootNamespace().catch(console.error);
