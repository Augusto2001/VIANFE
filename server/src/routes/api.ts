import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { companyController } from '../controllers/companyController.js';
import { invoiceController } from '../controllers/invoiceController.js';
import { driveController } from '../controllers/driveController.js';
import { authController } from '../controllers/authController.js';
import { usersController } from '../controllers/usersController.js';
import { manifestacaoController } from '../controllers/manifestacaoController.js';
import { nfseController } from '../controllers/nfseController.js';
import { bpoController } from '../controllers/bpoController.js';
import { tenantsController } from '../controllers/tenantsController.js';
import { portalController } from '../controllers/portalController.js';
import { verifyJwtAndTenant, requireAdmin, optionalJwtOrPublicDoc } from '../middleware/authMiddleware.js';
import { db } from '../database/db.js';

const router = Router();
const uploadTemp = multer({ dest: path.join(os.tmpdir(), 'fiscal_uploads') });

// Auth Routes (Public Login & Password Reset)
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', verifyJwtAndTenant, authController.getMe);

// Multi-Office SaaS Tenants (Escritórios Contábeis Parceiros)
router.get('/tenants', verifyJwtAndTenant, requireAdmin, tenantsController.listTenants);
router.post('/tenants', verifyJwtAndTenant, requireAdmin, tenantsController.createTenant);
router.put('/tenants/:id', verifyJwtAndTenant, requireAdmin, tenantsController.updateTenant);
router.delete('/tenants/:id', verifyJwtAndTenant, requireAdmin, tenantsController.deleteTenant);

// User Management Routes (Admin Viacont Only - Protected)
router.get('/users', verifyJwtAndTenant, requireAdmin, usersController.listUsers);
router.post('/users', verifyJwtAndTenant, requireAdmin, usersController.createUser);
router.put('/users/:id/password', verifyJwtAndTenant, requireAdmin, usersController.updatePassword);
router.delete('/users/:id', verifyJwtAndTenant, requireAdmin, usersController.deleteUser);

// Company Routes (Protected by JWT & Tenant)
router.get('/companies', verifyJwtAndTenant, companyController.list);
router.get('/companies/:id', verifyJwtAndTenant, companyController.getById);
router.post('/companies', verifyJwtAndTenant, companyController.create);
router.put('/companies/:id', verifyJwtAndTenant, companyController.update);
router.delete('/companies/:id', verifyJwtAndTenant, companyController.delete);
router.post('/companies/:id/certificate', verifyJwtAndTenant, uploadTemp.single('certificate'), companyController.uploadCertificate);
router.get('/cnpj/lookup/:cnpj', verifyJwtAndTenant, companyController.searchCnpj);
router.get('/companies/:id/test-certificate', verifyJwtAndTenant, companyController.testCertificate);
router.post('/companies/:id/sync-sefaz', verifyJwtAndTenant, companyController.syncSefaz);

// Invoice Routes (Protected by JWT & Tenant / Public Document Streaming)
router.get('/invoices', verifyJwtAndTenant, invoiceController.list);
router.get('/invoices/:id', verifyJwtAndTenant, invoiceController.getById);
router.get('/invoices/:id/xml', optionalJwtOrPublicDoc, invoiceController.downloadXml);
router.get('/invoices/:id/pdf', optionalJwtOrPublicDoc, invoiceController.downloadPdf);
router.get('/invoices/:id/danfe', optionalJwtOrPublicDoc, invoiceController.downloadPdf);
router.post('/invoices/download-zip', verifyJwtAndTenant, invoiceController.downloadZip);
router.post('/invoices/upload-batch', verifyJwtAndTenant, uploadTemp.array('xmlFiles', 100), invoiceController.uploadBatchXml);
router.post('/invoices/:id/sync-drive', verifyJwtAndTenant, invoiceController.syncToDrive);
router.post('/invoices/sync-company-drive', verifyJwtAndTenant, invoiceController.syncToDrive);

