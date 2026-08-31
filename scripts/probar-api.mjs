/**
 * Prueba local del handler /api/ventas contra BigQuery real.
 * Requiere gcp-key.json en la raíz (gitignored).
 *   node scripts/probar-api.mjs [YYYY-MM]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const handler = require('../api/ventas.js');

const mes = process.argv[2] || '';
const req = { query: mes ? { mes } : {} };
let salida = null;
const res = {
  setHeader() {},
  status(code) { this._code = code; return this; },
  json(body) { salida = { code: this._code, body }; },
};

await handler(req, res);
const { code, body } = salida;
console.log('HTTP', code);
if (code !== 200) { console.log(body); process.exit(1); }

const clp = n => '$' + new Intl.NumberFormat('es-CL').format(n);
console.table(body.grupos.map(g => ({
  key: g.key, grupo: g.label, actual: clp(g.actual),
  '%meta': (100 * g.actual / g.meta).toFixed(1) + '%',
  '%piso': (100 * g.actual / g.piso).toFixed(1) + '%',
})));
const t = k => body.grupos.reduce((a, g) => a + g[k], 0);
console.log('mes:', body.mes, '·', body.mesLabel, '· corte:', body.corte,
            '· metas desactualizadas:', body.metasDesactualizadas);
console.log('TOTAL', clp(t('actual')),
            '· % Meta', (100 * t('actual') / t('meta')).toFixed(1) + '%',
            '· % Piso', (100 * t('actual') / t('piso')).toFixed(1) + '%');
