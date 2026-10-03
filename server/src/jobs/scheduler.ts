import { execFile } from 'node:child_process';
import path from 'node:path';
import cron from 'node-cron';
import { db } from '../database/db.js';
import { sefazService } from '../services/sefazService.js';
import { googleDriveService } from '../services/googleDriveService.js';
import { predictiveAlertsService } from '../services/predictiveAlertsService.js';

export function initScheduler() {
  console.log('✓ [ROBÔ 24/7] Inicializando motor autônomo de sincronização SEFAZ e Google Drive...');

  /**
   * Helper function: Executa a varredura SEFAZ para todas as empresas ativas com certificado A1
   */
  let fiscalRunning = false;
  const runSefazBatchSync = async (triggerOrigin: string) => {
    if (fiscalRunning) { console.warn('Ciclo fiscal anterior ainda em execução'); return; }
    fiscalRunning = true;
    console.log(`🤖 [ROBÔ SEFAZ 24/7 - ${triggerOrigin}] Iniciando varredura para empresas ativas...`);

    try {
      // Process known summaries before a new distribution request starts its cooldown.
      // The script itself still honors any existing SEFAZ cooldown.
      if (triggerOrigin === 'MADRUGADA_02H30' && process.env.VIANFE_AUTO_CIENCIA_ENABLED === 'true') {
        await new Promise<void>((resolve, reject) => execFile(process.execPath,
          [path.resolve(__dirname, '../../scripts/auto_ciencia.mjs')],
          { maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (stdout) console.log(stdout); if (stderr) console.warn(stderr);
            if (err) reject(err); else resolve();
          }));
      }
      const activeCompanies = db.prepare(`
        SELECT id, razao_social, cnpj, cert_filename, last_nsu FROM companies WHERE status = 'ativo'
      `).all() as any[];

      let totalSyncedNotes = 0;

      for (const comp of activeCompanies) {
        if (!comp.cert_filename) {
          console.log(`⏩ [ROBÔ SEFAZ] Empresa ${comp.razao_social} sem certificado digital A1. Pulando.`);
          continue;
        }

        try {
          console.log(`⚡ [ROBÔ SEFAZ] Consultando SEFAZ mTLS para: ${comp.razao_social} (CNPJ: ${comp.cnpj})...`);
          const result = await sefazService.syncCompany(comp.id, 'agendado');
          totalSyncedNotes += (result?.found || 0);

          console.log(`✅ [ROBÔ SEFAZ] ${comp.razao_social}: ${result?.found || 0} novas notas capturadas.`);
          
          // Anti-throttling safety pause between companies
          await new Promise(r => setTimeout(r, 4000));
        } catch (err: any) {
          console.warn(`⚠️ [ROBÔ SEFAZ] Aviso na empresa ${comp.razao_social}:`, err.message);
        }
      }

      console.log(`🏁 [ROBÔ SEFAZ 24/7 - ${triggerOrigin}] Ciclo finalizado com sucesso. Total de notas capturadas no lote: ${totalSyncedNotes}`);
    } catch (err: any) {
      console.error(`❌ [ROBÔ SEFAZ 24/7 - ${triggerOrigin}] Erro crítico no ciclo:`, err.message);
    } finally { fiscalRunning = false; }
  };

  /**
   * Helper function: Backup automático de notas pendentes no Google Drive
   */
  const runDriveAutoBackup = async () => {
    try {
      const pendingInvoices = db.prepare(`
        SELECT i.id, i.company_id, c.razao_social 
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        LEFT JOIN gdrive_configs g ON c.id = g.company_id
        WHERE i.gdrive_synced = 0 AND g.is_active = 1
        LIMIT 50
      `).all() as any[];

      if (pendingInvoices.length > 0) {
        console.log(`☁️ [ROBÔ DRIVE 24/7] Sincronizando lote de ${pendingInvoices.length} notas pendentes com o Google Drive...`);
        for (const inv of pendingInvoices) {
          try {
            await sefazService.syncInvoiceToDrive(inv.id);
            await new Promise(r => setTimeout(r, 1000));
          } catch (e: any) {
            console.warn(`[ROBÔ DRIVE] Erro ao sincronizar nota ${inv.id}:`, e.message);
          }
        }
        console.log(`☁️ [ROBÔ DRIVE 24/7] Lote sincronizado.`);
      }
    } catch (err: any) {
      console.error('[ROBÔ DRIVE 24/7] Erro no backup automático:', err.message);
    }
  };

  // 1. Robô Noturno da Madrugada (Execução estrita entre 01:00 e 03:00 - Horário de Brasília)
  // Ciclo 1: 01:15 AM
  cron.schedule('15 1 * * *', () => {
    runSefazBatchSync('MADRUGADA_01H15');
  }, { timezone: 'America/Sao_Paulo' });

  // Ciclo 2: 02:30 AM
  cron.schedule('30 2 * * *', () => {
    runSefazBatchSync('MADRUGADA_02H30');
  }, { timezone: 'America/Sao_Paulo' });

  // 2. Robô de Backup Automático no Google Drive (A cada 30 minutos - não consome SEFAZ)
  cron.schedule('*/30 * * * *', () => {
    runDriveAutoBackup();
  }, { timezone: 'America/Sao_Paulo' });

  // 3. Robô Radar de Alertas Preditivos no WhatsApp (Diariamente às 09:30 AM - Horário de Brasília)
  cron.schedule('30 9 * * *', () => {
    predictiveAlertsService.runDailyBatchAlerts().catch(e => console.error('[ROBÔ RADAR WHATSAPP] Erro no ciclo matinal:', e.message));
  }, { timezone: 'America/Sao_Paulo' });

  /**
   * Helper function: Executa a sincronização mensal de NFS-e para todas as empresas prestadoras com certificado A1 e CGA
   */
  const runNfseMonthlyBatchSync = async (triggerOrigin: string) => {
    console.log(`🤖 [ROBÔ NFS-E MENSAL - ${triggerOrigin}] Iniciando fechamento de competência...`);
    try {
      // Competência anterior à atual
      const now = new Date();
      let mesCompetencia = now.getMonth(); // Mês anterior (0-11 -> 0 é janeiro)
      let anoCompetencia = now.getFullYear();
      if (mesCompetencia === 0) {
        mesCompetencia = 12;
        anoCompetencia -= 1;
      }

      const activeCompanies = db.prepare(`
        SELECT id, razao_social, cnpj, inscricao_municipal, cert_filename 
        FROM companies 
        WHERE status = 'ativo' AND emite_nfse = 1 AND cert_filename IS NOT NULL AND inscricao_municipal IS NOT NULL AND inscricao_municipal != ''
      `).all() as any[];

      console.log(`📋 [ROBÔ NFS-E MENSAL] ${activeCompanies.length} empresas elegíveis para a competência ${String(mesCompetencia).padStart(2, '0')}/${anoCompetencia}.`);

      const { salvadorNfseMonthlyService } = await import('../services/salvadorNfseMonthlyService.js');
      let totalNotasLote = 0;

      for (const comp of activeCompanies) {
        try {
          console.log(`⚡ [ROBÔ NFS-E] Auditando ${comp.razao_social} (CNPJ: ${comp.cnpj})...`);
          const res = await salvadorNfseMonthlyService.syncMonthlyNfse(comp.id, anoCompetencia, mesCompetencia);
          totalNotasLote += (res?.totalNotas || 0);
          console.log(`✅ [ROBÔ NFS-E] ${comp.razao_social}: ${res?.totalNotas || 0} notas processadas.`);
          // Pausa preventiva de 3s
          await new Promise(r => setTimeout(r, 3000));
        } catch (compErr: any) {
          console.warn(`⚠️ [ROBÔ NFS-E] Aviso na empresa ${comp.razao_social}:`, compErr.message);
        }
      }

      console.log(`🏁 [ROBÔ NFS-E MENSAL - ${triggerOrigin}] Fechamento finalizado! Total de notas capturadas no lote: ${totalNotasLote}`);
    } catch (err: any) {
      console.error(`❌ [ROBÔ NFS-E MENSAL - ${triggerOrigin}] Erro crítico:`, err.message);
    }
  };

  // 4. Robô Mensal de NFS-e (1º dia do mês às 06:00 BRT - Horário de Brasília)
  cron.schedule('0 6 1 * *', () => {
    runNfseMonthlyBatchSync('DIA_01_06H00');
  }, { timezone: 'America/Sao_Paulo' });

  // 5. Repescagem Mensal de NFS-e (3º dia do mês às 06:00 BRT - Horário de Brasília)
  cron.schedule('0 6 3 * *', () => {
    runNfseMonthlyBatchSync('REPESCAGEM_DIA_03_06H00');
  }, { timezone: 'America/Sao_Paulo' });

  console.log('✓ [ROBÔ 24/7] Agendamentos fiscais configurados para a Janela Noturna e Mensal:');
  console.log('  └─ Varredura Madrugada 1: Diariamente às 01:15 AM (Brasília)');
  console.log('  └─ Varredura Madrugada 2: Diariamente às 02:30 AM (Brasília)');
  console.log('  └─ Backup Nuvem Drive: A cada 30 minutos (local para G:)');
  console.log('  └─ Radar Alertas Preditivos WhatsApp: Diariamente às 09:30 AM (Brasília)');
  console.log('  └─ Fechamento Mensal NFS-e: Dia 1º às 06:00 AM (Brasília)');
  console.log('  └─ Repescagem Mensal NFS-e: Dia 3º às 06:00 AM (Brasília)');
}

