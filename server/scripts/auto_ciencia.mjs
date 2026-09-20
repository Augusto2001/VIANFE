// ============================================================================
// ViaNfe — Ciência da Operação (210210) AUTÔNOMA
// Rotina versionada. Ativação controlada pelo scheduler após migração do cron externo.
// Lê o mesmo SQLite, assina o evento (XML-DSig), envia à SEFAZ, baixa o nfeProc
// e atualiza invoices.xml_raw (a DANFE é regerada a partir daí pelo app).
// Rodar dentro do container: node /app/server/scripts/auto_ciencia.mjs
// ============================================================================
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseFiscalXml } = require('../dist/services/xmlParser.js');
import path from 'path';
import https from 'https';
import zlib from 'zlib';
import { pathToFileURL } from 'node:url';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { XMLParser } from 'fast-xml-parser';
import { DatabaseSync } from 'node:sqlite';

// ---- Config ----
const DB_PATH = process.env.VIANFE_DB || '/app/server/storage/data/fiscal_hub.db';
const CERTS_DIR = process.env.VIANFE_CERTS || '/app/server/storage/certs';
const { decryptText } = require('../dist/utils/crypto.js');
const DELAY_MS = Number(process.env.CIENCIA_DELAY_MS || 2500);
const MAX_PER_COMPANY = Number(process.env.CIENCIA_MAX || 100);
const ACEITE = new Set(['135', '136', '155']);
const ufToCode = { RO:'11',AC:'12',AM:'13',RR:'14',PA:'15',AP:'16',TO:'17',MA:'21',PI:'22',CE:'23',RN:'24',PB:'25',PE:'26',AL:'27',SE:'28',BA:'29',MG:'31',ES:'32',RJ:'33',SP:'35',PR:'41',SC:'42',RS:'43',MS:'50',MT:'51',GO:'52',DF:'53' };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, attributeNamePrefix: '@_', parseTagValue: false });

// ---- Cripto / cert ----
function pfxToPem(buf, pass) {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(buf.toString('base64'))), false, pass);
  let keyPem = '', certPem = '';
  for (const sc of p12.safeContents) for (const b of sc.safeBags) {
    if ((b.type === forge.pki.oids.pkcs8ShroudedKeyBag || b.type === forge.pki.oids.keyBag) && b.key) keyPem = forge.pki.privateKeyToPem(b.key);
    else if (b.type === forge.pki.oids.certBag && b.cert && !certPem) certPem = forge.pki.certificateToPem(b.cert);
  }
  return { keyPem, certPem };
}
function loadCert(company) {
  const buf = fs.readFileSync(path.join(CERTS_DIR, company.cert_filename));
  return pfxToPem(buf, decryptText(company.cert_password_enc));
}

// ---- Assinatura XML-DSig do evento ----
export function signEvent(eventoXml, idEvento, keyPem, certPem) {
  const sig = new SignedXml({
    privateKey: keyPem, publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: `//*[local-name(.)='infEvento' and @Id='${idEvento}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1', uri: `#${idEvento}`,
  });
  sig.computeSignature(eventoXml, { location: { reference: `//*[local-name(.)='infEvento' and @Id='${idEvento}']`, action: 'after' } });
  return sig.getSignedXml();
}

