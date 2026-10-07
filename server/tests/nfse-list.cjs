const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const {listNfseDocuments}=require('../dist/services/nfse/listDocuments.js');
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE nfse_issued(id,company_id,numero_nfse,issued_at); CREATE TABLE invoices(id,company_id,numero,data_emissao,destinatario_nome,destinatario_cnpj,valor_produtos,info_adicional,status,modelo,tipo);
INSERT INTO nfse_issued VALUES('issued','a','2','2026-01-02');
INSERT INTO invoices VALUES('imported','a','1','2026-01-01','TEST','123',5598.36,'TEST','autorizada','NFS-e','saida'),('duplicate','a','2','2026-01-02','TEST','123',0,'TEST','autorizada','NFS-e','saida'),('foreign','b','3','2026-01-03','TEST','123',0,'TEST','autorizada','NFS-e','saida'),('incoming','a','4','2026-01-04','TEST','123',0,'TEST','autorizada','NFS-e','entrada');`);
const result=listNfseDocuments(db,'a');assert.deepEqual(result.map(x=>x.id),['issued','imported']);assert.equal(result[1].valor_servicos,5598.36);assert.equal(result[1].document_source,'invoice');db.close();console.log('PASS: lista de serviços inclui importadas, isola empresa e direção, evita duplicação da emissão.');
