'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'local', 'connection.json'), 'utf8'));
  const panel = JSON.parse(fs.readFileSync(path.join(root, 'local', 'panel', 'connection.json'), 'utf8'));
  if (config.port !== panel.port || config.token !== panel.token) throw new Error('Panel/server configuration differs. Rerun setup and reinstall/reload the panel.');
  const response = await fetch('http://127.0.0.1:' + config.port + '/health', {
    headers: { Authorization: 'Bearer ' + config.token }, signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ': check that Codex is using this copy and token.');
  const state = await response.json();
  console.log(JSON.stringify(state, null, 2));
  if (!state.connected) { console.error('Server reachable; open the installed bridge panel in Premiere.'); process.exitCode = 1; }
}
main().catch(error => { console.error('Bridge check failed: ' + error.message + '\nRun setup, configure/restart Codex, and open the Premiere panel.'); process.exitCode = 1; });
