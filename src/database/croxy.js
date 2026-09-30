const path = require('path');
const fs = require('fs');
const config = require('../utils/config');

const file = path.resolve(__dirname, '..', '..', config.database().croxydb.file);
fs.mkdirSync(path.dirname(file), { recursive: true });

let db;
try {
  db = require('croxydb');
  if (typeof db.setFile === 'function') db.setFile(file);
  else if (typeof db.setFolder === 'function') db.setFolder(path.dirname(file));
} catch {
  db = null;
}

function memFallback() {
  const store = new Map();
  return {
    set: (k, v) => store.set(k, v),
    get: (k) => (store.has(k) ? store.get(k) : null),
    fetch: (k) => (store.has(k) ? store.get(k) : null),
    has: (k) => store.has(k),
    delete: (k) => store.delete(k),
    all: () => [...store.entries()].map(([ID, data]) => ({ ID, data })),
  };
}

const backend = db || memFallback();

module.exports = {
  set(key, value) {
    try { return backend.set(key, value); } catch { return null; }
  },
  get(key) {
    try { return backend.get ? backend.get(key) : backend.fetch(key); } catch { return null; }
  },
  has(key) {
    try { return backend.has ? backend.has(key) : backend.get(key) != null; } catch { return false; }
  },
  delete(key) {
    try { return backend.delete(key); } catch { return false; }
  },
  all() {
    try { return backend.all ? backend.all() : []; } catch { return []; }
  },
  usingFallback: !db,
};
