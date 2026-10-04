'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const readline = require('node:readline');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
test('clean checkout setup is portable, repeatable, private, and packaged', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'premiere setup space '));
  try {
    for (const file of ['scripts', 'panel', 'server.cjs']) fs.cpSync(path.join(root, file), path.join(temp, file), { recursive: true });
    const run = (...args) => {
      const r = spawnSync(process.execPath, [path.join(temp, 'scripts', 'setup.cjs'), ...args], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return r.stdout;
    };
    const read = () => JSON.parse(fs.readFileSync(path.join(temp, 'local', 'connection.json'), 'utf8'));
    const stdout = run('--port', '32127');
    const first = read();
    assert.match(first.token, /^[a-f0-9]{64}$/);
    assert.equal(first.port, 32127);
    assert.ok(!stdout.includes(first.token));
    run();
    assert.deepEqual(read(), first);
    run('--rotate-token', '--port', '32128');
    assert.notEqual(read().token, first.token);
    assert.equal(read().port, 32128);
    assert.deepEqual(read(), JSON.parse(fs.readFileSync(path.join(temp, 'local/panel/connection.json'), 'utf8')));
    const manifest = JSON.parse(fs.readFileSync(path.join(temp, 'local/panel/manifest.json'), 'utf8'));
    assert.ok(manifest.requiredPermissions.network.domains.includes('http://localhost:32128'));
    const toml = fs.readFileSync(path.join(temp, 'local/codex-config.toml'), 'utf8');
    assert.ok(toml.includes(temp.replace(/\\/g, '/')));
    assert.ok(!toml.includes(read().token));
    const zip = fs.readFileSync(path.join(temp, 'dist/Codex-Premiere-Bridge-1.1.0.ccx'));
    const names = [];
    let offset = 0;
    while (zip.readUInt32LE(offset) === 0x04034b50) {
      const size = zip.readUInt32LE(offset + 18);
      const nameLength = zip.readUInt16LE(offset + 26);
      const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
      names.push(name);
      const dataStart = offset + 30 + nameLength;
      assert.deepEqual(zip.subarray(dataStart, dataStart + size), fs.readFileSync(path.join(temp, 'local/panel', name)));
      offset = dataStart + size;
    }
    assert.deepEqual(names.sort(), ['connection.json', 'index.html', 'main.js', 'manifest.json']);
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const bad = spawnSync(process.execPath, [path.join(temp, 'scripts/setup.cjs'), '--port', '0']);
    assert.notEqual(bad.status, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test('MCP and authenticated HTTP round trips, errors, recovery, and timeout behavior', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'premiere-bridge-test-'));
  const port = await freePort();
  const token = randomBytes(32).toString('hex');
  const config = path.join(temp, 'connection.json');
  fs.writeFileSync(config, JSON.stringify({ port, token }));
  const child = spawn(process.execPath, [path.join(root, 'server.cjs')], {
    env: { ...process.env, PREMIERE_BRIDGE_CONFIG: config }, stdio: ['pipe', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const pending = new Map();
  const invalid = [];
  let id = 0;
  readline.createInterface({ input: child.stdout }).on('line', line => {
    const message = JSON.parse(line);
    if (message.id === null) invalid.push(message);
    else { pending.get(message.id)?.(message); pending.delete(message.id); }
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('MCP response timeout: ' + stderr)); }, 5000);
    pending.set(requestId, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
  });
  const call = (name, args = {}) => rpc('tools/call', { name, arguments: args });
  const content = message => JSON.parse(message.result.content[0].text);
  const request = (route, body, auth = token) => fetch('http://127.0.0.1:' + port + route, {
    method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(2000)
  });
  t.after(async () => {
    child.stdin.end();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  for (let i = 0; i < 50; i++) {
    try { await request('/health'); break; } catch { await pause(20); }
  }
  await t.test('initialization, discovery, malformed requests and offline state', async () => {
    assert.equal((await rpc('initialize', { protocolVersion: '2025-03-26' })).result.serverInfo.version, '1.1.0');
    assert.equal((await rpc('tools/list')).result.tools.length, 4);
    assert.equal(content(await call('connection_status')).connected, false);
    assert.equal((await call('project_info')).result.isError, true);
    child.stdin.write('null\nnot-json\n');
    await rpc('ping');
    assert.deepEqual(invalid.map(x => x.error.code), [-32600, -32700]);
    assert.equal((await rpc('unknown')).error.code, -32601);
  });
  await t.test('authentication and routes', async () => {
    assert.equal((await request('/poll', null, 'wrong')).status, 403);
    assert.equal((await request('/result', { id: 'x' }, 'wrong')).status, 403);
    assert.equal((await request('/missing')).status, 404);
    assert.equal((await request('/result', { id: 'unknown' })).status, 409);
    await request('/poll');
    assert.equal(content(await call('connection_status')).connected, true);
  });
  await t.test('delivery, busy guard, results and duplicate acknowledgments', async () => {
    const response = call('project_info');
    await rpc('ping');
    const job = await (await request('/poll')).json();
    assert.match(job.script, /getActiveProject/);
    assert.equal((await call('execute_script', { script: 'return 1' })).result.isError, true);
    assert.deepEqual(await (await request('/poll')).json(), { idle: true });
    const body = { id: job.id, value: { project: null } };
    assert.equal((await request('/result', body)).status, 200);
    assert.deepEqual(content(await response).value, { project: null });
    assert.equal((await request('/result', body)).status, 200);
    assert.equal(content(await call('get_result', { command_id: job.id })).state, 'complete');
  });
  await t.test('invalid scripts and host errors', async () => {
    assert.equal((await call('execute_script', { script: '', timeout_seconds: 1 })).result.isError, true);
    assert.equal((await call('execute_script', { script: 'return 1', timeout_seconds: 46 })).result.isError, true);
    const response = call('execute_script', { script: 'throw new Error("example")' });
    await rpc('ping');
    const job = await (await request('/poll')).json();
    await request('/result', { id: job.id, error: 'example' });
    assert.equal((await response).result.isError, true);
  });
  await t.test('timeout before delivery cancels without replay', async () => {
    await request('/poll');
    const response = await call('execute_script', { script: 'return 1', timeout_seconds: 1 });
    const value = content(response);
    assert.equal(content(await call('get_result', { command_id: value.commandId })).state, 'cancelled');
    assert.deepEqual(await (await request('/poll')).json(), { idle: true });
  });
  await t.test('timeout after delivery blocks edits and accepts a late result', async () => {
    const response = call('execute_script', { script: 'return 2', timeout_seconds: 1 });
    await rpc('ping');
    const job = await (await request('/poll')).json();
    assert.equal((await response).result.isError, true);
    assert.equal(content(await call('get_result', { command_id: job.id })).state, 'unknown');
    assert.equal((await call('execute_script', { script: 'return 3' })).result.isError, true);
    await request('/result', { id: job.id, value: 2 });
    assert.equal(content(await call('get_result', { command_id: job.id })).state, 'complete');
    assert.equal(content(await call('connection_status')).busy, false);
  });
});
