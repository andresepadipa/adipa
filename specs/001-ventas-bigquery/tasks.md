# Tasks 001

- [x] T1 — Explorar el esquema de BigQuery y encontrar la tabla equivalente al BI web.
- [x] T2 — Reproducir los 7 números del brief con una query y documentar diferencias.
- [x] T3 — `package.json` + `.gitignore` (node_modules, gcp-key.json, .env*).
- [x] T4 — `api/ventas.js`: credencial, query, metas por mes, corte, caché, manejo de error.
- [x] T5 — `scripts/probar-api.mjs` para probar el handler localmente contra BigQuery real.
- [x] T6 — `index.html`: `BASE` desde `/api/ventas`, badge/título dinámicos, auto-refresh
        cada 10 min + `visibilitychange`, degradación con caché en localStorage.
- [x] T7 — Verificar local: los 7 montos calzan con la spec.
- [ ] T8 — Andrea carga `GCP_SERVICE_ACCOUNT_JSON` en Vercel (Sensitive, Production+Preview).
- [ ] T9 — Commit + push a `main`; verificar el primer deploy CON funciones.
- [ ] T10 — Verificar en producción (`/api/ventas` responde y la página muestra los montos).

## Verificación local (31-ago-2026)
- `node scripts/probar-api.mjs` → 7 grupos, total $313.487.181, 92,2% meta / 98,1% piso,
  corte 2026-08-31T16:56:24. Calza con la spec.
- Página completa en `node scripts/servidor-local.mjs` (http://localhost:4321): badge
  "Corte 31-ago 16:56", KPIs $313,49M / 92.2% / 98.1%, tabla, proyección "Cuadrado ✓",
  lectura rápida y "+ Agregar persona" intactos.
- Degradación probada con `FALLAR=1 node scripts/servidor-local.mjs`: muestra la copia
  guardada con el aviso "No se pudo conectar con BigQuery…".
