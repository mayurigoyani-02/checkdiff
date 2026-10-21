"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeJsDiff = analyzeJsDiff;
// import traverse from '@babel/traverse';
function analyzeJsDiff(diffContent) {
    // MVP: detect changed functions/routes
    // Full version: parse AST before/after
    const changedRoutes = [];
    const regex = /(app\.(get|post|put|delete)|router\.(get|post)|\/api\/[^\s'"]+)/g;
    let m;
    while ((m = regex.exec(diffContent)) !== null) {
        changedRoutes.push(m[0]);
    }
    return { changedRoutes: [...new Set(changedRoutes)] };
}
