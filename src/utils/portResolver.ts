// src/utils/portResolver.ts - ALWAYS RETURNS OBJECT
import fs from 'fs';
import path from 'path';

export interface ServiceConfig {
  api?: { port?: number; baseUrl?: string; swaggerPath?: string; healthPath?: string };
  website?: { port?: number; baseUrl?: string };
  testDir?: string;
  autoTestDir?: string;
  infraPatterns?: string[];
  configPatterns?: string[];
  discoverEndpoints?: (rootDir: string) => Promise<string[]> | string[];
}

export function loadServiceConfig(rootDir: string): ServiceConfig {
  const configPaths = [
    path.join(rootDir, 'checkdiff.config.js'),
    path.join(rootDir, 'checkdiff.config.cjs'),
    path.join(process.cwd(), 'checkdiff.config.js'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      // Handle ESM project where checkdiff.config.js is .js under "type": "module" (e.g. complex-service).
      // Try CJS require; if that fails because it's an ESM, try .cjs fallback, then silent return {}.
      try {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        console.log(`  ✔ Loaded service config from ${configPath}`);
        return config;
      } catch (e: any) {
        const msg: string = e.message || '';
        const isEsmError = msg.includes('require() of ES Module') || msg.includes('is treated as an ES module');
        if (isEsmError) {
          const cjsPath = configPath.replace(/\.js$/, '.cjs');
          if (fs.existsSync(cjsPath) && cjsPath !== configPath) {
            try {
              delete require.cache[require.resolve(cjsPath)];
              const config = require(cjsPath);
              console.log(`  ✔ Loaded service config from ${cjsPath} (ESM fallback)`);
              return config;
            } catch {}
          }
          // No CJS fallback — do not warn (normal for ESM service with unneeded config).
          return {};
        }
        console.log(`  ⚠ Failed to load ${configPath}: ${e.message}`);
      }
    }
  }
  return {};
}

export function resolveApiPort(rootDir: string, cliPort?: number): { port: number; baseUrl: string; config: ServiceConfig } {
  const config = loadServiceConfig(rootDir);
  const defaultResult = { port: 4000, baseUrl: 'http://localhost:4000', config };

  try {
    if (cliPort && !isNaN(cliPort)) {
      return { port: cliPort, baseUrl: `http://localhost:${cliPort}`, config };
    }

    if (config.api?.baseUrl) {
      try {
        const url = new URL(config.api.baseUrl);
        const p = url.port ? parseInt(url.port) : 4000;
        return { port: isNaN(p) ? 4000 : p, baseUrl: config.api.baseUrl, config };
      } catch {
        return { port: config.api?.port || 4000, baseUrl: config.api.baseUrl, config };
      }
    }

    if (config.api?.port && !isNaN(config.api.port)) {
      return { port: config.api.port, baseUrl: `http://localhost:${config.api.port}`, config };
    }

    // .env check
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/PORT\s*=\s*(\d+)/i);
      if (match) {
        const p = parseInt(match[1]);
        if (!isNaN(p)) return { port: p, baseUrl: `http://localhost:${p}`, config };
      }
    }

    return defaultResult;
  } catch (e) {
    console.log(`  ⚠ Port resolve error: ${e}, using default 4000`);
    return defaultResult;
  }
}