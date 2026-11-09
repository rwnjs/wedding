import { execFileSync } from 'node:child_process';

for (const script of [
  'link-fix.mjs',
  'guestlist-backend-patch.mjs',
  'guestlist-ui-actions-patch.mjs',
  'guestlist-ui-markup-patch.mjs',
  'guestlist-style-patch.mjs',
]) {
  execFileSync('node', [script], { stdio: 'inherit' });
}

execFileSync('npx', [
  '--yes', 'npm@10.9.2', 'install',
  '--legacy-peer-deps', '--no-audit', '--no-fund', '--package-lock=false',
], { stdio: 'inherit' });
