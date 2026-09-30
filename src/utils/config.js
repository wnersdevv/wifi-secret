const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '..', '..', 'config');
const cache = new Map();

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(CONFIG_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Config file missing: config/${name}.json`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache.set(name, data);
  return data;
}

function save(name, data) {
  const file = path.join(CONFIG_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  cache.set(name, data);
}

module.exports = {
  app: () => load('config'),
  database: () => load('database'),
  discord: () => load('discord'),
  load,
  save,
};
