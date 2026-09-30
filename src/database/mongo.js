const mongoose = require('mongoose');
const config = require('../utils/config');
const { getCredential } = require('../utils/credentials');
const logger = require('../utils/logger').child('mongo');

let connected = false;

async function connect() {
  const cfg = config.database().mongo;
  if (!cfg.enabled) {
    logger.warn('MongoDB disabled in config; persistent storage unavailable.');
    return false;
  }
  const uri = await getCredential(cfg.credentialKey);
  if (!uri) {
    logger.warn(`No MongoDB URI stored under credential "${cfg.credentialKey}". Run: npm run set-credential ${cfg.credentialKey}`);
    return false;
  }

  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      dbName: cfg.dbName,
      serverSelectionTimeoutMS: cfg.serverSelectionTimeoutMS || 8000,
    });
    connected = true;
    logger.info('MongoDB connected', { db: cfg.dbName });
    mongoose.connection.on('error', (e) => logger.error('MongoDB error', { error: e.message }));
    mongoose.connection.on('disconnected', () => {
      connected = false;
      logger.warn('MongoDB disconnected');
    });
    return true;
  } catch (e) {
    logger.error('MongoDB connection failed', { error: e.message });
    return false;
  }
}

function isConnected() {
  return connected && mongoose.connection.readyState === 1;
}

async function disconnect() {
  if (connected) await mongoose.disconnect();
  connected = false;
}

module.exports = { connect, disconnect, isConnected, mongoose };
