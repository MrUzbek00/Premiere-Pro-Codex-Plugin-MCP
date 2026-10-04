'use strict';
const premierepro = require('premierepro');
const connection = require('./connection.json');
const endpoint = 'http://localhost:' + connection.port;
let enabled = true;
let pendingResult = null;
const label = document.getElementById('status');
const toggle = document.getElementById('toggle');
toggle.addEventListener('click', () => {
  enabled = !enabled;
  toggle.textContent = enabled ? 'Disconnect' : 'Connect';
  label.textContent = enabled ? 'Connecting…' : 'Disconnected (a running command may still finish).';
});
async function request(path, data) {
  const options = { method: data ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + connection.token } };
  if (data) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(data); }
  const response = await fetch(endpoint + path, options);
  if (!response.ok) {
    const error = new Error('Bridge returned HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
async function poll() {
  try {
    if (enabled || pendingResult) {
      // Retry delivery of the RESULT only, never execution of the script.
      if (pendingResult) { await request('/result', pendingResult); pendingResult = null; }
      if (!enabled) return;
      const job = await request('/poll');
      label.textContent = 'Connected to Codex';
      if (job.id) {
        label.textContent = 'Running command…';
        try {
          const run = new Function('premierepro', 'return (async function () {\n' + job.script + '\n})();');
          const value = await run(premierepro);
          pendingResult = { id: job.id, value: value === undefined ? null : JSON.parse(JSON.stringify(value)) };
        } catch (e) { pendingResult = { id: job.id, error: String(e.stack || e.message || e) }; }
        await request('/result', pendingResult);
        pendingResult = null;
        label.textContent = enabled ? 'Connected to Codex' : 'Disconnected';
      }
    }
  } catch (e) {
    if (e.status === 409 && pendingResult) {
      // Server restarted or forgot this result. Never rerun the script.
      pendingResult = null;
      enabled = false;
      toggle.textContent = 'Connect';
      label.textContent = 'Result could not be recorded. Inspect project state, then reconnect.';
      return;
    }
    label.textContent = /Network request failed|Failed to fetch/i.test(e.message)
      ? 'Open Codex to connect. Reconnecting automatically…'
      : 'Connection unavailable. ' + e.message;
  }
  finally { setTimeout(poll, 750); }
}
poll();
