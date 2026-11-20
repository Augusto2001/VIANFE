import fs from 'fs';
import path from 'path';
import { db, initDatabase } from '../server/dist/database/db.js';
import { NfseOrderService } from '../server/dist/services/nfse/NfseOrderService.js';

async function runTests() {
  console.log('=== TESTES DO MOTOR DE PEDIDOS DE NFS-E (ViaNFe + Viviane + ViaOS) ===\n');

  // Inicializar banco
  initDatabase();

  const testCnpj = '12345678000195';
  const testCompanyId = 'comp_test_nfse_01';

  // Inserir empresa de teste se não existir
  db.prepare(`
    INSERT OR REPLACE INTO companies (
      id, tenant_id, cnpj, razao_social, nome_fantasia, uf, status, created_at, updated_at
    ) VALUES (?, 'tenant_viacont_master', ?, 'EMPRESA SERVICO TESTE LTDA', 'TESTE SERVICOS', 'BA', 'ativo', datetime('now'), datetime('now'))
  `).run(testCompanyId, testCnpj);

  // 1. Testar pedido para empresa SEM perfil fiscal cadastrado
  db.prepare('DELETE FROM client_nfse_profiles WHERE cnpj_prestador = ?').run(testCnpj);
  const pedidoSemPerfil = await NfseOrderService.processOrder({
    cnpj_prestador: testCnpj,
    tomador_doc: '98765432000198',
    tomador_nome: 'TOMADOR TESTE S.A.',
    valor_servicos: 1500.00,
    descricao: 'Consultoria Contábil e Tributária'
  });
  console.log('1. [Pedido Sem Perfil Cadastrado]:', {
    protocolo: pedidoSemPerfil.protocolo,
    status: pedidoSemPerfil.status,
    impedimento: pedidoSemPerfil.impedimento_motivo
  });
  if (pedidoSemPerfil.status !== 'COM_IMPEDIMENTO') throw new Error('Deveria ter status COM_IMPEDIMENTO por falta de perfil');

  // 2. Cadastrar Perfil Fiscal no ViaNFe
  const perfilSalvo = NfseOrderService.saveProfile({
    company_id: testCompanyId,
    cnpj_prestador: testCnpj,
    item_servico_lc116: '17.01',
    codigo_tributacao_nacional: '170101',
    aliquota_iss: 5.0,
    iss_retido: 0,
    codigo_municipio_padrao: '2927408',
    descricao_servico_padrao: 'Assessoria contábil mensal',
    limite_valor_nota: 10000.00
  });
  console.log('2. [Perfil Fiscal Cadastrado]:', {
    cnpj: perfilSalvo.cnpj_prestador,
    servico: perfilSalvo.codigo_tributacao_nacional,
    aliquota: perfilSalvo.aliquota_iss,
    limite: perfilSalvo.limite_valor_nota
  });

  // 3. Testar pedido válido dentro do limite
  const pedidoValido = await NfseOrderService.processOrder({
    cnpj_prestador: testCnpj,
    tomador_doc: '98765432000198',
    tomador_nome: 'TOMADOR TESTE S.A.',
    valor_servicos: 3500.00,
    descricao: 'Honorários Contábeis - Competência 11/2026'
  });
  console.log('3. [Pedido Válido - Prévia Gerada]:', {
    protocolo: pedidoValido.protocolo,
    status: pedidoValido.status,
    mensagem: pedidoValido.mensagem,
    pdf_gerado: Boolean(pedidoValido.previa_pdf_path && fs.existsSync(pedidoValido.previa_pdf_path)),
    pdf_tamanho: pedidoValido.previa_pdf_path && fs.existsSync(pedidoValido.previa_pdf_path) ? fs.statSync(pedidoValido.previa_pdf_path).size : 0
  });
  if (pedidoValido.status !== 'AGUARDANDO_APROVACAO' || !pedidoValido.previa_pdf_path) {
    throw new Error('Falha na geração do pedido válido');
  }

  // 4. Testar pedido excedendo limite de valor (> R$ 10.000,00)
  const pedidoExcedente = await NfseOrderService.processOrder({
    cnpj_prestador: testCnpj,
    tomador_doc: '98765432000198',
    tomador_nome: 'TOMADOR TESTE S.A.',
    valor_servicos: 25000.00,
    descricao: 'Serviço com valor acima da alçada'
  });
  console.log('4. [Pedido Excedendo Limite de Alçada]:', {
    protocolo: pedidoExcedente.protocolo,
    status: pedidoExcedente.status,
    impedimento: pedidoExcedente.impedimento_motivo
  });
  if (pedidoExcedente.status !== 'COM_IMPEDIMENTO') throw new Error('Deveria ter status COM_IMPEDIMENTO por limite excedido');

  // Limpeza
  db.prepare('DELETE FROM nfse_order_requests WHERE cnpj_prestador = ?').run(testCnpj);
  db.prepare('DELETE FROM client_nfse_profiles WHERE cnpj_prestador = ?').run(testCnpj);
  db.prepare('DELETE FROM companies WHERE id = ?').run(testCompanyId);

  console.log('\n✅ TODOS OS 4 TESTES DO MOTOR DE PEDIDOS DE NFS-E PASSARAM COM SUCESSO!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ ERRO:', err);
  process.exit(1);
});
