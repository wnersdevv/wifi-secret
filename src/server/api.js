const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('../core');
const logger = require('../utils/logger').child('server');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(req, res) {
  let rel = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) return send(res, 404, { error: 'Not found' });
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const routes = {
  'GET /api/status': () => core.status(),
  'GET /api/networks': () => core.networks(),
  'GET /api/scan': () => core.scan(),
  'GET /api/security': () => core.securityScan('dashboard'),
  'GET /api/adapters': () => core.adapters(),
  'GET /api/hotspot': () => core.hotspot.status(),
  'GET /api/hotspot/devices': () => core.hotspot.devices(),
  'GET /api/backup/profiles': () => core.backup.listProfiles(),
  'GET /api/backup/list': () => core.backup.list(),
  'POST /api/hotspot/start': () => core.hotspot.start('dashboard'),
  'POST /api/hotspot/stop': () => core.hotspot.stop('dashboard'),
  'POST /api/hotspot/restart': () => core.hotspot.restart('dashboard'),
  'POST /api/hotspot/configure': (b) => core.hotspot.configure({ ssid: b.ssid, passphrase: b.passphrase }, 'dashboard'),
  'POST /api/password': (b) => core.password.generate(b),
  'POST /api/qr': (b) => core.qr.toDataUrl(b),
  'POST /api/ip': (b) => core.geo.lookup(b.address),
  'POST /api/backup/create': (b) => core.backup.create({ password: b.password, label: b.label }, 'dashboard'),
  'POST /api/backup/verify': (b) => core.backup.verify(b.file, b.password),
  'POST /api/backup/restore': (b) => core.backup.restore(b.file, b.password, 'dashboard'),
  'POST /api/profile/delete': (b) => core.backup.deleteProfile(b.name, 'dashboard'),
};

function createServer() {
  return http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/')) return serveStatic(req, res);

    const key = `${req.method} ${url}`;
    const handler = routes[key];
    if (!handler) return send(res, 404, { error: `No route ${key}` });

    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const result = await handler(body);
      send(res, 200, { ok: true, data: result });
    } catch (e) {
      logger.error('api error', { key, error: e.message });
      send(res, 500, { ok: false, error: e.message });
    }
  });
}

function start(port = 4790) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      logger.info(`Dashboard on http://127.0.0.1:${port} (loopback only)`);
      resolve(server);
    });
  });
}

module.exports = { start, createServer };
