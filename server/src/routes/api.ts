import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { companyController } from '../controllers/companyController.js';
import { invoiceController } from '../controllers/invoiceController.js';
import { driveController } from '../controllers/driveController.js';

const router = Router();
const uploadTemp = multer({ dest: path.join(os.tmpdir(), 'fiscal_uploads') });

// Company Routes
router.get('/companies', companyController.list);
router.get('/companies/:id', companyController.getById);
router.post('/companies', companyController.create);
router.put('/companies/:id', companyController.update);
router.delete('/companies/:id', companyController.delete);
router.post('/companies/:id/certificate', uploadTemp.single('certificate'), companyController.uploadCertificate);
router.get('/cnpj/lookup/:cnpj', companyController.searchCnpj);

// Invoice Routes
router.get('/invoices', invoiceController.list);
router.get('/invoices/:id', invoiceController.getById);
router.get('/invoices/:id/xml', invoiceController.downloadXml);
router.get('/invoices/:id/pdf', invoiceController.downloadPdf);
router.post('/invoices/download-zip', invoiceController.downloadZip);
router.post('/invoices/upload-batch', uploadTemp.array('xmlFiles', 100), invoiceController.uploadBatchXml);
router.post('/invoices/:id/sync-drive', invoiceController.syncToDrive);
router.post('/invoices/sync-company-drive', invoiceController.syncToDrive);

// Google Drive & Audit Logs Routes
router.get('/drive/status', driveController.getStatus);
router.post('/drive/credentials', driveController.saveCredentials);
router.get('/drive/folders', driveController.listFolders);
router.get('/drive/logs', driveController.getLogs);

export default router;
