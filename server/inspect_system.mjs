import { db } from './dist/database/db.js';

try {
  db.prepare(`
    UPDATE support_tickets SET 
      status = 'resolvido', 
      solucao = 'Correção aplicada com sucesso no fluxo de upload do certificado (safe copy) e mapeamento do botão Emitir NFS-e.', 
      resolved_at = datetime('now') 
    WHERE status = 'aberto'
  `).run();

  const tickets = db.prepare('SELECT id, solicitante_nome, company_name, tipo_demanda, mensagem_erro, solucao, status FROM support_tickets ORDER BY created_at DESC LIMIT 5').all();
  console.log('=== TICKETS APÓS RESOLUÇÃO ===');
  console.log(JSON.stringify(tickets, null, 2));
} catch (e) {
  console.error(e);
}
