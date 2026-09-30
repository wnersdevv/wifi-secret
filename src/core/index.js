const wifi = require('./wifi');
const scanner = require('./scanner');
const security = require('./security');
const hotspot = require('./hotspot');
const backup = require('../services/backup');
const password = require('../services/password');
const qr = require('../services/qr');
const geo = require('../services/geo');
const audit = require('../services/audit');
const runtime = require('../database/croxy');

async function status() {
  return wifi.summary();
}

async function networks() {
  return wifi.scanNetworks();
}

async function scan() {
  const result = await scanner.analyze();
  runtime.set('scan.last', { at: Date.now(), count: result.networkCount });
  return result;
}

async function securityScan(actor = 'system') {
  const result = await security.scanOwnNetwork();
  for (const f of result.findings) {
    if (f.severity === 'critical' || f.severity === 'weak') {
      await audit.securityEvent({ code: f.code, severity: f.severity, ssid: result.connection?.ssid, message: f.message });
    }
  }
  await audit.record({ action: 'security.scan', actor, meta: { score: result.score, rating: result.rating } });
  return result;
}

const hotspotOps = {
  async status() {
    return hotspot.status();
  },
  async configure(opts, actor = 'app') {
    const res = await hotspot.configure(opts);
    await audit.record({ action: 'hotspot.configure', actor, meta: { ssid: opts.ssid } });
    return res;
  },
  async start(actor = 'app') {
    const res = await hotspot.start();
    await audit.record({ action: 'hotspot.start', actor, source: actor === 'app' ? 'app' : 'discord' });
    return res;
  },
  async stop(actor = 'app') {
    const res = await hotspot.stop();
    await audit.record({ action: 'hotspot.stop', actor, source: actor === 'app' ? 'app' : 'discord' });
    return res;
  },
  async restart(actor = 'app') {
    const res = await hotspot.restart();
    await audit.record({ action: 'hotspot.restart', actor, source: actor === 'app' ? 'app' : 'discord' });
    return res;
  },
  async devices() {
    const res = await hotspot.connectedDevices();
    for (const c of res.clients) await audit.upsertDevice({ mac: c.mac, ip: c.ip, context: 'hotspot' });
    return res;
  },
};

const backupOps = {
  listProfiles: () => backup.listProfiles(),
  profileInfo: (name, withKey) => backup.profileInfo(name, withKey),
  async create(opts, actor = 'app') {
    const res = await backup.createBackup(opts);
    await audit.record({ action: 'backup.create', actor, meta: { file: res.fileName, count: res.profileCount } });
    return res;
  },
  verify: (file, pass) => backup.verifyBackup(file, pass),
  async restore(file, pass, actor = 'app') {
    const res = await backup.restoreBackup(file, pass);
    await audit.record({ action: 'backup.restore', actor, source: actor === 'app' ? 'app' : 'discord', meta: { count: res.restored.length } });
    return res;
  },
  async deleteProfile(name, actor = 'app') {
    const res = await backup.deleteProfile(name);
    await audit.record({ action: 'profile.delete', actor, meta: { name } });
    return res;
  },
  list: () => backup.listBackups(),
};

module.exports = {
  status,
  networks,
  scan,
  securityScan,
  hotspot: hotspotOps,
  backup: backupOps,
  password,
  qr,
  geo,
  adapters: () => wifi.listAdapters(),
};
