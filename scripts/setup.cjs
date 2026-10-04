'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { packagePanel } = require('./package.cjs');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let port;
let rotate = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rotate-token') rotate = true;
  else if (args[i] === '--port' && i + 1 < args.length) port = Number(args[++i]);
  else throw new Error('Usage: npm run setup -- [--port 32126] [--rotate-token]');
}
if (port !== undefined && (!Number.isInteger(port) || port < 1024 || port > 65535)) throw new Error('Port must be an integer from 1024 to 65535.');
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer.');
const local = path.join(root, 'local');
fs.mkdirSync(local, { recursive: true, mode: 0o700 });
const configPath = path.join(local, 'connection.json');
let previous;
if (fs.existsSync(configPath)) {
  previous = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(previous.token) || !Number.isInteger(previous.port) || previous.port < 1024 || previous.port > 65535) throw new Error('Invalid existing config. Preserve it for investigation; move local/ aside and rerun setup.');
}
const config = { port: port ?? previous?.port ?? 32126, token: !rotate && previous ? previous.token : randomBytes(32).toString('hex') };
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
writeJson(configPath, config);
const panel = path.join(local, 'panel');
fs.mkdirSync(panel, { recursive: true, mode: 0o700 });
for (const name of ['main.js', 'index.html']) fs.copyFileSync(path.join(root, 'panel', name), path.join(panel, name));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'panel', 'manifest.json'), 'utf8'));
manifest.requiredPermissions.network.domains = ['http://localhost', 'http://localhost:' + config.port];
writeJson(path.join(panel, 'manifest.json'), manifest);
writeJson(path.join(panel, 'connection.json'), config);
// JSON quoted strings with forward slashes are valid TOML basic strings.
const quote = value => JSON.stringify(value.replace(/\\/g, '/'));
fs.writeFileSync(path.join(local, 'codex-config.toml'),
  '[mcp_servers.premiere]\ncommand = ' + quote(process.execPath) + '\nargs = [' + quote(path.join(root, 'server.cjs')) + ']\nstartup_timeout_sec = 10\ntool_timeout_sec = 60\n');
packagePanel(root);
console.log('Setup complete. Port: ' + config.port);
console.log('Install the private .ccx from dist/, or load local/panel/manifest.json in UXP Developer Tool.');
console.log('Merge local/codex-config.toml into your Codex config, then restart Codex.');
console.log('Keep local/ and dist/ private: they contain your connection token.');
if (rotate || (previous && previous.port !== config.port)) console.log('Connection changed: reinstall/reload the panel and restart Codex.');
