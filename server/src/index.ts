import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import apiRouter from './routes/api.js';
import { initDatabase, STORAGE_DIR } from './database/db.js';
import { initScheduler } from './jobs/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware & Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (for direct download links if necessary)
app.use('/storage', express.static(STORAGE_DIR));

// API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'DF-e Fiscal Hub API' });
});

// Serve frontend React production static files
const possiblePaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(__dirname, '../client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  '/app/client/dist'
];
const clientDistPath = possiblePaths.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), 'client/dist');
console.log(`[ViaNfe Server] Serving frontend SPA from: ${clientDistPath}`);
app.use(express.static(clientDistPath));

// SPA Fallback for React Router client routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/storage') || req.path.startsWith('/health')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('ViaNFe UI not found. Please verify client build.');
  }
});

// Initialize database and background scheduler
try {
  initDatabase();
  initScheduler();
} catch (err) {
  console.error('Initialization error:', err);
}

// Start HTTP server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 DF-e Fiscal Server running on http://localhost:${PORT}`);
  console.log(`⚡ API Endpoints ready at http://localhost:${PORT}/api`);
  console.log(`📁 Storage directory: ${STORAGE_DIR}`);
  console.log(`====================================================`);
});
