#!/usr/bin/env node
// SOURCING: none. Merges extensionEnabledApiProposals for commonplace.theorem-vscode
// into the stock code-server product.json without replacing upstream entries.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const candidates = [
  '/usr/local/lib/code-server/lib/vscode/product.json',
  '/usr/local/lib/code-server/product.json',
];

// Standalone install.sh lands at /usr/local/lib/code-server-<version>/...
try {
  for (const entry of readdirSync('/usr/local/lib')) {
    if (!entry.startsWith('code-server')) continue;
    candidates.push(
      path.join('/usr/local/lib', entry, 'lib/vscode/product.json'),
      path.join('/usr/local/lib', entry, 'product.json'),
    );
  }
} catch {
  // /usr/local/lib may be absent in a unit test; candidates list still runs.
}

const productPath = candidates.find((candidate) => existsSync(candidate));
if (!productPath) {
  console.error('patch-code-server-product: product.json not found');
  console.error(`patch-code-server-product: looked in ${candidates.join(', ')}`);
  process.exit(1);
}

const product = JSON.parse(readFileSync(productPath, 'utf8'));
const proposals = {
  ...(product.extensionEnabledApiProposals ?? {}),
  'commonplace.theorem-vscode': [
    'fileSearchProvider2',
    'textSearchProvider2',
    'timeline',
  ],
};
product.extensionEnabledApiProposals = proposals;
writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
console.log(`patch-code-server-product: granted proposals in ${productPath}`);
