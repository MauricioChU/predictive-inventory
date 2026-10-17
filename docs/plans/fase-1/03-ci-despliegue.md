# Plan 03 — CI y publicación en GitHub Pages

> **Para agentes:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (o executing-plans). Pasos `- [ ]`. Leer [00-plan-maestro.md](00-plan-maestro.md).

**Objetivo:** que cada push y pull request a `develop` y `main` se verifique solo, y que cada actualización de `main` se publique en GitHub Pages.

**Rama:** `chore/ci-despliegue`. Solo crea archivos en `.github/` y una sección del `README.md` raíz.

**Spec:** [07-calidad.md](../../specs/fase-1/07-calidad.md) (Integración continua), [ADR-0007](../../adr/0007-hosting-github-pages.md), [ADR-0009](../../adr/0009-flujo-de-ramas-y-ci.md).

**Scripts que el CI usa** (los crean `feat/fundamentos` y `feat/ui-base`; aquí solo se invocan): `npm run lint:ci`, `npm run type-check`, `npm run test:cobertura`, `npm run build-only`, `npm run verificar-specs`, `npx playwright test`.

---

### Tarea 1: Workflow de integración continua

**Archivos:** crear `.github/workflows/ci.yml`.

- [ ] **Paso 1: escribir el workflow**

```yaml
name: CI

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  frontend:
    name: Frontend (lint, tipos, tests, build)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint:ci
      - run: npm run type-check
      - name: Tests con cobertura
        run: npm run test:cobertura
        env:
          # En main todos los escenarios Gherkin deben estar implementados.
          GHERKIN_ESTRICTO: ${{ (github.base_ref == 'main' || github.ref == 'refs/heads/main') && '1' || '0' }}
      - run: npm run build-only

  specs:
    name: Specs (cada regla tiene escenario)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm run verificar-specs

  e2e:
    name: E2E (celular y PC)
    runs-on: ubuntu-latest
    needs: frontend
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build-only
      - run: npx playwright test
        env:
          CI: 'true'
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: reporte-playwright
          path: frontend/playwright-report
          retention-days: 7

  backend:
    name: Backend (ruff, mypy, pytest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: backend/pyproject.toml
      - run: pip install -e ".[dev]"
      - run: ruff check .
      - run: ruff format --check .
      - run: mypy src
      - run: pytest
```
Nota: `verificar-specs` no necesita `npm ci` (es un script de Node sin dependencias).

- [ ] **Paso 2: validar la sintaxis** — en el scratchpad (no en el repo):

```bash
mkdir -p "$SCRATCH/yaml" && cd "$SCRATCH/yaml" && npm init -y >/dev/null && npm i yaml >/dev/null
node -e "const y=require('yaml');const fs=require('fs');for(const f of process.argv.slice(1)){y.parse(fs.readFileSync(f,'utf8'));console.log('OK',f)}" "<ruta-al-repo>/.github/workflows/ci.yml"
```
Expected: `OK …/ci.yml`. Revisar a mano que cada `working-directory` exista y que los nombres de scripts coincidan con la lista de arriba.

- [ ] **Paso 3:** commit `ci: lint, tipos, tests, specs, e2e y backend en cada push y PR`.

---

### Tarea 2: Publicación en GitHub Pages

**Archivos:** crear `.github/workflows/publicar.yml`; modificar `README.md` (raíz).

- [ ] **Paso 1: escribir el workflow**

```yaml
name: Publicar en GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  construir:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build-only
      # Enlaces directos (p. ej. /predictive-inventory/vender) en GitHub Pages
      - run: cp dist/index.html dist/404.html
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist

  publicar:
    needs: construir
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.despliegue.outputs.page_url }}
    steps:
      - id: despliegue
        uses: actions/deploy-pages@v4
```

- [ ] **Paso 2:** validar la sintaxis igual que en la Tarea 1.

- [ ] **Paso 3: README** — agregar al final de `README.md` (raíz):

```markdown
## Publicación

La app se publica gratis en GitHub Pages cada vez que se actualiza `main`:
**https://mauriciochu.github.io/predictive-inventory/**

Activación (una sola vez): en GitHub, *Settings → Pages → Build and deployment → Source: **GitHub Actions***.

Para instalarla en el celular: abrir el enlace en Chrome (Android) y tocar **Instalar app** (o menú ⋮ → *Agregar a la pantalla principal*). Después funciona sin internet.

## Integración continua

Cada push y pull request a `develop` y `main` corre lint, tipos, tests con cobertura, verificación de specs, E2E (celular y PC) y los checks del backend. Recomendado: proteger `develop` y `main` para exigir que el CI pase (*Settings → Branches*).
```

- [ ] **Paso 4:** commit `ci: publicación automática en GitHub Pages desde main`.
