import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('../../client/dist:', path.resolve(__dirname, '../../client/dist'), 'exists:', fs.existsSync(path.resolve(__dirname, '../../client/dist')));
console.log('../client/dist:', path.resolve(__dirname, '../client/dist'), 'exists:', fs.existsSync(path.resolve(__dirname, '../client/dist')));
console.log('/app/client/dist:', '/app/client/dist', 'exists:', fs.existsSync('/app/client/dist'));

if (fs.existsSync(path.resolve(__dirname, '../../client/dist/index.html'))) {
  console.log('Content of ../../client/dist/index.html:\n', fs.readFileSync(path.resolve(__dirname, '../../client/dist/index.html'), 'utf-8'));
}
if (fs.existsSync('/app/client/dist/index.html')) {
  console.log('Content of /app/client/dist/index.html:\n', fs.readFileSync('/app/client/dist/index.html', 'utf-8'));
}
