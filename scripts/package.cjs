'use strict';
const fs = require('node:fs');
const path = require('node:path');
// UXP CCX files use ZIP containers. Store-only ZIP avoids build dependencies.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function packagePanel(root) {
  const panel = path.join(root, 'local', 'panel');
  const entries = ['manifest.json', 'index.html', 'main.js', 'connection.json'];
  if (!entries.every(name => fs.existsSync(path.join(panel, name)))) throw new Error('Run npm run setup before packaging.');
  const blocks = [], directory = [];
  let offset = 0;
  for (const filename of entries) {
    const name = Buffer.from(filename);
    const data = fs.readFileSync(path.join(panel, filename));
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12); // 1980-01-01
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    blocks.push(header, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  const version = JSON.parse(fs.readFileSync(path.join(panel, 'manifest.json'), 'utf8')).version;
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true, mode: 0o700 });
  const output = path.join(dist, `Codex-Premiere-Bridge-${version}.ccx`);
  fs.writeFileSync(output, Buffer.concat([...blocks, central, end]), { mode: 0o600 });
  return output;
}
module.exports = { packagePanel };
if (require.main === module) console.log('Private installer: ' + packagePanel(path.resolve(__dirname, '..')));
