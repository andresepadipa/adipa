/** Servidor local para probar la pagina completa (estatico + /api/ventas). */
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const handler = require('../api/ventas.js');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/ventas') {
    if (process.env.FALLAR) { res.statusCode = 502; res.end('{"error":"simulado"}'); return; }
    const fake = { query: Object.fromEntries(url.searchParams) };
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return this; },
      json(b) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(b)); },
    };
    await handler(fake, shim);
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(new URL('../index.html', import.meta.url)));
}).listen(4321, () => console.log('http://localhost:4321'));
