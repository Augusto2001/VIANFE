import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/api.js';
import { initDatabase, STORAGE_DIR } from './database/db.js';
import { initScheduler } from './jobs/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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
