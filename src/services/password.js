const crypto = require('crypto');

const SETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnpqrstuvwxyz',
  digits: '23456789',
  special: '!@#$%^&*-_=+?',
};

function pick(charset) {
  return charset[crypto.randomInt(0, charset.length)];
}

function generate(options = {}) {
  const {
    length = 16,
    upper = true,
    lower = true,
    digits = true,
    special = true,
  } = options;

  const pools = [];
  if (upper) pools.push(SETS.upper);
  if (lower) pools.push(SETS.lower);
  if (digits) pools.push(SETS.digits);
  if (special) pools.push(SETS.special);
  if (!pools.length) throw new Error('At least one character set must be enabled.');

  const len = Math.max(8, Math.min(63, length));
  const all = pools.join('');
  const chars = pools.map((p) => pick(p));
  while (chars.length < len) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const password = chars.join('');
  return { password, length: len, strength: estimateStrength(password, all.length) };
}

function estimateStrength(password, poolSize) {
  const entropy = Math.round(password.length * Math.log2(poolSize || 1));
  let label = 'weak';
  if (entropy >= 128) label = 'excellent';
  else if (entropy >= 90) label = 'strong';
  else if (entropy >= 60) label = 'good';
  else if (entropy >= 40) label = 'fair';
  return { bits: entropy, label };
}

module.exports = { generate, estimateStrength };
