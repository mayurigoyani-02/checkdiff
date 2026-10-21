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
