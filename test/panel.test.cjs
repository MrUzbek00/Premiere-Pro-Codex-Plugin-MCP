'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../panel/main.js'), 'utf8');
function panel(responses) {
  const calls = [], scheduled = [];
  const elements = { status: { textContent: '' }, toggle: { textContent: '', addEventListener(_, handler) { this.click = handler; } } };
  const premiere = { executions: 0 };
  const context = vm.createContext({
    require: name => name === 'premierepro' ? premiere : { port: 32126, token: 'test-only' },
    document: { getElementById: id => elements[id] },
    setTimeout: fn => scheduled.push(fn),
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (!response) throw new Error('Unexpected request');
      if (response instanceof Error) throw response;
      return { ok: (response.status || 200) === 200, status: response.status || 200, json: async () => response.body };
    }
  });
  vm.runInContext(source, context);
  return { calls, scheduled, elements, premiere };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('panel retries a lost result response without executing the script twice', async () => {
  const p = panel([
    { body: { id: 'one', script: 'premierepro.executions++; return 42;' } },
    new Error('Failed to fetch'),
    { body: { ok: true } },
    { body: { idle: true } }
  ]);
  await settle();
  assert.equal(p.premiere.executions, 1);
  await p.scheduled.shift()();
  assert.equal(p.premiere.executions, 1);
  assert.equal(p.calls.length, 4);
  assert.equal(p.calls[1].options.body, p.calls[2].options.body);
  assert.equal(p.elements.status.textContent, 'Connected to Codex');
});
test('unknown result stops panel until user reconnects and never replays an edit', async () => {
  const p = panel([
    { body: { id: 'one', script: 'premierepro.executions++; return 42;' } },
    { status: 409 },
    { body: { idle: true } }
  ]);
  await settle();
  assert.match(p.elements.status.textContent, /Inspect project state/);
  assert.equal(p.elements.toggle.textContent, 'Connect');
  await p.scheduled.shift()();
  assert.equal(p.calls.length, 2);
  p.elements.toggle.click();
  await p.scheduled.shift()();
  assert.equal(p.calls.length, 3);
  assert.equal(p.premiere.executions, 1);
});
test('panel returns script failures as results', async () => {
  const p = panel([
    { body: { id: 'two', script: 'throw new Error("host failure")' } },
    { body: { ok: true } }
  ]);
  await settle();
  assert.match(JSON.parse(p.calls[1].options.body).error, /host failure/);
});
