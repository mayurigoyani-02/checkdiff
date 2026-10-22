// src/analyzer/changeClassifier.ts - deep endpoint discovery
import fs from 'fs';
import path from 'path';

export type ChangeType = 'route' | 'config' | 'code' | 'test' | 'docs' | 'infra';
export interface ClassifiedChange {
  file: string;
  type: ChangeType;
  subType: string;
  classes: string[];
  methods: string[];
  routes: string[];
  endpoints: string[];
  impactedEndpoints: string[]; // All endpoints impacted by this file
}

function scanAllEndpoints(rootDir: string): string[] {
  const endpoints: string[] = [];
  const routesDir = path.join(rootDir, 'src/routes');
  const srcDir = path.join(rootDir, 'src');
  
  const scanDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scanDir(full);
      } else if (full.endsWith('.js') || full.endsWith('.ts')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const matches = content.matchAll(/(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
          for (const m of matches) {
            endpoints.push(`${m[1].toUpperCase()} ${m[2]}`);
          }
        } catch {}
      }
    }
  };
  
  scanDir(routesDir);
  if (endpoints.length === 0) scanDir(srcDir); // fallback
  return [...new Set(endpoints)];
}

function extractRoutes(content: string): string[] {
  const routes: string[] = [];
  const patterns = [
    /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /@(?:Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      const route = m[2] || m[1];
      if (route) routes.push(route);
    }
  }
  return [...new Set(routes)];
}

export function classifyChanges(changedFiles: string[], rootDir: string): ClassifiedChange[] {
  const allProjectEndpoints = scanAllEndpoints(rootDir);
  console.log(`  Found ${allProjectEndpoints.length} endpoints in project: ${allProjectEndpoints.join(', ') || 'none - add routes!'}`);

  return changedFiles.map(file => {
    let content = '';
    try {
      const fullPath = path.isAbsolute(file) ? file : path.join(rootDir, file);
      if (fs.existsSync(fullPath)) content = fs.readFileSync(fullPath, 'utf8');
    } catch {}

    const lower = file.toLowerCase();
    let type: ChangeType = 'code';
    let subType = 'unknown';
    let impactedEndpoints = allProjectEndpoints;

    if (/index\.(js|ts)$/.test(lower) && lower.includes('src')) {
      type = 'infra';
      subType = 'main-entry - impacts ALL endpoints';
      impactedEndpoints = allProjectEndpoints; // index.js change = all APIs impacted
    }
    else if (/\.config\.(js|ts|json)$|package\.json/.test(lower)) {
      type = 'config';
      subType = 'app-config - impacts ALL endpoints';
      impactedEndpoints = allProjectEndpoints;
    }
    else if (/routes?|router|controller/.test(lower) || /app\.(get|post|put|delete)/.test(content)) {
      type = 'route';
      subType = 'api-route';
      impactedEndpoints = extractRoutes(content).map(r => `* ${r}`);
      if (impactedEndpoints.length === 0) impactedEndpoints = allProjectEndpoints.filter(ep => lower.includes(ep.split('/').pop() || ''));
    }
    else if (/service/.test(lower)) {
      type = 'code';
      subType = 'service-logic';
      // payment service -> impacts /api/payment endpoints
      const serviceName = path.basename(file, path.extname(file)).toLowerCase().replace('service','');
      impactedEndpoints = allProjectEndpoints.filter(ep => ep.toLowerCase().includes(serviceName));
    }

    const classes = [...content.matchAll(/class\s+(\w+)/g)].map(m => m[1]);
    const methods = [...content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g)].map(m => m[1]).filter(n => n.length > 3).slice(0, 10);
    const routes = extractRoutes(content);
    const endpoints = routes.map(r => {
      const methodMatch = content.match(new RegExp(`(get|post|put|delete|patch)[^/]*${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
      return `${(methodMatch?.[1] || 'GET').toUpperCase()} ${r}`;
    });

    return { 
      file, type, subType, classes, methods, routes, endpoints,
      impactedEndpoints: impactedEndpoints.length ? impactedEndpoints : endpoints
    };
  });
}