# CheckDiff E2E - Universal Check-in Aware Tester

One command to test only what changed. Works for ANY website/service.

## Install (Any Stack)

**Docker (Truly Universal)**
```bash
docker run -v $(pwd):/app -v /var/run/docker.sock:/var/run/docker.sock checkdiff/checkdiff run --base main
```

**NPM (JS/TS projects)**
```bash
npx checkdiff-e2e@latest run --base main --head HEAD
```

**Any website (Black-box)**
```bash
npx checkdiff-e2e run --url https://your-site.com
```

## How it works

1. `git diff main...HEAD` -> finds changed files
2. AST analyzer -> understands WHAT changed (not just file name)
3. Impact Mapper -> maps to @tags
4. Profile Generator -> `playwright test --grep @checkout`
5. Runner -> only runs impacted E2E tests (80% faster)

## Modes

- **White-box**: with git, fastest and most accurate
- **Black-box**: no code access, crawls sitemap + OpenAPI, does visual diff

## Add to CI

```yaml
# .github/workflows/checkdiff.yml
- uses: checkdiff/action@v1
  with:
    base-branch: main
```

## Config (Optional)

Auto-detects Next.js, React, Vue, Express, Django, FastAPI, WordPress.

To customize: `npx checkdiff init` creates `checkdiff.config.js`
