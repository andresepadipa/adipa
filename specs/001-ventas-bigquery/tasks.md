# Tasks 001

- [x] T1 — Explorar el esquema de BigQuery y encontrar la tabla equivalente al BI web.
- [x] T2 — Reproducir los 7 números del brief con una query y documentar diferencias.
- [x] T3 — `package.json` + `.gitignore` (node_modules, gcp-key.json, .env*).
- [x] T4 — `api/ventas.js`: credencial, query, metas por mes, corte, caché, manejo de error.
- [x] T5 — `scripts/probar-api.mjs` para probar el handler localmente contra BigQuery real.
- [x] T6 — `index.html`: `BASE` desde `/api/ventas`, badge/título dinámicos, auto-refresh
        cada 10 min + `visibilitychange`, degradación con caché en localStorage.
- [x] T7 — Verificar local: los 7 montos calzan con la spec.
- [x] T8 — Credencial en Vercel. El JSON pegado a mano quedó **cortado** (faltaba la última
        propiedad y el `}`), así que quedó cargada como `GCP_SA_KEY_BASE64` (una sola línea).
        La función ahora recorre las variables y usa la primera que parsee.
- [x] T9 — Commit + push a `main`; verificar el primer deploy CON funciones.
- [x] T10 — Verificar en producción (`/api/ventas` responde y la página muestra los montos).

## Verificación local (31-ago-2026)
- `node scripts/probar-api.mjs` → 7 grupos, total $313.487.181, 92,2% meta / 98,1% piso,
  corte 2026-08-31T16:56:24. Calza con la spec.
- Página completa en `node scripts/servidor-local.mjs` (http://localhost:4321): badge
  "Corte 31-ago 16:56", KPIs $313,49M / 92.2% / 98.1%, tabla, proyección "Cuadrado ✓",
  lectura rápida y "+ Agregar persona" intactos.
- Degradación probada con `FALLAR=1 node scripts/servidor-local.mjs`: muestra la copia
  guardada con el aviso "No se pudo conectar con BigQuery…".

## Verificación en producción (31-ago-2026)
- `GET https://adipa-avance-mensual.vercel.app/api/ventas` → 200 con los 7 grupos.
- Página en vivo: badge "Corte 31-ago 17:56", $315,97M · 92,9% meta · 98,9% piso, sin aviso.
- El corte pasó de 16:56 a 17:56 entre dos consultas: se confirma que el ETL corre cada hora
  y que la página toma el dato nuevo sola.
- Env vars del proyecto Vercel: `GCP_SA_KEY_BASE64` (la buena). `GCP_SERVICE_ACCOUNT_JSON`
  quedó con el valor cortado y se puede borrar.

## Pendiente al cambiar de mes
- Agregar el bloque del mes nuevo a `METAS_POR_MES` en `api/ventas.js` (board Monday
  18425092924). Mientras no esté, la página avisa que las metas son de un mes anterior.
