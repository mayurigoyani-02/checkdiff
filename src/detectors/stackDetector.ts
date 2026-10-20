import { globby } from 'globby';
import fs from 'fs';

export type Stack = { type: string, framework: string, testDir?: string };

export async function detectStack(): Promise<Stack> {
  const has = (p: string) => fs.existsSync(p);
  if (has('next.config.js') || has('next.config.mjs')) return { type: 'web', framework: 'nextjs', testDir: 'e2e' };
  if (has('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['@playwright/test'] || deps['playwright']) return { type: 'web', framework: 'playwright' };
    if (deps['react']) return { type: 'web', framework: 'react' };
    if (deps['vue']) return { type: 'web', framework: 'vue' };
    if (deps['express']) return { type: 'service', framework: 'express' };
  }
  if (has('requirements.txt') || has('pyproject.toml')) return { type: 'service', framework: 'python' };
  if (has('wp-config.php')) return { type: 'cms', framework: 'wordpress' };
  if (has('shopify.config.js')) return { type: 'ecommerce', framework: 'shopify' };
  return { type: 'static', framework: 'unknown' };
}
