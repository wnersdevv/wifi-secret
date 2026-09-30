const { mongoose } = require('../mongo');
const { Schema } = mongoose;

const timestamps = { timestamps: true };

const User = new Schema({
  username: { type: String, required: true, unique: true },
  displayName: String,
  role: { type: String, enum: ['owner', 'admin', 'user'], default: 'user' },
  active: { type: Boolean, default: true },
}, timestamps);

const DiscordUser = new Schema({
  discordId: { type: String, required: true, unique: true },
  tag: String,
  role: { type: String, enum: ['owner', 'admin', 'user'], default: 'user' },
  linkedUser: { type: Schema.Types.ObjectId, ref: 'User' },
  verified: { type: Boolean, default: false },
  lastCommandAt: Date,
}, timestamps);

const Permission = new Schema({
  role: { type: String, required: true },
  command: { type: String, required: true },
  allowed: { type: Boolean, default: true },
}, timestamps);
Permission.index({ role: 1, command: 1 }, { unique: true });

const Device = new Schema({
  mac: { type: String, required: true },
  ip: String,
  hostname: String,
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  context: { type: String, enum: ['hotspot', 'lan', 'lab'], default: 'hotspot' },
  bytes: { type: Number, default: 0 },
}, timestamps);
Device.index({ mac: 1, context: 1 }, { unique: true });

const WiFiProfile = new Schema({
  name: { type: String, required: true, unique: true },
  authentication: String,
  encryption: String,
  connectionMode: String,
  hasStoredKey: { type: Boolean, default: false },
  lastBackupAt: Date,
}, timestamps);

const HotspotConfiguration = new Schema({
  label: { type: String, default: 'default' },
  ssid: { type: String, required: true },
  band: String,
  adapter: String,
  autoStart: { type: Boolean, default: false },
  autoStopMinutes: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
}, timestamps);

const Log = new Schema({
  level: String,
  scope: String,
  action: { type: String, required: true },
  message: String,
  actor: String,
  source: { type: String, enum: ['app', 'discord', 'system'], default: 'app' },
  meta: Schema.Types.Mixed,
}, timestamps);
Log.index({ createdAt: -1 });

const SecurityEvent = new Schema({
  code: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'weak', 'critical'], default: 'info' },
  ssid: String,
  message: String,
  meta: Schema.Types.Mixed,
}, timestamps);

const Setting = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
}, timestamps);

const BackupMetadata = new Schema({
  fileName: { type: String, required: true },
  profileCount: Number,
  host: String,
  createdBy: String,
  sizeBytes: Number,
}, timestamps);

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

module.exports = {
  Users: model('User', User),
  DiscordUsers: model('DiscordUser', DiscordUser),
  Permissions: model('Permission', Permission),
  Devices: model('Device', Device),
  WiFiProfiles: model('WiFiProfile', WiFiProfile),
  HotspotConfigurations: model('HotspotConfiguration', HotspotConfiguration),
  Logs: model('Log', Log),
  SecurityEvents: model('SecurityEvent', SecurityEvent),
  Settings: model('Setting', Setting),
  BackupMetadata: model('BackupMetadata', BackupMetadata),
};
