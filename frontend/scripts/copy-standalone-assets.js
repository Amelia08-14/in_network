// output: 'standalone' ne copie pas automatiquement les assets statiques
// (.next/static, public/) dans le bundle autonome — nécessaires pour que
// PM2 puisse servir le site depuis .next/standalone en production.
// Cf. https://nextjs.org/docs/app/api-reference/config/next-config-js/output
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

copyDir(path.join(root, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
copyDir(path.join(root, 'public'), path.join(standaloneDir, 'public'));

console.log('[postbuild] assets statiques copiés dans .next/standalone');
