// Read NDJSON from stdin. Only real authorized NF-e/NFC-e, exact issuer and
// explicit company allowlist. Default read-only; --apply uses normal ingestion.
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { parseFiscalXml } = require('../dist/services/xmlParser.js');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allowed = (args.find(a => a.startsWith('--companies=')) || '').slice(12).split(',');
if (!allowed.length || allowed.some(c => !/^\d{14}$/.test(c))) throw new Error('Informe --companies=CNPJ,CNPJ com emissores autorizados.');
const db = new DatabaseSync(process.env.VIANFE_DB || '/app/server/storage/data/fiscal_hub.db', { readOnly: true });
const companies = db.prepare('SELECT id,cnpj FROM companies').all();
const service = apply ? require('../dist/services/sefazService.js').sefazService : null;
const counts = {};
try {
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    let record = {}, output;
    try {
      record = JSON.parse(line);
      if (!allowed.includes(record.companyCnpj)) throw new Error('Empresa fora do escopo autorizado.');
      if (typeof record.xml !== 'string' || Buffer.byteLength(record.xml) > 10 * 1024 * 1024) throw new Error('XML inválido ou excede 10 MB.');
      const p = parseFiscalXml(record.xml);
      const full = p.nfseNacional ? /^\d{50}$/.test(p.chaveAcesso) :
        ['55','65'].includes(p.modelo) && /^\d{44}$/.test(p.chaveAcesso) && p.itens.length && /^\d{15}$/.test(p.protocoloAutorizacao || '');
      if (!full || p.status !== 'autorizada' || p.tipoOperacao !== '1' ||
          p.emitente.cnpjCpf !== record.companyCnpj || !p.dataEmissao.startsWith('2026-') || p.naturezaOperacao.startsWith('Resumo '))
        throw new Error('Requer XML completo autorizado de saída de 2026, com emitente correspondente.');
      const matches = companies.filter(c => c.cnpj.replace(/\D/g,'') === record.companyCnpj);
      if (matches.length !== 1) throw new Error('Cadastro do emitente ausente ou ambíguo.');
      const c = matches[0];
      const old = db.prepare('SELECT * FROM invoices WHERE chave_acesso=?').get(p.chaveAcesso);
      let status = 'validated';
      if (old) {
        if (old.company_id !== c.id || old.tipo !== 'saida') throw new Error('Nota existente em outra empresa/direção; revisão necessária.');
        if (old.xml_raw !== record.xml) throw new Error('XML existente diferente; preservar registro para revisão.');
        status = 'existing';
      } else if (apply) {
        await service.ingestXml(c.id, record.xml, 'upload');
        status = 'imported';
      }
      if (old || apply) {
        const row = db.prepare('SELECT xml_raw,xml_file_path,pdf_file_path,tipo FROM invoices WHERE chave_acesso=?').get(p.chaveAcesso);
        if (!row || row.tipo !== 'saida' || row.xml_raw !== record.xml || !row.xml_file_path ||
            !fs.existsSync(row.xml_file_path) || fs.readFileSync(row.xml_file_path,'utf8') !== record.xml)
          throw new Error('XML gravado não passou na verificação; revisar artefatos.');
        if (!row.pdf_file_path || !fs.existsSync(row.pdf_file_path) || fs.readFileSync(row.pdf_file_path).subarray(0,5).toString() !== '%PDF-') {
          if (p.nfseNacional) status += '_xml_pdf_pending';
          else throw new Error('PDF gravado não passou na verificação; revisar artefatos.');
        }
      }
      output = { source: record.source, companyCnpj: record.companyCnpj, key: p.chaveAcesso, number: p.numero, status };
    } catch (error) {
      output = { source: record.source, companyCnpj: record.companyCnpj, status: 'error', error: error.message };
    }
    const key = `${output.companyCnpj}:${output.status}`;
    counts[key] = (counts[key] || 0) + 1;
    console.log(JSON.stringify(output));
  }
  console.log(JSON.stringify({ summary: counts, apply }));
} finally { db.close(); }
