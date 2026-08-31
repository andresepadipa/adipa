# Spec 001 — El dashboard se actualiza solo desde BigQuery

## Problema
Los 7 montos del dashboard están **quemados** en `index.html` (el arreglo `BASE`).
Cada vez que cambian las ventas hay que editar el HTML a mano y volver a publicar.

## Qué
Que la página lea los montos reales de BigQuery al abrirse y se mantenga al día sola.
La fuente se refresca cada hora (ETL de Monday → BigQuery), así que la página debe
reflejar ese ritmo sin intervención.

1. Una función serverless `/api/ventas` consulta BigQuery y devuelve los 7 grupos ya
   calculados (`actual`, `meta`, `piso`) más la hora del corte.
2. `index.html` pide `/api/ventas` al cargar, llena `BASE`, pone el badge de corte y
   renderiza. Se **refresca solo** cada 10 minutos y al volver a la pestaña.
3. Todo lo demás sigue igual: tabla editable, "+ Agregar persona", proyección/reparto
   con aviso de descuadre, "Guardar reparto", toggle Meta/Piso, `localStorage`
   (`adipa-agosto-v2`).

## Los 7 grupos (definición validada contra BigQuery el 31-ago-2026)
Fuente única: `adipa-cl-331013.chile_ventas_produccion.datos_producto_monday_actualizada`.
Filtros globales: `Pais = 'Chile'`, `Mes_Venta` = mes en curso, monto = `Venta` (CLP).

| key | grupo | regla en BigQuery | meta | piso |
|-----|-------|-------------------|-----:|-----:|
| `ag` | Andrea · General | `Seller_name = 'Andrea Sepúlveda'` | 105.610.000 | 94.000.000 |
| `aa` | Andrea · Asincrónicos | `SKU LIKE 'ASINCRONICOS%'` | 36.305.000 | 33.000.000 |
| `si` | Siria | `Seller_name = 'Siria Hidd'` | 102.305.000 | 102.305.000 |
| `cl` | Claudia | `Seller_name = 'Claudia Cárdenas'` | 31.322.500 | 29.500.000 |
| `es` | Ada · Especializaciones | `Categoria_Producto = 'Especialización'` | 31.305.000 | 29.000.000 |
| `cu` | Ada · Cursos | `'Ada Mendez'` + Curso Sincrónico/Asincrónico | 28.152.000 | 29.000.000 |
| `se` | Ada · Sesiones magistrales | `'Ada Mendez'` + `'Sesión Magistral'` | 5.000.000 | 2.800.000 |

La clasificación es **excluyente** (un `CASE` en ese orden): cada fila cae en un solo
grupo. Lo que no calza queda en `otros` y no se muestra (hoy: $1.151 de Alejandra Catalán).

### Hallazgos que cambian el brief original
- **No se usa `Modalidad`.** Esa columna vive en otra tabla. En BigQuery los asincrónicos
  de Andrea son un producto sintético *"Cursos Asincronicos - Chile"* (`SKU ASINCRONICOSCL`)
  atribuido a **Fernanda Cerda**. El "gotcha" de la modalidad vacía no aplica acá.
- **`Batería Evalúa` no existe** como `Categoria_Producto` en esta tabla; el filtro de
  exclusión queda como guarda pero hoy es inocuo.
- **Las metas NO se leen de BigQuery**: `Meta_Mes_Monto` no cuadra con Monday (Siria 89M vs
  102,3M) y `aa`/`es`/`se` no tienen meta. Van hardcodeadas por mes (board Monday 18425092924).

## Validación (Chile, agosto 2026, corte 31-ago 16:56)
ag 93.712.902 · aa 29.915.678 · si 104.156.823 · cl 28.546.037 · es 25.409.426 ·
cu 28.644.821 · se 3.101.494 → **total 313.487.181 · 92,2% meta · 98,1% piso**.
Reproduce los 7 números del brief (delta ≤ $20.831 por deriva del dato entre cortes),
salvo `es`, que va $584.100 abajo porque la Especialización APS de Ada Mendez
(`Product_id 1097431`, creada el 28-ago) todavía está en la tabla con `Venta` en NULL.
**Decisión de Andrea: BigQuery es la fuente de verdad**; el monto aparecerá solo cuando
el ETL lo ingiera.

## Fuera de alcance
- Leer metas desde Monday en vivo (hoy hardcodeadas por mes).
- Países distintos de Chile.
- Persistir el reparto fuera del navegador.
