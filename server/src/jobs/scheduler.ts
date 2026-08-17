import cron from 'node-cron';
import { db } from '../database/db.js';
import { sefazService } from '../services/sefazService.js';

export function initScheduler() {
  console.log('✓ Initializing automated background scheduler...');

  // Run every 10 minutes to evaluate scheduled company syncs
  cron.schedule('*/10 * * * *', async () => {
    console.log(`[Scheduler] Checking for pending company sync jobs at ${new Date().toISOString()}...`);

    try {
      const activeConfigs = db.prepare(`
        SELECT g.*, c.razao_social, c.status as company_status
        FROM gdrive_configs g
        JOIN companies c ON g.company_id = c.id
        WHERE g.is_active = 1 AND c.status = 'ativo'
      `).all() as any[];

      const now = Date.now();

      for (const config of activeConfigs) {
        let shouldRun = false;
        const lastSync = config.last_sync_at ? new Date(config.last_sync_at).getTime() : 0;
        const elapsedHours = (now - lastSync) / (1000 * 60 * 60);

        switch (config.sync_frequency) {
          case 'hourly':
            if (elapsedHours >= 1) shouldRun = true;
            break;
          case 'every_6h':
            if (elapsedHours >= 6) shouldRun = true;
            break;
          case 'daily':
            if (elapsedHours >= 24) shouldRun = true;
            break;
          default:
            shouldRun = false;
            break;
        }

        if (shouldRun) {
          console.log(`[Scheduler] Executing scheduled sync for ${config.razao_social} (${config.company_id})...`);
          try {
            await sefazService.syncCompany(config.company_id, 'agendado');
          } catch (err: any) {
            console.error(`[Scheduler] Error syncing company ${config.razao_social}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('[Scheduler] Scheduler cycle error:', err.message);
    }
  });

  console.log('✓ Background scheduler active (checking every 10 mins).');
}
