import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const allowed = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const entry = allowed[new URL(req.url, 'http://localhost').pathname];
  if (!entry) { res.writeHead(404); res.end('No encontrado'); return; }
  try { const body = await readFile(fileURLToPath(new URL(entry[0], import.meta.url))); res.writeHead(200, { 'Content-Type': entry[1] + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(500); res.end('No se pudo abrir el archivo.'); }
}).listen(port, '127.0.0.1', () => console.log(`Prototipo listo: http://localhost:${port}`));
