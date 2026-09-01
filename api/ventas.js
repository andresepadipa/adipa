/**
 * GET /api/ventas
 *
 * Devuelve los 7 grupos comerciales del mes en curso (Chile) con su venta real,
 * leída de BigQuery, más la hora del corte del dato.
 *
 * Ver specs/001-ventas-bigquery/ para la definición de cada grupo y la validación.
 *
 * Query params:
 *   ?mes=YYYY-MM   fuerza un mes distinto al actual (para revisar meses cerrados).
 */

const { BigQuery } = require('@google-cloud/bigquery');

const PROJECT_ID = 'adipa-cl-331013';
const TABLA = `${PROJECT_ID}.chile_ventas_produccion.datos_producto_monday_actualizada`;

/** Etiquetas y orden de los grupos, tal como se ven en el dashboard. */
const GRUPOS = [
  ['ag', 'Andrea · General'],
  ['aa', 'Andrea · Asincrónicos'],
  ['si', 'Siria'],
  ['cl', 'Claudia'],
  ['es', 'Ada · Especializaciones'],
  ['cu', 'Ada · Cursos'],
  ['se', 'Ada · Sesiones magistrales'],
];

/**
 * Metas y pisos por mes (board Monday 18425092924 "Metas semanales", item "Total"
 * de cada grupo: meta = numeric_mktkm0m9, piso = numeric_mktk2gvz).
 * Al empezar un mes nuevo hay que agregar su bloque acá; mientras no esté, la función
 * usa el mes más reciente y marca `metasDesactualizadas` para que la página avise.
 */
const METAS_POR_MES = {
  '2026-08': {
    ag: { meta: 105610000, piso: 94000000 },
    aa: { meta: 36305000, piso: 33000000 },
    si: { meta: 102305000, piso: 102305000 },
    cl: { meta: 31322500, piso: 29500000 },
    es: { meta: 31305000, piso: 29000000 },
    cu: { meta: 28152500, piso: 29000000 },
    se: { meta: 5000000, piso: 2800000 },
  },
};

/**
 * Mes que muestra el dashboard.
 *
 *   null       → sigue el mes en curso (hora de Santiago).
 *   'YYYY-MM'  → lo fija en ese mes, pase lo que pase con la fecha.
 *
 * Andrea pidió mantener la vista en AGOSTO 2026 hasta tener las metas de septiembre.
 * Para pasar a septiembre: cargar su bloque en METAS_POR_MES y poner esto en null.
 */
const MES_FIJO = '2026-08';

/**
 * Ajustes manuales por mes.
 *
 * Son ventas reales que el BI ya muestra pero que todavía no llegan a la tabla de BigQuery
 * que leemos. Se suman al grupo indicado y la página lo declara en pantalla: el total nunca
 * incluye un monto a mano sin decirlo.
 *
 * `productoId` es la salvaguarda: si la tabla EMPIEZA a traer ventas de ese producto, el
 * ajuste se desactiva solo para no contar la venta dos veces.
 */
const AJUSTES_POR_MES = {
  '2026-08': [
    {
      key: 'es',
      monto: 584100,
      productoId: 1097431,
      motivo:
        'Preventa de la Especialización de Salud Mental en APS. El producto lanza el 27-nov, ' +
        'así que la tabla de ventas todavía no le asocia montos; el BI sí los ve.',
    },
  ],
};

/**
 * Clasificación EXCLUYENTE: el orden del CASE importa (una fila cae en un solo grupo).
 * No se usa `Modalidad` — en esta tabla no existe; los asincrónicos de Andrea son el
 * producto sintético "Cursos Asincronicos - Chile" (SKU ASINCRONICOSCL).
 */
