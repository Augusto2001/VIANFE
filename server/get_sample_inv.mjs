import { db } from './dist/database/db.js';

const inv = db.prepare('SELECT id, chave_acesso, numero FROM invoices LIMIT 1').get();
console.log('Sample Invoice:', inv);
