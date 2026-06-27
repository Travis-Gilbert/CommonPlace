import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const serverCandidates = [
  '.next/standalone/server.js',
  '.next/standalone/apps/web/server.js',
];

const serverPath = serverCandidates.map((candidate) => resolve(candidate)).find(existsSync);

if (!serverPath) {
  console.error(
    `Missing Railway standalone server. Checked: ${serverCandidates.join(', ')}`
  );
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    HOSTNAME: process.env.RAILWAY_BIND_HOST ?? '0.0.0.0',
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`Failed to start Railway standalone server: ${error.message}`);
  process.exit(1);
});