const SQL = `
-- Paso 1: una fila por producto y MONTO distinto.
-- La tabla repite el mismo producto en varias versiones. Cuando el monto se repite es la
-- MISMA venta duplicada (ej. Sesión Magistral de Irvin Yalom, v1 y v2 con $195.960 cada una)
-- y hay que contarla una vez; cuando los montos diferen son versiones con ventas propias
-- (ej. Acreditación ADOS de Siria) y sí se suman. Agrupar por monto resuelve los dos casos.
WITH filas AS (
  SELECT Product_id, Seller_name, Categoria_Producto, SKU, Venta,
         MAX(FechaActualizacion) AS FechaActualizacion
  FROM \`${TABLA}\`
  WHERE Pais = 'Chile'
    AND Mes_Venta = DATE_TRUNC(
          COALESCE(PARSE_DATE('%Y-%m-%d', @mes), CURRENT_DATE('America/Santiago')), MONTH)
    AND IFNULL(Categoria_Producto, '') != 'Batería Evalúa'
  GROUP BY Product_id, Seller_name, Categoria_Producto, SKU, Venta
),
base AS (
  SELECT
    CASE
      WHEN Categoria_Producto = 'Especialización'                                  THEN 'es'
      WHEN SKU LIKE 'ASINCRONICOS%'                                                THEN 'aa'
      WHEN Seller_name = 'Andrea Sepúlveda'                                        THEN 'ag'
      WHEN Seller_name = 'Siria Hidd'                                              THEN 'si'
      WHEN Seller_name = 'Claudia Cárdenas'                                        THEN 'cl'
      WHEN Seller_name = 'Ada Mendez' AND Categoria_Producto = 'Sesión Magistral'  THEN 'se'
      WHEN Seller_name = 'Ada Mendez'
       AND Categoria_Producto IN ('Curso Sincrónico','Curso Asincrónico')          THEN 'cu'
      ELSE 'otros'
    END AS grupo,
    Venta,
    FechaActualizacion
  FROM filas
)
SELECT grupo,
       CAST(ROUND(SUM(Venta)) AS INT64) AS actual,
       COUNT(*) AS filas,
       FORMAT_DATETIME('%Y-%m-%dT%H:%M:%S', MAX(FechaActualizacion)) AS corte
FROM base
GROUP BY grupo

UNION ALL

-- Salvaguarda: cuánto trae la tabla para los productos que tienen ajuste manual.
-- Si deja de ser 0, el ajuste se descarta en el handler.
SELECT CONCAT('producto:', CAST(CAST(Product_id AS INT64) AS STRING)),
       CAST(ROUND(SUM(IFNULL(Venta, 0))) AS INT64),
       COUNT(*),
       NULL
FROM filas
WHERE CAST(Product_id AS INT64) IN UNNEST(@productosAjustados)
GROUP BY 1
`;

/**
 * Lee la credencial de la service account desde el entorno (o del archivo local en dev).
 *
 * Prueba todas las variables posibles y se queda con la PRIMERA que parsee bien: si alguien
 * pega el JSON cortado en el panel de Vercel, se salta esa y sigue con la siguiente en vez
 * de caerse. Acepta el JSON tal cual o en base64 (una sola linea, a prueba de pegados).
 */
function credenciales() {
  const CANDIDATAS = [
    'GCP_SERVICE_ACCOUNT_JSON',
    'GCP_SA_KEY',
    'GCP_SERVICE_ACCOUNT_JSON_BASE64',
    'GCP_SA_KEY_BASE64',
  ];
  const problemas = [];

  for (const nombre of CANDIDATAS) {
    const bruto = process.env[nombre];
    if (!bruto || !bruto.trim()) continue;
    try {
      const texto = bruto.trim().startsWith('{')
        ? bruto
        : Buffer.from(bruto, 'base64').toString('utf8');
      const llave = JSON.parse(texto);
      if (!llave.client_email || !llave.private_key) {
        throw new Error('le faltan client_email o private_key');
      }
      return {
        projectId: llave.project_id || PROJECT_ID,
        credentials: { client_email: llave.client_email, private_key: llave.private_key },
      };
    } catch (e) {
      problemas.push(nombre + ': ' + e.message);
    }
  }

  // Las tres variables por separado (los saltos de linea pueden venir escapados).
  if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) {
    return {
      projectId: process.env.GCP_PROJECT_ID || PROJECT_ID,
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    };
  }

  // Desarrollo local: llave en la raiz del repo (esta en .gitignore).
  const fs = require('fs');
  const path = require('path');
  const archivo = path.join(process.cwd(), 'gcp-key.json');
  if (fs.existsSync(archivo)) {
    return { projectId: PROJECT_ID, keyFilename: archivo };
  }

  throw new Error(
    problemas.length
      ? 'La credencial de BigQuery esta mal cargada -> ' + problemas.join(' | ')
      : 'Falta la credencial de BigQuery: define GCP_SERVICE_ACCOUNT_JSON (o GCP_SA_KEY_BASE64).'
  );
}

