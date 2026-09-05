import crypto from 'crypto';
import forge from 'node-forge';

export interface CertificateInfo {
  certPem: string;
  keyPem: string;
  certBase64: string;
  subject: string;
  validUntil: Date;
}

export class XmlDsigSigner {
  /**
   * Extrai chave privada e certificado público X509 a partir de um buffer PKCS#12 (.pfx)
   */
  static extractFromPfx(pfxBuffer: Buffer, password: string): CertificateInfo {
    const pfxDer = pfxBuffer.toString('binary');
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

    let certPem = '';
    let keyPem = '';
    let certBase64 = '';
    let subject = '';
    let validUntil = new Date();

    for (const sc of pfx.safeContents) {
      for (const sb of sc.safeBags) {
        if (sb.cert) {
          certPem += forge.pki.certificateToPem(sb.cert);
          certBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(sb.cert)).getBytes());
          subject = sb.cert.subject.attributes.map((a: any) => `${a.shortName || a.name}=${a.value}`).join(', ');
          validUntil = sb.cert.validity.notAfter;
        }
        if (sb.key) {
          keyPem = forge.pki.privateKeyToPem(sb.key);
        }
      }
    }

    if (!keyPem || !certPem) {
      throw new Error('Chave privada ou certificado público não encontrados no arquivo .pfx');
    }

    return { certPem, keyPem, certBase64, subject, validUntil };
  }

  /**
   * Canonicaliza o XML no padrão C14N (Canonical XML 20010315)
   */
  static canonicalize(xml: string): string {
    return xml
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/>\s+</g, '><')
      .trim();
  }

  /**
   * Assina um trecho XML com XMLDSig RSA-SHA1 referenciando uma URI/ID
   */
  static signElement(
    elementXml: string,
    targetId: string,
    keyPem: string,
    certBase64: string
  ): string {
    const canonicalXml = this.canonicalize(elementXml);

    // 1. Calcula o DigestValue (SHA-1 em Base64)
    const digestValue = crypto.createHash('sha1').update(canonicalXml, 'utf8').digest('base64');

    // 2. Monta o SignedInfo canônico
    const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#${targetId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

    // 3. Assina o SignedInfo com a chave privada RSA
    const md = forge.md.sha1.create();
    md.update(signedInfo, 'utf8');
    const privateKey = forge.pki.privateKeyFromPem(keyPem);
    const signature = privateKey.sign(md);
    const signatureValue = forge.util.encode64(signature);

    // 4. Monta a tag <Signature> completa
    const signatureXml = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

    return signatureXml;
  }
}
