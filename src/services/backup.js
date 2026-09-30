const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { netsh } = require('../utils/win');
const { parseProfileList } = require('../core/wifi/parse');
const config = require('../utils/config');
const logger = require('../utils/logger').child('backup');

const MAGIC = 'WSB1';
const backupDir = () => path.resolve(__dirname, '..', '..', config.app().backup.directory);

function ensureBackupDir() {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function listProfiles() {
  const out = await netsh(['wlan', 'show', 'profiles']);
  return parseProfileList(out);
}

async function profileInfo(name, includeKey = false) {
  const args = ['wlan', 'show', 'profile', `name=${name}`];
  if (includeKey) args.push('key=clear');
  const out = await netsh(args);
  const info = { name, authentication: null, encryption: null, connectionMode: null, key: null };
  for (const line of out.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key.includes('authentication') || key.includes('kimlik doğrulama') || key.includes('kimlik dogrulama')) info.authentication = value;
    else if (key.includes('cipher') || key.includes('şifre') || key.includes('sifre')) info.encryption = value;
    else if (key.includes('connection mode') || key.includes('bağlantı modu') || key.includes('baglanti modu')) info.connectionMode = value;
    else if ((key.includes('key content') || key.includes('anahtar içeriği') || key.includes('anahtar icerigi')) && includeKey) info.key = value;
  }
  return info;
}

function deriveKey(password, salt) {
  return crypto.scryptSync(Buffer.from(password, 'utf8'), salt, 32, { N: 16384, r: 8, p: 1 });
}

function encryptBundle(bundleObj, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(bundleObj), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    magic: MAGIC,
    createdAt: new Date().toISOString(),
    host: os.hostname(),
    profileCount: bundleObj.profiles.length,
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

function decryptBundle(fileObj, password) {
  if (fileObj.magic !== MAGIC) throw new Error('Not a valid WiFi Secret backup file.');
  const salt = Buffer.from(fileObj.salt, 'base64');
  const iv = Buffer.from(fileObj.iv, 'base64');
  const tag = Buffer.from(fileObj.tag, 'base64');
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    const dec = Buffer.concat([decipher.update(Buffer.from(fileObj.data, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    throw new Error('Decryption failed. Wrong password or corrupted backup.');
  }
}

async function exportProfilesXml(names) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsb-'));
  const profiles = [];
  try {
    for (const name of names) {
      await netsh(['wlan', 'export', 'profile', `name=${name}`, 'key=clear', `folder=${tmp}`]);
    }
    for (const file of fs.readdirSync(tmp)) {
      if (file.toLowerCase().endsWith('.xml')) {
        profiles.push({ file, xml: fs.readFileSync(path.join(tmp, file), 'utf8') });
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return profiles;
}

async function createBackup({ profiles, password, label } = {}) {
  if (!password || password.length < 8) throw new Error('Backup password must be at least 8 characters.');
  const names = profiles && profiles.length ? profiles : await listProfiles();
  if (!names.length) throw new Error('No Wi-Fi profiles found to back up.');

  const exported = await exportProfilesXml(names);
  const bundle = { profiles: exported, label: label || null, source: os.hostname() };
  const encrypted = encryptBundle(bundle, password);

  const dir = ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${(label || 'wifi-profiles').replace(/[^\w-]/g, '_')}-${stamp}.wsb`;
  const target = path.join(dir, fileName);
  fs.writeFileSync(target, JSON.stringify(encrypted, null, 2), { mode: 0o600 });

  logger.info('backup created', { file: fileName, profileCount: encrypted.profileCount });
  return { file: target, fileName, profileCount: encrypted.profileCount, createdAt: encrypted.createdAt };
}

function verifyBackup(filePath, password) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const bundle = decryptBundle(raw, password);
  const valid = Array.isArray(bundle.profiles) && bundle.profiles.length === raw.profileCount;
  return {
    valid,
    profileCount: bundle.profiles.length,
    createdAt: raw.createdAt,
    host: raw.host,
    profiles: bundle.profiles.map((p) => p.file.replace(/\.xml$/i, '')),
  };
}

async function restoreBackup(filePath, password, { userScope = 'all' } = {}) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const bundle = decryptBundle(raw, password);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsr-'));
  const restored = [];
  try {
    for (const profile of bundle.profiles) {
      const xmlPath = path.join(tmp, profile.file);
      fs.writeFileSync(xmlPath, profile.xml, 'utf8');
      await netsh(['wlan', 'add', 'profile', `filename=${xmlPath}`, `user=${userScope}`]);
      restored.push(profile.file.replace(/\.xml$/i, ''));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  logger.info('backup restored', { count: restored.length });
  return { restored };
}

async function deleteProfile(name) {
  await netsh(['wlan', 'delete', 'profile', `name=${name}`]);
  logger.info('profile deleted', { name });
  return { deleted: name };
}

function listBackups() {
  const dir = ensureBackupDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.wsb'))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      let meta = {};
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        meta = { profileCount: raw.profileCount, createdAt: raw.createdAt, host: raw.host };
      } catch { /* ignore unreadable */ }
      return { file: f, path: path.join(dir, f), size: stat.size, ...meta };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

module.exports = {
  listProfiles,
  profileInfo,
  createBackup,
  verifyBackup,
  restoreBackup,
  deleteProfile,
  listBackups,
};
