const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs');
const SENSITIVE_KEYS = ['password', 'passphrase', 'key', 'token', 'secret', 'uri', 'psk'];

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '[redacted]' : redact(v);
    }
    return out;
  }
  return value;
}

function fileFor(date) {
  const day = date.toISOString().slice(0, 10);
  return path.join(LOG_DIR, `wifi-secret-${day}.log`);
}

class Logger {
  constructor(scope = 'app') {
    this.scope = scope;
    this.minLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
  }

  child(scope) {
    return new Logger(`${this.scope}:${scope}`);
  }

  write(level, message, meta) {
    if (LEVELS[level] < this.minLevel) return;
    const now = new Date();
    const record = {
      time: now.toISOString(),
      level,
      scope: this.scope,
      message,
    };
    if (meta !== undefined) record.meta = redact(meta);

    const color = COLORS[level] || '';
    const metaText = meta !== undefined ? ' ' + JSON.stringify(record.meta) : '';
    process.stdout.write(`${color}[${record.time}] ${level.toUpperCase().padEnd(5)} ${this.scope}${RESET} ${message}${metaText}\n`);

    try {
      ensureDir();
      fs.appendFileSync(fileFor(now), JSON.stringify(record) + '\n');
    } catch {
      /* logging must never crash the app */
    }
  }

  debug(m, meta) { this.write('debug', m, meta); }
  info(m, meta) { this.write('info', m, meta); }
  warn(m, meta) { this.write('warn', m, meta); }
  error(m, meta) { this.write('error', m, meta); }
}

module.exports = new Logger('wifi-secret');
module.exports.Logger = Logger;
