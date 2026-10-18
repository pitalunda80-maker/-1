import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

test('frontend, validation, task lifecycle, and persistence across restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'one-step-test-'));
  let child;
  async function start() {
    child = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '0', DATABASE_PATH: join(directory, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/listening on port (\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    return `http://127.0.0.1:${port}`;
  }
  async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited; } }
  try {
    let base = await start();
    const request = (path, method = 'GET', data) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    assert.equal((await request('/health')).status, 200);
    const homepage = await request('/');
    assert.match(await homepage.text(), /Your next steps/);
    assert.match(homepage.headers.get('content-security-policy'), /default-src 'self'/);
    for (const asset of ['/app.js', '/style.css']) assert.equal((await request(asset)).status, 200);
    assert.equal((await request('/api/tasks', 'POST', { title: ' ' })).status, 400);
    assert.equal((await request('/api/tasks', 'POST', { title: 'x'.repeat(201) })).status, 400);
    const created = await request('/api/tasks', 'POST', { title: '  Launch the demo  ' });
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.title, 'Launch the demo');
    assert.equal((await request(`/api/tasks/${task.id}`, 'PATCH', { completed: 'yes' })).status, 400);
    const updated = await request(`/api/tasks/${task.id}`, 'PATCH', { completed: true });
    assert.equal((await updated.json()).completed, 1);
    await stop();
    base = await start();
    const retained = await (await request('/api/tasks')).json();
    assert.equal(retained.length, 1);
    assert.equal(retained[0].completed, 1);
    assert.equal((await request(`/api/tasks/${task.id}`, 'DELETE')).status, 200);
    assert.deepEqual(await (await request('/api/tasks')).json(), []);
    assert.equal((await request(`/api/tasks/${task.id}`, 'DELETE')).status, 404);
    assert.equal((await request('/missing')).status, 404);
  } finally { await stop(); rmSync(directory, { recursive: true, force: true }); }
});
