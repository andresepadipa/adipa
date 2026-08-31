# Plan 001 — Cómo se implementa

## Arquitectura
Hoy el repo es **estático** (solo `index.html`). Al agregar `api/*.js` + `package.json`,
Vercel lo trata como proyecto Node y compila la función automáticamente. El HTML se
sigue sirviendo tal cual desde la raíz.

```
index.html          ← llama a /api/ventas al cargar y cada 10 min
api/ventas.js       ← serverless: BigQuery → JSON de 7 grupos + corte
package.json        ← dependencia @google-cloud/bigquery
.gitignore          ← node_modules, gcp-key.json, .env*
```

## `/api/ventas`
- **Credencial**: `process.env.GCP_SERVICE_ACCOUNT_JSON` (JSON completo; también acepta
  `GCP_SA_KEY` y variantes en base64, y `gcp-key.json` local para pruebas). Nunca en el repo.
- **Query**: un solo `SELECT` con `CASE` excluyente sobre
  `chile_ventas_produccion.datos_producto_monday_actualizada`, filtrando
  `Pais='Chile'` y `Mes_Venta = DATE_TRUNC(<mes>, MONTH)`.
  El mes por defecto es `CURRENT_DATE('America/Santiago')`; se puede forzar con `?mes=YYYY-MM`.
  - *Gotcha del cliente Node*: pasar el parámetro con `types:{mes:'DATE'}` devuelve **0 filas
    en silencio**. Va como STRING + `PARSE_DATE('%Y-%m-%d', @mes)`.
- **Metas y pisos**: constante `METAS_POR_MES` indexada `YYYY-MM`. Si el mes en curso no está
  cargado, se usa el más reciente y la respuesta trae `metasDesactualizadas:true` para que la
  página lo avise (dato honesto, sin inventar metas).
- **`corte`**: `MAX(FechaActualizacion)` (sello del ETL, idéntico en todas las filas).
- **Caché**: `Cache-Control: s-maxage=300, stale-while-revalidate=600`. La fuente se refresca
  cada hora, así que 5 min de caché de borde es holgado y evita pegarle a BigQuery en cada visita.
- **Errores**: si BigQuery falla, responde 502 con `{error}` y **sin** cabecera de caché
  (nunca se cachea un fallo).

## Contrato
```json
{ "mes":"2026-08", "mesLabel":"Agosto 2026", "corte":"2026-08-31T16:56:24",
  "metasDesactualizadas": false,
  "grupos":[{"key":"ag","label":"Andrea · General","actual":93712902,
             "meta":105610000,"piso":94000000}, ...] }
```

## `index.html` (cambios quirúrgicos)
1. `BASE` pasa de constante a `let BASE = []`, con los valores del 31-ago como
   **respaldo** si la primera carga falla y no hay caché.
2. `cargarVentas()`: `fetch('/api/ventas')` → llena `BASE`, actualiza badge de corte,
   título y `<h1>` con el mes, guarda copia en `localStorage` (`adipa-ventas-cache-v1`)
   y llama a `renderAll()`.
3. **Auto-actualización**: `setInterval` cada 10 min + al volver a la pestaña
   (`visibilitychange`). Solo se reemplaza `actual/meta/piso`; los `extras`, el `reaj`
   y el objetivo del usuario no se tocan.
4. **Degradación**: si el fetch falla, se usa el último valor cacheado y se muestra una
   franja de aviso con la hora de esa copia.
5. Nada más se modifica: mismas funciones, mismos ids, misma clave `adipa-agosto-v2`.

## Verificación
1. Local: `node scripts/probar-api.mjs` (invoca el handler con `gcp-key.json`) — los 7 montos
   deben coincidir con la validación de la spec.
2. Producción: `curl https://adipa-avance-mensual.vercel.app/api/ventas` y revisar la página.
3. Requiere que Andrea cargue la env var `GCP_SERVICE_ACCOUNT_JSON` en Vercel **antes** del deploy.