// BPO Financeiro & Conciliação Bancária Lado a Lado
router.get('/bpo/accounts', verifyJwtAndTenant, bpoController.getAccounts);
router.post('/bpo/accounts', verifyJwtAndTenant, bpoController.createAccount);
router.post('/bpo/upload-statement', verifyJwtAndTenant, bpoController.uploadStatement);
router.get('/bpo/transactions', verifyJwtAndTenant, bpoController.getTransactions);
router.post('/bpo/reconcile/:id', verifyJwtAndTenant, bpoController.reconcileTransaction);
router.get('/bpo/categories', verifyJwtAndTenant, bpoController.getCategories);
router.get('/bpo/business-success', verifyJwtAndTenant, bpoController.getBusinessSuccessKpis);
router.get('/bpo/export-dominio', verifyJwtAndTenant, bpoController.exportDominioBatches);

// Plano de Contas Domínio & Provisões Contábeis (Folha e Impostos)
router.post('/bpo/chart-of-accounts/import', verifyJwtAndTenant, bpoController.importChartOfAccounts);
router.post('/bpo/chart-of-accounts/clear', verifyJwtAndTenant, bpoController.clearChartOfAccounts);
router.get('/bpo/chart-of-accounts', verifyJwtAndTenant, bpoController.getChartOfAccounts);
router.post('/bpo/provisions/import-payroll', verifyJwtAndTenant, bpoController.importPayrollProvisions);
router.post('/bpo/provisions/import-taxes', verifyJwtAndTenant, bpoController.importTaxProvisions);
router.get('/bpo/provisions', verifyJwtAndTenant, bpoController.getProvisions);

// Radar de Alertas Preditivos no WhatsApp (48h antes do vencimento)
router.get('/bpo/alerts/upcoming', verifyJwtAndTenant, bpoController.getUpcomingAlerts);
router.post('/bpo/alerts/send-whatsapp', verifyJwtAndTenant, bpoController.sendPredictiveAlertWhatsApp);
router.get('/bpo/alerts/history', verifyJwtAndTenant, bpoController.getAlertsHistory);

// NF-e Manifestação do Destinatário Routes (Protected by JWT & Tenant)
router.post('/portal/manifest', verifyJwtAndTenant, manifestacaoController.submitManifestation);
router.get('/portal/manifestations/:invoiceId', verifyJwtAndTenant, manifestacaoController.getManifestations);

// NFS-e Prefeituras & WhatsApp n8n Webhook Routes
router.get('/portal/nfse', verifyJwtAndTenant, nfseController.getNfseList);
router.post('/portal/nfse/emit', verifyJwtAndTenant, nfseController.emitNfse);
router.delete('/portal/nfse/:id', verifyJwtAndTenant, nfseController.deleteNfse);
router.get('/portal/nfse/:id/pdf', nfseController.getPdf);
router.get('/portal/nfse/:id/xml', nfseController.getXml);
router.get('/portal/nfse/clients', verifyJwtAndTenant, nfseController.getRecurringClients);
router.post('/portal/nfse/clients', verifyJwtAndTenant, nfseController.saveRecurringClient);
router.delete('/portal/nfse/clients/:id', verifyJwtAndTenant, nfseController.deleteRecurringClient);
router.get('/portal/nfse/focus-config', verifyJwtAndTenant, nfseController.getFocusNfeConfig);
router.post('/portal/nfse/focus-config', verifyJwtAndTenant, nfseController.saveFocusNfeConfig);
router.post('/portal/nfse/webhook-whatsapp', nfseController.handleWhatsappWebhook); // Webhook integration

// ============================================================================
// SUPER APP VIACONT (ÁREA DO CLIENTE) REST API ROUTES
// ============================================================================

// R5: Painel Financeiro em Tempo Real & Termômetro Simples Nacional
router.get('/portal/dashboard/summary', verifyJwtAndTenant, portalController.getDashboardSummary);
router.get('/portal/dashboard-summary', verifyJwtAndTenant, portalController.getDashboardSummary);

// R2: Emissor Relâmpago em 3 Passos & Espelho da Nota
router.post('/portal/invoices/emit-fast', verifyJwtAndTenant, portalController.emitFastInvoice);
router.get('/portal/invoices/recent', verifyJwtAndTenant, portalController.getRecentInvoices);
router.get('/portal/invoices/:id/pdf', optionalJwtOrPublicDoc, portalController.getInvoicePdf);

