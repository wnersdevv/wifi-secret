const logger = require('../utils/logger').child('audit');
const mongo = require('../database/mongo');
const models = require('../database/models');

async function record({ action, message, actor, source = 'app', level = 'info', meta }) {
  logger.write(level, `${action}${message ? ' - ' + message : ''}`, { actor, source, ...(meta || {}) });
  if (mongo.isConnected()) {
    try {
      await models.Logs.create({ level, scope: 'audit', action, message, actor, source, meta });
    } catch (e) {
      logger.warn('audit persist failed', { error: e.message });
    }
  }
}

async function securityEvent(event) {
  logger.write(event.severity === 'critical' ? 'warn' : 'info', `security:${event.code}`, { ssid: event.ssid });
  if (mongo.isConnected()) {
    try {
      await models.SecurityEvents.create(event);
    } catch (e) {
      logger.warn('security event persist failed', { error: e.message });
    }
  }
}

async function upsertDevice({ mac, ip, hostname, context = 'hotspot' }) {
  if (!mongo.isConnected() || !mac) return;
  try {
    await models.Devices.findOneAndUpdate(
      { mac, context },
      { $set: { ip, hostname, lastSeen: new Date() }, $setOnInsert: { firstSeen: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    logger.warn('device upsert failed', { error: e.message });
  }
}

module.exports = { record, securityEvent, upsertDevice };
