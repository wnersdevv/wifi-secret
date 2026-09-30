const logger = require('./src/utils/logger');
const mongo = require('./src/database/mongo');
const { isWindows } = require('./src/utils/win');

const BANNER = `
  WiFi Secret  ·  #powerbywnersdev
  Windows Wi-Fi management, analysis, hotspot, backup & Discord control
`;

async function runCli(args) {
  const core = require('./src/core');
  const [cmd, ...rest] = args;
  const out = (v) => console.log(JSON.stringify(v, null, 2));
  try {
    switch (cmd) {
      case 'status': return out(await core.status());
      case 'networks': return out(await core.networks());
      case 'scan': return out(await core.scan());
      case 'security': return out(await core.securityScan('cli'));
      case 'adapters': return out(await core.adapters());
      case 'hotspot': {
        const action = rest[0] || 'status';
        if (action === 'status') return out(await core.hotspot.status());
        if (action === 'devices') return out(await core.hotspot.devices());
        if (['start', 'stop', 'restart'].includes(action)) return out(await core.hotspot[action]('cli'));
        return console.log('Usage: hotspot <status|start|stop|restart|devices>');
      }
      case 'profiles': return out(await core.backup.listProfiles());
      case 'password': return out(core.password.generate({ length: parseInt(rest[0], 10) || 16 }));
      case 'ip': return out(await core.geo.lookup(rest[0]));
      default:
        console.log('Commands: status | networks | scan | security | adapters | hotspot <action> | profiles | password [len] | ip <addr>');
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exitCode = 1;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  console.log(BANNER);

  if (!isWindows()) {
    logger.warn('Not running on Windows. Wi-Fi, hotspot and DPAPI features require Windows 10/11. Non-Windows features (password, QR, config) still work.');
  }

  if (argv[0] === 'cli') return runCli(argv.slice(1));

  const wantBot = argv.includes('--bot') || argv.length === 0;
  const wantUi = argv.includes('--ui') || argv.length === 0;

  await mongo.connect();

  const started = [];

  if (wantUi) {
    try {
      const api = require('./src/server/api');
      const port = parseInt(process.env.WIFI_SECRET_PORT, 10) || 4790;
      await api.start(port);
      started.push(`dashboard http://127.0.0.1:${port}`);
    } catch (e) {
      logger.error('dashboard failed to start', { error: e.message });
    }
  }

  if (wantBot) {
    try {
      const bot = require('./src/discord/bot');
      const client = await bot.start();
      if (client) started.push('discord bot');
    } catch (e) {
      logger.error('discord bot failed to start', { error: e.message });
    }
  }

  logger.info(`WiFi Secret running: ${started.join(', ') || 'no services (check credentials/config)'}`);

  const shutdown = async () => {
    logger.info('Shutting down…');
    try { await require('./src/discord/bot').stop(); } catch { /* ignore */ }
    await mongo.disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  logger.error('fatal', { error: e.message });
  process.exit(1);
});
