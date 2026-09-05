import forge from 'node-forge';
import tls from 'tls';

/**
 * Load a PFX/P12 certificate using node-forge (supports legacy RC2/3DES used by Brazilian ACs)
 * and return a Buffer with a modern AES-256 re-packed PFX that Node.js OpenSSL 3 can read.
 *
 * Brazilian certificate authorities (Serpro, Certisign, Valid, Soluti etc.) still issue
 * certificates with PKCS12 using RC2-40-CBC for key encryption and SHA-1 MAC, which OpenSSL 3
 * dropped support for unless the legacy provider is activated. node-forge reads these natively.
 */
export function loadPfxWithForge(pfxBuffer: Buffer, password: string): {
  certPem: string;
  keyPem: string;
  caPems: string[];
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  extractedCnpj?: string;
} {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.toLowerCase().includes('invalid password') || msg.toLowerCase().includes('mac') || msg.toLowerCase().includes('integrity')) {
      throw new Error(`SENHA DO CERTIFICADO INCORRETA. Verifique a senha do arquivo .pfx e tente o upload novamente.`);
    }
    throw new Error(`Erro ao abrir certificado digital: ${msg}`);
  }

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBagArr = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  if (keyBagArr.length === 0) {
    throw new Error('Nenhuma chave privada encontrada no certificado A1.');
  }
  const privateKey = keyBagArr[0].key;
  if (!privateKey) {
    throw new Error('Chave privada inválida no certificado A1.');
  }
  const keyPem = forge.pki.privateKeyToPem(privateKey);

  // Extract certificates
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBagArr = certBags[forge.pki.oids.certBag] || [];
  if (certBagArr.length === 0) {
    throw new Error('Nenhum certificado encontrado no arquivo .pfx.');
  }

  const certs = certBagArr.map(b => b.cert!).filter(Boolean);
  const mainCert = certs[0];
  const certPem = forge.pki.certificateToPem(mainCert);
  const caPems = certs.slice(1).map(c => forge.pki.certificateToPem(c));

  const subject = mainCert.subject.getField('CN')?.value || mainCert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
  const issuer = mainCert.issuer.getField('CN')?.value || mainCert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(', ');
  const validFrom = mainCert.validity.notBefore.toISOString();
  const validTo = mainCert.validity.notAfter.toISOString();

  // Extract CNPJ from ICP-Brasil Subject (CN pattern or OID 2.16.76.1.3.3)
  let extractedCnpj: string | undefined = undefined;
  const cnStr = String(subject || '');
  const matchCn = cnStr.match(/:(\d{14})/);
  if (matchCn) {
    extractedCnpj = matchCn[1];
  } else {
    // Search subject attributes for OID 2.16.76.1.3.3 (ICP-Brasil CNPJ)
    const cnpjAttr = mainCert.subject.attributes.find((a: any) => a.type === '2.16.76.1.3.3' || a.name === '2.16.76.1.3.3');
    if (cnpjAttr && cnpjAttr.value) {
      extractedCnpj = String(cnpjAttr.value).replace(/\D/g, '');
    } else {
      // Fallback: extract any 14-digit sequence from subject
      const digitsMatch = cnStr.replace(/\D/g, '').match(/\d{14}/);
      if (digitsMatch) {
        extractedCnpj = digitsMatch[0];
      }
    }
  }

  return { certPem, keyPem, caPems, subject, issuer, validFrom, validTo, extractedCnpj };
}

/**
 * Validate a PFX buffer + password combination using node-forge.
 * Returns { valid, subject, issuer, validFrom, validTo, extractedCnpj, error }
 */
export function validatePfxCertificate(pfxBuffer: Buffer, password: string): {
  valid: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  extractedCnpj?: string;
  error?: string;
} {
  try {
    const result = loadPfxWithForge(pfxBuffer, password);
    return {
      valid: true,
      subject: result.subject,
      issuer: result.issuer,
      validFrom: result.validFrom,
      validTo: result.validTo,
      extractedCnpj: result.extractedCnpj
    };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}
