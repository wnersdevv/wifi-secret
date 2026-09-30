const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/utils/config');
const { getCredential } = require('../src/utils/credentials');

function build() {
  const cmd = new SlashCommandBuilder().setName('wifi').setDescription('WiFi Secret control');

  cmd.addSubcommand((s) => s.setName('status').setDescription('Current Wi-Fi connection'));
  cmd.addSubcommand((s) => s.setName('networks').setDescription('List nearby networks'));
  cmd.addSubcommand((s) => s.setName('scan').setDescription('Channel congestion scan'));
  cmd.addSubcommand((s) => s.setName('security').setDescription('Security scan of your network'));
  cmd.addSubcommand((s) => s.setName('devices').setDescription('Devices connected to the hotspot'));
  cmd.addSubcommand((s) => s.setName('logs').setDescription('Recent activity'));
  cmd.addSubcommand((s) => s.setName('backup').setDescription('List Wi-Fi profiles and backups'));
  cmd.addSubcommand((s) => s.setName('restore').setDescription('Restore Wi-Fi profiles from a backup'));

  cmd.addSubcommand((s) =>
    s.setName('qr').setDescription('Generate a Wi-Fi QR code')
      .addStringOption((o) => o.setName('ssid').setDescription('Network name').setRequired(true))
      .addStringOption((o) => o.setName('password').setDescription('Network password'))
      .addStringOption((o) => o.setName('security').setDescription('WPA / WEP / Open')));

  cmd.addSubcommand((s) =>
    s.setName('password').setDescription('Generate a strong password')
      .addStringOption((o) => o.setName('length').setDescription('Length (8-63)')));

  cmd.addSubcommand((s) =>
    s.setName('ip').setDescription('Approximate IP geolocation')
      .addStringOption((o) => o.setName('address').setDescription('IPv4 or IPv6 address').setRequired(true)));

  cmd.addSubcommandGroup((g) =>
    g.setName('hotspot').setDescription('Hotspot control')
      .addSubcommand((s) => s.setName('info').setDescription('Hotspot status'))
      .addSubcommand((s) => s.setName('start').setDescription('Start the hotspot'))
      .addSubcommand((s) => s.setName('stop').setDescription('Stop the hotspot'))
      .addSubcommand((s) => s.setName('restart').setDescription('Restart the hotspot')));

  return cmd.toJSON();
}

async function main() {
  const cfg = config.discord();
  const token = await getCredential(cfg.credentialKey);
  const clientId = await getCredential(cfg.clientIdKey);
  if (!token || !clientId) {
    console.error('Missing credentials. Store them first:');
    console.error(`  npm run set-credential ${cfg.credentialKey}`);
    console.error(`  npm run set-credential ${cfg.clientIdKey}`);
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = [build()];

  if (cfg.guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, cfg.guildId), { body });
    console.log(`Registered guild commands for guild ${cfg.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log('Registered global commands (may take up to 1 hour to appear).');
  }
}

main().catch((e) => {
  console.error('Registration failed:', e.message);
  process.exit(1);
});