// R2: Catálogo de Produtos & Serviços Favoritos (1-Toque)
router.get('/portal/favorites', verifyJwtAndTenant, portalController.listFavorites);
router.post('/portal/favorites', verifyJwtAndTenant, portalController.createFavorite);
router.put('/portal/favorites/:id', verifyJwtAndTenant, portalController.updateFavorite);
router.delete('/portal/favorites/:id', verifyJwtAndTenant, portalController.deleteFavorite);

// R2: Catálogo de Clientes / Tomadores Recorrentes
router.get('/portal/recurring-clients', verifyJwtAndTenant, portalController.listRecurringClients);
router.post('/portal/recurring-clients', verifyJwtAndTenant, portalController.saveRecurringClient);
router.delete('/portal/recurring-clients/:id', verifyJwtAndTenant, portalController.deleteRecurringClient);

// R3: Central de Guias & Impostos com 1-Clique PIX
router.get('/portal/tax-guides', verifyJwtAndTenant, portalController.listTaxGuides);
router.get('/portal/tax-guides/:id', verifyJwtAndTenant, portalController.getTaxGuideById);
router.get('/portal/tax-guides/:id/pdf', optionalJwtOrPublicDoc, portalController.getTaxGuidePdf);
router.get('/portal/tax-guides/:id/pix', verifyJwtAndTenant, portalController.getTaxGuidePix);
router.post('/portal/tax-guides/:id/pay', verifyJwtAndTenant, portalController.payTaxGuide);
router.patch('/portal/tax-guides/:id/status', verifyJwtAndTenant, portalController.updateTaxGuideStatus);

// R4: Scanner OCR de Recibos & Auto-Match Contas a Pagar
router.post('/portal/receipts/scan', verifyJwtAndTenant, uploadTemp.single('image'), portalController.scanReceiptOcr);
router.get('/portal/receipts', verifyJwtAndTenant, portalController.listReceipts);
router.post('/portal/receipts/:id/confirm', verifyJwtAndTenant, portalController.confirmReceiptMatch);
router.delete('/portal/receipts/:id', verifyJwtAndTenant, portalController.deleteReceipt);

import { taxAuditController } from '../controllers/taxAuditController.js';
import { whatsappService } from '../services/whatsappService.js';

// Tax Audit & Oportunidades Tributárias (Monofásicos, NCM, CFOP)
router.get('/tax-audit/summary', verifyJwtAndTenant, taxAuditController.getAuditSummary);

// WhatsApp ZapCont Safe Notifications
router.post('/notifications/whatsapp-send', verifyJwtAndTenant, async (req, res) => {
  try {
    const { phone, message, pdfUrl, companyName, isManualTrigger } = req.body;
    const result = await whatsappService.sendMessage({ phone, message, pdfUrl, companyName }, isManualTrigger ?? true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

import { supportController } from '../controllers/supportController.js';

// Suporte Técnico & Central de Chamados WhatsApp
router.post('/support/tickets', supportController.createTicket);
router.get('/support/tickets', verifyJwtAndTenant, supportController.getTickets);
router.put('/support/tickets/:id/resolve', verifyJwtAndTenant, supportController.resolveTicket);

// Google Drive & Audit Logs Routes (Protected by JWT & Tenant)
router.get('/drive/status', verifyJwtAndTenant, driveController.getStatus);
router.post('/drive/credentials', verifyJwtAndTenant, requireAdmin, driveController.saveCredentials);
router.get('/drive/folders', verifyJwtAndTenant, driveController.listFolders);
router.get('/drive/logs', verifyJwtAndTenant, driveController.getLogs);

// System Settings (2Captcha Key & Integrations)
router.get('/settings/captcha-key', verifyJwtAndTenant, (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'twocaptcha_api_key'").get() as any;
    res.json({ success: true, key: row ? row.value : (process.env.TWOCAPTCHA_API_KEY || '') });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings/captcha-key', verifyJwtAndTenant, (req, res) => {
  try {
    const { key } = req.body;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at) 
      VALUES ('twocaptcha_api_key', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(String(key || '').trim(), nowIso);
    res.json({ success: true, message: 'Chave 2Captcha salva com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
