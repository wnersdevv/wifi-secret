const config = require('../utils/config');
const mongo = require('../database/mongo');
const models = require('../database/models');

const ROLE_RANK = { owner: 3, admin: 2, user: 1 };

async function resolveRole(discordId) {
  const cfg = config.discord();
  if (cfg.owners.includes(discordId)) return 'owner';
  if (cfg.admins.includes(discordId)) return 'admin';

  if (mongo.isConnected()) {
    try {
      const record = await models.DiscordUsers.findOne({ discordId }).lean();
      if (record && record.role) return record.role;
    } catch { /* fall through */ }
  }
  return 'user';
}

function meetsRequirement(role, requiredRole) {
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[requiredRole] || 0);
}

async function can(discordId, requiredRole = 'user', command = null) {
  const role = await resolveRole(discordId);
  if (!meetsRequirement(role, requiredRole)) return { allowed: false, role, reason: `Requires ${requiredRole} role.` };

  if (command && mongo.isConnected()) {
    try {
      const override = await models.Permissions.findOne({ role, command }).lean();
      if (override && override.allowed === false) return { allowed: false, role, reason: 'Command disabled for your role.' };
    } catch { /* ignore */ }
  }
  return { allowed: true, role };
}

async function touchUser(discordId, tag) {
  if (!mongo.isConnected()) return;
  try {
    await models.DiscordUsers.findOneAndUpdate(
      { discordId },
      { $set: { tag, lastCommandAt: new Date() } },
      { upsert: true }
    );
  } catch { /* ignore */ }
}

module.exports = { resolveRole, can, meetsRequirement, touchUser, ROLE_RANK };