let _bq = null;
function bq() {
  if (!_bq) _bq = new BigQuery(credenciales());
  return _bq;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** "2026-08" -> "Agosto 2026" */
function etiquetaMes(mes) {
  const [anio, num] = mes.split('-');
  return `${MESES[Number(num) - 1]} ${anio}`;
}

/** Mes en curso en hora de Santiago, como "YYYY-MM". */
function mesActual() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const anio = partes.find((p) => p.type === 'year').value;
  const num = partes.find((p) => p.type === 'month').value;
  return `${anio}-${num}`;
}

module.exports = async function handler(req, res) {
  try {
    const pedido = typeof req.query?.mes === 'string' ? req.query.mes.trim() : '';
    const mes = /^\d{4}-\d{2}$/.test(pedido) ? pedido : (MES_FIJO || mesActual());

    const ajustes = AJUSTES_POR_MES[mes] || [];

    const [filas] = await bq().query({
      query: SQL,
      params: {
        mes: `${mes}-01`,
        productosAjustados: ajustes.map((a) => a.productoId),
      },
      types: { mes: 'STRING', productosAjustados: ['INT64'] }, // OJO: con tipo DATE el mes no calza y devuelve 0 filas.
    });

    const porGrupo = Object.fromEntries(filas.map((f) => [f.grupo, f]));

    // Si el mes en curso todavía no tiene metas cargadas, se usan las del mes más
    // reciente disponible y se avisa (nunca inventar una meta).
    const mesesConMeta = Object.keys(METAS_POR_MES).sort();
    const mesMetas = METAS_POR_MES[mes] ? mes : mesesConMeta[mesesConMeta.length - 1];
    const metas = METAS_POR_MES[mesMetas];

    const grupos = GRUPOS.map(([key, label]) => ({
      key,
      label,
      actual: Number(porGrupo[key]?.actual ?? 0),
      meta: metas[key].meta,
      piso: metas[key].piso,
    }));

    // Ajustes manuales: se suman al grupo, salvo que la tabla ya traiga ventas de ese
    // producto (ahí el dato real manda y el ajuste se descarta para no duplicar).
    const ajustesAplicados = [];
    for (const a of ajustes) {
      const yaEnDatos = Number(porGrupo[`producto:${a.productoId}`]?.actual ?? 0);
      if (yaEnDatos > 0) continue;
      const grupo = grupos.find((g) => g.key === a.key);
      if (!grupo) continue;
      grupo.actual += a.monto;
      ajustesAplicados.push({ key: a.key, label: grupo.label, monto: a.monto, motivo: a.motivo });
    }

    const corte = filas.map((f) => f.corte).filter(Boolean).sort().pop() || null;

    // 60 s de caché de borde: suficiente para no consultar BigQuery en cada visita y
    // lo bastante corto para que nadie vea un dato viejo.
    // SIN stale-while-revalidate a propósito: con SWR, Vercel entregaba la copia vencida
    // y recién después buscaba la nueva, así que se llegaban a servir cortes de hace una hora.
    res.setHeader('Cache-Control', 's-maxage=60');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      mes,
      mesLabel: etiquetaMes(mes),
      corte,
      metasDesactualizadas: mesMetas !== mes,
      mesMetas,
      ajustes: ajustesAplicados,
      grupos,
    });
  } catch (e) {
    // Nunca cachear un fallo.
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'No se pudo leer BigQuery', detalle: String(e.message || e) });
  }
};