function httpsSoap(hostname, pathname, action, body, certPem, keyPem) {
  const agent = new https.Agent({ cert: certPem, key: keyPem, rejectUnauthorized: true });
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, port: 443, path: pathname, method: 'POST', agent,
      headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`, 'Content-Length': Buffer.byteLength(body) }, timeout: 60000 },
      (res) => { let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c); res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error('SEFAZ HTTP ' + res.statusCode))); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout SEFAZ')); });
    req.write(body); req.end();
  });
}

// ---- Manifestação (RecepcaoEvento4) ----
export async function sendCiencia(company, chave, keyPem, certPem, transport = httpsSoap) {
  if (!/^\d{44}$/.test(chave)) throw new Error('Chave inválida');
  const cnpj = (company.cnpj || '').replace(/\D/g, '');
  const cUf = ufToCode[(company.uf || '').toUpperCase()] || '29';
  const tpAmb = company.sefaz_ambiente === 'homologacao' ? '2' : '1';
  const dhEvento = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z/, '-03:00');
  const idEvento = `ID210210${chave}01`;
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${idEvento}"><cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento></infEvento></evento>`;

  const unsignedEnv = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${evento}</envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const env = signEvent(unsignedEnv, idEvento, keyPem, certPem);
  const host = tpAmb === '2' ? 'hom1.nfe.fazenda.gov.br' : 'www1.nfe.fazenda.gov.br';
  const xml = await transport(host, '/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx', 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF', env, certPem, keyPem);
  return parseScienceResponse(xml, chave, tpAmb);
}

function findNode(value, name) {
  if (!value || typeof value !== 'object') return undefined;
  if (value[name]) return value[name];
  for (const child of Object.values(value)) { const found = findNode(child, name); if (found) return found; }
}
export function parseScienceResponse(xml, chave, tpAmb) {
  const batch = findNode(parser.parse(xml), 'retEnvEvento');
  if (!batch) throw new Error('Resposta SEFAZ sem retEnvEvento');
  const event = batch.retEvento?.infEvento;
  const cStat = String(event?.cStat || batch.cStat || '');
  const xMotivo = String(event?.xMotivo || batch.xMotivo || '');
  const nProt = String(event?.nProt || '');
  if (ACEITE.has(cStat) && (!/^\d{15}$/.test(nProt) || event?.chNFe !== chave || event?.tpEvento !== '210210' || event?.tpAmb !== tpAmb || String(event?.nSeqEvento) !== '1')) throw new Error('Resposta de ciência sem protocolo ou correspondência confirmada');
  return { cStat, xMotivo, nProt };
}

// ---- Download XML completo (DistribuicaoDFe consChNFe) ----
async function fetchFullXml(company, chave, keyPem, certPem) {
  const cnpj = (company.cnpj || '').replace(/\D/g, '');
  const cUf = ufToCode[(company.uf || '').toUpperCase()] || '29';
  const tpAmb = company.sefaz_ambiente === 'homologacao' ? '2' : '1';
  const env = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUf}</cUFAutor><CNPJ>${cnpj}</CNPJ><consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const host = tpAmb === '2' ? 'hom1.nfe.fazenda.gov.br' : 'www1.nfe.fazenda.gov.br';
  const xml = await httpsSoap(host, '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx', 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse', env, certPem, keyPem);
  const cStat = (xml.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
  if (cStat === '656') return { rate: true };
  if (cStat === '137') return { empty: true };
  // docZip base64+gzip
  const docs = [...xml.matchAll(/<docZip[^>]*>([\s\S]*?)<\/docZip>/g)].map(m => m[1]);
  for (const b64 of docs) {
    try {
      const raw = zlib.gunzipSync(Buffer.from(b64, 'base64')).toString('utf8');
      if (raw.includes('nfeProc') || raw.includes('<NFe')) return { full: raw };
    } catch {}
  }
  return {};
}

// ---- Main ----
export async function main() {
const checkOnly = process.argv.includes('--check');
if (!checkOnly && process.env.VIANFE_AUTO_CIENCIA_ENABLED !== 'true') throw new Error('Rotina desativada: migração do cron externo ainda deve ser validada.');
const db = new DatabaseSync(DB_PATH, { readOnly: checkOnly });
db.exec('PRAGMA busy_timeout=8000;');

const retryOnly = process.argv.includes('--retry-only');
const onlyCompany = process.argv.slice(2).find(a => !a.startsWith('--')) || null;
const companies = (onlyCompany
  ? db.prepare("SELECT * FROM companies WHERE id = ? AND status = 'ativo' AND cert_filename IS NOT NULL").all(onlyCompany)
  : db.prepare("SELECT * FROM companies WHERE status = 'ativo' AND cert_filename IS NOT NULL ORDER BY razao_social").all());

if (checkOnly) {
  let certificatesOk=0, certificatesUnavailable=0;
  for (const c of companies) { try { loadCert(c); certificatesOk++; } catch { certificatesUnavailable++; } }
  const columns = db.prepare('PRAGMA table_info(nfe_manifestations)').all().map(c=>c.name);
  const schemaOk = ['sefaz_cstat','sefaz_xmotivo'].every(c=>columns.includes(c));
  log('PREFLIGHT SEM ENVIO', JSON.stringify({companies:companies.length,certificatesOk,certificatesUnavailable,schemaOk}));
  db.close(); if (!schemaOk) throw new Error('Migração ausente'); return;
}
log(`INICIO ciência autônoma — ${companies.length} empresa(s)`);
const T = { cand: 0, aceita: 0, xml: 0, rej: 0, err: 0, lock: [] };

for (const c of (retryOnly ? [] : companies)) {
  if (c.sefaz_locked_until && new Date(c.sefaz_locked_until) > new Date()) { T.lock.push(c.razao_social); continue; }
  let keyPem, certPem;
  try { ({ keyPem, certPem } = loadCert(c)); }
  catch (e) { log(`SKIP ${c.razao_social}: cert inválido (${e.message})`); continue; }

  const targets = db.prepare(`
    SELECT * FROM invoices i WHERE i.company_id = ? AND i.tipo = 'entrada'
      AND (i.modelo = '55' OR i.modelo IS NULL)
      AND i.status NOT LIKE 'manifestado_%'
      AND (i.xml_raw IS NULL OR i.xml_raw LIKE '%resNFe%')
      AND NOT EXISTS (SELECT 1 FROM nfe_manifestations m WHERE m.invoice_id = i.id AND m.event_code='210210' AND m.status='autorizado')
    ORDER BY i.data_emissao DESC LIMIT ?`).all(c.id, MAX_PER_COMPANY);

  let okC = 0;
  for (const inv of targets) {
    T.cand++;
    try {
      const r = await sendCiencia(c, inv.chave_acesso, keyPem, certPem);
      if (r.cStat === '656') { db.prepare("UPDATE companies SET sefaz_locked_until=? WHERE id=?").run(new Date(Date.now()+3600e3).toISOString(), c.id); T.lock.push(c.razao_social); break; }
      if (!ACEITE.has(r.cStat)) {
        T.rej++;
        db.prepare(`INSERT INTO nfe_manifestations (id,invoice_id,company_id,user_id,event_type,event_code,sefaz_protocol,status,sefaz_cstat,sefaz_xmotivo,manifested_at) VALUES (?,?,?, 'auto-standalone','ciencia','210210',NULL,'rejeitado',?,?,?)`)
          .run(`mnf_${inv.id}_${Date.now()}`, inv.id, c.id, r.cStat, r.xMotivo, new Date().toISOString());
        // Rejeições permanentes (596 fora do prazo / 655 já manifestada definitivamente): marca p/ não reprocessar
        if (r.cStat === '596' || r.cStat === '655') {
          log('Ciência rejeitada; estado fiscal preservado', inv.id, r.cStat);
        }
        await sleep(DELAY_MS); continue;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO nfe_manifestations (id,invoice_id,company_id,user_id,event_type,event_code,sefaz_protocol,status,sefaz_cstat,sefaz_xmotivo,manifested_at) VALUES (?,?,?, 'auto-versioned','ciencia','210210',?,'autorizado',?,?,?)`)
          .run(`mnf_${inv.id}_${Date.now()}`, inv.id, c.id, r.nProt, r.cStat, r.xMotivo, new Date().toISOString());
        db.prepare("UPDATE invoices SET status='manifestado_ciencia' WHERE id=? AND status NOT LIKE 'manifestado_%'").run(inv.id);
        db.exec('COMMIT'); T.aceita++; okC++;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } catch (e) { T.err++; log(`ERRO ${inv.chave_acesso}: ${e.message}`); }
    await sleep(DELAY_MS);
  }
  if (targets.length) log(`OK ${c.razao_social.slice(0,42).padEnd(42)} alvo=${targets.length} aceita=${okC}`);
}
log('FIM — TOTAIS', JSON.stringify(T));

// Retry accepted science without sending another event or a final manifestation.
let recovered=0, pending=0;
for (const c of companies) {
  const lock=db.prepare('SELECT sefaz_locked_until FROM companies WHERE id=?').get(c.id);
  if (lock?.sefaz_locked_until && new Date(lock.sefaz_locked_until)>new Date()) continue;
  const targets=db.prepare(`SELECT i.* FROM invoices i WHERE i.company_id=?
    AND (i.xml_raw IS NULL OR i.xml_raw LIKE '%resNFe%')
    AND EXISTS(SELECT 1 FROM nfe_manifestations m WHERE m.invoice_id=i.id AND m.event_code='210210' AND m.status='autorizado')
    ORDER BY i.data_emissao DESC LIMIT ?`).all(c.id,MAX_PER_COMPANY);
  if(!targets.length) continue;
  let creds; try { creds=loadCert(c); } catch { log('RETRY certificado indisponivel',c.id); continue; }
  for(const inv of targets){
    try {
      const f=await fetchFullXml(c,inv.chave_acesso,creds.keyPem,creds.certPem);
      if(f.rate || f.empty){
        db.prepare('UPDATE companies SET sefaz_locked_until=? WHERE id=?').run(new Date(Date.now()+65*60*1000).toISOString(),c.id);
        log('RETRY carencia',c.id,f.rate?'656':'137'); break;
      }
      if(f.full){
        const p=parseFiscalXml(f.full);
        if(p.chaveAcesso!==inv.chave_acesso || p.naturezaOperacao.startsWith('Resumo ') || !/^\d{15}$/.test(p.protocoloAutorizacao || '')) throw Error('XML retornado nao corresponde a nota completa solicitada');
        db.prepare(`UPDATE invoices SET xml_raw=?, natureza_operacao=?, itens_json=?, duplicatas_json=?, pagamentos_json=?, fatura_json=?, valor_produtos=?, valor_icms=?, valor_pis=?, valor_cofins=?, valor_ipi=?, gdrive_synced=0 WHERE id=?`)
          .run(f.full,p.naturezaOperacao,JSON.stringify(p.itens),JSON.stringify(p.duplicatas),JSON.stringify(p.pagamentos),JSON.stringify(p.fatura||null),p.totais.valorProdutos,p.totais.valorIcms,p.totais.valorPis,p.totais.valorCofins,p.totais.valorIpi,inv.id);
        recovered++; log('RETRY XML completo',inv.id);
      } else {pending++;log('RETRY ainda pendente',inv.id);}
    }catch(e){pending++;log('RETRY erro',inv.id,e.message);}
    await sleep(Math.max(DELAY_MS,4000));
  }
}
log('RECUPERACAO',JSON.stringify({recovered,pending}));
db.close();
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
