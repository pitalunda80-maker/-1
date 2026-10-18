import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const database = process.env.DATABASE_PATH || join(root, 'data', 'tasks.sqlite');
mkdirSync(dirname(database), { recursive: true });
const db = new DatabaseSync(database);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (Buffer.byteLength(value) > 8192) throw new Error('Request is too large.');
  }
  try { return JSON.parse(value); } catch { throw new Error('Send valid JSON.'); }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') {
      db.prepare('SELECT 1').get();
      return json(res, 200, { status: 'ok' });
    }
    if (path === '/api/tasks' && req.method === 'GET') {
      return json(res, 200, db.prepare('SELECT * FROM tasks ORDER BY id DESC').all());
    }
    if (path === '/api/tasks' && req.method === 'POST') {
      const input = await body(req);
      const title = typeof input?.title === 'string' ? input.title.trim() : '';
      if (!title || title.length > 200) return json(res, 400, { error: 'Enter a task between 1 and 200 characters.' });
      const result = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(title);
      return json(res, 201, db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
    }
    const match = path.match(/^\/api\/tasks\/(\d+)$/);
    if (match && ['PATCH', 'DELETE'].includes(req.method)) {
      const id = Number(match[1]);
      if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(id)) return json(res, 404, { error: 'Task not found.' });
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return json(res, 200, { deleted: true });
      }
      const input = await body(req);
      if (typeof input?.completed !== 'boolean') return json(res, 400, { error: 'completed must be a boolean.' });
      db.prepare('UPDATE tasks SET completed = ? WHERE id = ?').run(Number(input.completed), id);
      return json(res, 200, db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    }
    if (req.method === 'GET' && assets.has(path)) {
      const [file, type] = assets.get(path);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      return res.end(readFileSync(join(root, 'public', file)));
    }
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`One Step listening on port ${server.address().port}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
