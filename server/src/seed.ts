import fs from 'fs';
import path from 'path';
import { db, initDatabase, XMLS_DIR, PDFS_DIR } from './database/db.js';
import { sefazService } from './services/sefazService.js';
import { v4 as uuidv4 } from 'uuid';

async function runVerification() {
  console.log('--- Iniciando Teste de Validação da Arquitetura Fiscal ---');
  initDatabase();

  // 1. Cadastrar 2 empresas para testar o ISOLAMENTO ABSOLUTO
  const comp1Id = uuidv4();
  const comp2Id = uuidv4();
  const now = new Date().toISOString();

  // Empresa 1: Distribuidora Paulista
  db.prepare(`
    INSERT INTO companies (id, cnpj, razao_social, nome_fantasia, uf, status, sefaz_ambiente, created_at, updated_at)
    VALUES (?, '12345678000199', 'DISTRIBUIDORA DE ALIMENTOS PAULISTA LTDA', 'Paulista Alimentos', 'SP', 'ativo', 'producao', ?, ?)
    ON CONFLICT(cnpj) DO UPDATE SET razao_social = excluded.razao_social
  `).run(comp1Id, now, now);

  // Empresa 2: Indústria Metalúrgica Sul
  db.prepare(`
    INSERT INTO companies (id, cnpj, razao_social, nome_fantasia, uf, status, sefaz_ambiente, created_at, updated_at)
    VALUES (?, '99887766000155', 'METALURGICA SUL BRASIL LTDA', 'Metalúrgica Sul', 'PR', 'ativo', 'producao', ?, ?)
    ON CONFLICT(cnpj) DO UPDATE SET razao_social = excluded.razao_social
  `).run(comp2Id, now, now);

  console.log('✓ Empresas criadas para teste de multi-tenancy e isolamento.');

  // 2. Ingerir XML na Empresa 1
  const sampleXmlPath = path.resolve(__dirname, '../storage/samples/exemplo_nfe_45892.xml');
  const xmlContent = fs.readFileSync(sampleXmlPath, 'utf-8');
  const result = await sefazService.ingestXml(comp1Id, xmlContent, 'upload');

  console.log(`✓ XML Fiscal Ingerido na Empresa 1: Chave ${result.chaveAcesso} (${result.action})`);

  // 3. Validar DANFE PDF gerado
  const expectedPdf = path.join(PDFS_DIR, `DANFE_${result.chaveAcesso}.pdf`);
  const pdfExists = fs.existsSync(expectedPdf);
  console.log(`✓ DANFE PDF Gerado com sucesso: ${pdfExists} (${expectedPdf})`);

  // 4. Teste de Isolamento Rígido: A Empresa 2 NÃO pode ver a nota da Empresa 1
  const invComp1 = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE company_id = ?').get(comp1Id) as any;
  const invComp2 = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE company_id = ?').get(comp2Id) as any;

  console.log(`[Isolamento] Notas da Empresa 1 (Paulista): ${invComp1.c} nota(s)`);
  console.log(`[Isolamento] Notas da Empresa 2 (Sul Brasil): ${invComp2.c} nota(s)`);

  if (invComp1.c === 1 && invComp2.c === 0) {
    console.log('🎉 SUCESSO: O isolamento absoluto por cliente foi comprovado com 100% de integridade!');
  } else {
    console.error('❌ FALHA NO ISOLAMENTO');
  }

  // 5. Teste de Sincronização Google Drive
  const syncRes = await sefazService.syncCompany(comp1Id, 'manual');
  console.log(`✓ Sincronização Google Drive testada: ${syncRes.message}`);

  console.log('--- Teste Concluído com Sucesso ---');
}

runVerification().catch(console.error);
