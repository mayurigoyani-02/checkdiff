// src/utils/portResolver.ts - service passes port, not auto-find
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
    path.join(rootDir, 'checkdiff.config.ts'),
    path.join(rootDir, 'api/checkdiff.config.js'),
    path.join(process.cwd(), 'checkdiff.config.js'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);
        console.log(`  ✔ Loaded service config from ${configPath}`);
        return config;
      } catch (e: any) {
        console.log(`  ⚠ Failed to load ${configPath}: ${e.message}`);
      }
    }
  }
  return {};
}

export function resolveApiPort(rootDir: string, cliPort?: number): { port: number; baseUrl: string; config: ServiceConfig } {
  const config = loadServiceConfig(rootDir);

  // Priority: 1. CLI --port, 2. config file, 3. .env, 4. auto-detect, 5. 4000
  if (cliPort) {
    return { port: cliPort, baseUrl: `http://localhost:${cliPort}`, config };
  }

  if (config.api?.baseUrl) {
    const url = new URL(config.api.baseUrl);
    return { port: parseInt(url.port) || 4000, baseUrl: config.api.baseUrl, config };
  }

  if (config.api?.port) {
    return { port: config.api.port, baseUrl: `http://localhost:${config.api.port}`, config };
  }  
}