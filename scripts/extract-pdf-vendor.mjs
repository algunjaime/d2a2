import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(project, 'index.html');
const vendorDirectory = path.join(project, 'public', 'vendor');
const vendorPath = path.join(vendorDirectory, 'pdf-lib.min.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script data-vendor="pdf-lib">([\s\S]*?)<\/script>/);

if (!match) {
  console.log('La biblioteca de PDF ya está separada o no fue encontrada.');
  process.exit(0);
}

fs.mkdirSync(vendorDirectory, { recursive: true });
fs.writeFileSync(vendorPath, match[1].trimStart(), 'utf8');
fs.writeFileSync(htmlPath, html.replace(match[0], '<script src="/vendor/pdf-lib.min.js"></script>'), 'utf8');
console.log('Biblioteca de PDF separada correctamente.');
