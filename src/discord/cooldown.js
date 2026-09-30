const runtime = require('../database/croxy');
const config = require('../utils/config');

function check(discordId, command) {
  const seconds = config.discord().cooldownSeconds || 0;
  if (!seconds) return { limited: false };
  const key = `cooldown.${discordId}.${command}`;
  const now = Date.now();
  const last = runtime.get(key) || 0;
  const elapsed = (now - last) / 1000;
  if (elapsed < seconds) {
    return { limited: true, remaining: Math.ceil(seconds - elapsed) };
  }
  runtime.set(key, now);
  return { limited: false };
}

module.exports = { check };
