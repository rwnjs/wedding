import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.dependencies = { ...(packageJson.dependencies || {}), "@vercel/blob": "2.8.2" };
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

for (const patch of ['blob-rsvp-store.ts', 'rsvp-server.ts', 'rsvp-roster.ts']) {
  fs.copyFileSync(
    path.join(process.cwd(), 'deploy-patches/lib', patch),
    path.join(process.cwd(), 'lib', patch),
  );
}
fs.rmSync(path.join(process.cwd(), 'deploy-patches'), { recursive: true, force: true });
console.log('Private Blob RSVP backend patch applied.');
