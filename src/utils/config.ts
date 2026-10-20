import fs from 'fs';
export async function loadConfig() {
  const candidates = ['checkdiff.config.js','checkdiff.config.mjs','checkdiff.config.json'];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        if (c.endsWith('.json')) return JSON.parse(fs.readFileSync(c,'utf8'));
        const mod = await import(process.cwd()+'/'+c);
        return mod.default || mod;
      } catch {}
    }
  }
  return { mapping: {}, e2e: { testDir: 'e2e' } };
}
