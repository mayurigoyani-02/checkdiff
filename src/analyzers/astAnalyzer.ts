import { parse } from '@babel/parser';
// import traverse from '@babel/traverse';

export function analyzeJsDiff(diffContent: string) {
  // MVP: detect changed functions/routes
  // Full version: parse AST before/after
  const changedRoutes: string[] = [];
  const regex = /(app\.(get|post|put|delete)|router\.(get|post)|\/api\/[^\s'"]+)/g;
  let m;
  while ((m = regex.exec(diffContent)) !== null) {
    changedRoutes.push(m[0]);
  }
  return { changedRoutes: [...new Set(changedRoutes)] };
}
