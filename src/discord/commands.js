const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const core = require('../core');
const embeds = require('./embeds');
const config = require('../utils/config');

function fieldList(obj, keys) {
  return keys
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([label, value]) => ({ name: label, value: '```' + String(value) + '```', inline: true }));
}

function confirmRow(action) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`wsconfirm:${action}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('wscancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
}

function isCritical(canonical) {
  const map = { 'hotspot.start': 'hotspot start', 'hotspot.stop': 'hotspot stop', 'hotspot.restart': 'hotspot restart', restore: 'restore' };
  const cfg = config.discord();
  if (!cfg.requireConfirmForCritical) return false;
  return cfg.criticalCommands.includes(map[canonical]);
}

const handlers = {
  async status() {
    const s = await core.status();
    const c = s.connection || {};
    const ip = s.ip || {};
    const e = embeds.info('Current Network', c.ssid ? null : 'Not connected to a Wi-Fi network.');
    if (c.ssid) {
      e.addFields(
        ...fieldList(null, [
          ['SSID', c.ssid],
          ['Signal', c.signal ? `${c.signal} (${c.signalDbm} dBm)` : null],
          ['Security', c.authentication],
          ['Band', c.band],
          ['Channel', c.channel],
          ['BSSID', c.bssid],
          ['IP', ip.IPv4],
          ['Gateway', ip.Gateway],
          ['DNS', ip.DNS],
          ['Internet', s.internet ? 'Online' : 'Offline'],
        ])
      );
    }
    return { embeds: [e] };
  },

  async networks() {
    const nets = await core.networks();
    const top = nets
      .sort((a, b) => (parseInt(b.signal) || 0) - (parseInt(a.signal) || 0))
      .slice(0, 15)
      .map((n, i) => `\`${String(i + 1).padStart(2)}\` **${n.ssid}** · ${n.signal || '?'} · ${n.band || '?'} ch${n.channel || '?'} · ${n.authentication || 'Open'}`)
      .join('\n');
    return { embeds: [embeds.info(`Nearby Networks (${nets.length})`, top || 'No networks found.')] };
  },

  async scan() {
    const r = await core.scan();
    const congestion = r.congestion.slice(0, 8).map((c) => `ch${c.channel} (${c.band || '?'}): ${c.count} network(s)`).join('\n');
    const rec = r.recommendations.map((x) => `${x.band}: channel **${x.recommended}**`).join(' · ');
    return { embeds: [embeds.info('Channel Scan', `**${r.networkCount}** networks\n\n**Congestion**\n${congestion}\n\n**Recommended**\n${rec}`)] };
  },

  async security(ctx) {
    const r = await core.securityScan(ctx.actor);
    const color = r.rating === 'A' ? embeds.COLORS.success : r.score < 60 ? embeds.COLORS.danger : embeds.COLORS.warning;
    const lines = r.findings.map((f) => {
      const icon = { critical: '🔴', weak: '🟠', warning: '🟡', info: '🔵' }[f.severity] || '•';
      return `${icon} ${f.message}`;
    }).join('\n');
    const e = embeds.base(color).setTitle(`Security Scan · ${r.rating} (${r.score}/100)`).setDescription(lines).setFooter({ text: embeds.FOOTER }).setTimestamp();
    return { embeds: [e] };
  },

  'hotspot.info': async () => {
    const s = await core.hotspot.status();
    const e = embeds.info('Hotspot Status', `State: **${s.state || 'Unknown'}**`);
    e.addFields(...fieldList(null, [
      ['SSID', s.ssid],
      ['Clients', `${s.clientCount ?? 0}/${s.maxClientCount ?? '?'}`],
      ['Band', s.band],
    ]));
    return { embeds: [e] };
  },

  'hotspot.start': async (ctx) => runHotspot('start', ctx),
  'hotspot.stop': async (ctx) => runHotspot('stop', ctx),
  'hotspot.restart': async (ctx) => runHotspot('restart', ctx),

  async devices() {
    const r = await core.hotspot.devices();
    const list = r.clients.length
      ? r.clients.map((c, i) => `\`${i + 1}\` ${c.ip || '?'} · ${c.mac || '?'} · ${c.state || ''}`).join('\n')
      : 'No connected devices detected.';
    return { embeds: [embeds.info(`Connected Devices (${r.clientCount})`, list)] };
  },

  async qr(ctx) {
    const ssid = ctx.getString('ssid');
    const pass = ctx.getString('password');
    const sec = ctx.getString('security') || 'WPA';
    if (!ssid) return { embeds: [embeds.warning('QR', 'Provide an SSID.')] };
    const { buffer, payload } = await core.qr.toBuffer({ ssid, password: pass, security: sec });
    const file = new AttachmentBuilder(buffer, { name: 'wifi-qr.png' });
    const e = embeds.info('Wi-Fi QR Code', `SSID: **${ssid}** · Security: ${sec}`).setImage('attachment://wifi-qr.png');
    void payload;
    return { embeds: [e], files: [file] };
  },

  async password(ctx) {
    const length = parseInt(ctx.getString('length'), 10) || 16;
    const res = core.password.generate({ length });
    const e = embeds.success('Generated Password', `\`${res.password}\`\n\nStrength: **${res.strength.label}** (${res.strength.bits} bits)`);
    return { embeds: [e], ephemeral: true };
  },

  async ip(ctx) {
    const target = ctx.getString('address');
    try {
      const r = await core.geo.lookup(target);
      const e = embeds.info(`IP Lookup · ${r.ip}`).addFields(...fieldList(null, [
        ['Country', r.country], ['Region', r.region], ['City', r.city],
        ['ISP', r.isp], ['Organization', r.organization], ['ASN', r.asn], ['Timezone', r.timezone],
      ]));
      e.setDescription(r.note);
      return { embeds: [e] };
    } catch (err) {
      return { embeds: [embeds.warning('IP Lookup', err.message)] };
    }
  },

  async backup() {
    const [profiles, backups] = await Promise.all([core.backup.listProfiles(), core.backup.list()]);
    const pList = profiles.length ? profiles.map((p) => `• ${p}`).join('\n') : 'No profiles.';
    const bList = backups.length ? backups.slice(0, 8).map((b) => `• ${b.file} (${b.profileCount || '?'} profiles)`).join('\n') : 'No backups yet.';
    return { embeds: [embeds.info('Wi-Fi Profiles & Backups', `**Profiles**\n${pList}\n\n**Backups**\n${bList}\n\n_Create/restore backups from the desktop app; they are encrypted with a password only you know._`)] };
  },

  async restore(ctx) {
    return { embeds: [embeds.warning('Restore', 'Restoring writes Wi-Fi profiles back to this machine. Confirm to proceed, then you will be asked for the backup file and password in the desktop app.')], components: [confirmRow('restore')] };
    void ctx;
  },

  async logs() {
    const runtime = require('../database/croxy');
    const scan = runtime.get('scan.last');
    const hotspot = runtime.get('hotspot.status');
    const mongo = require('../database/mongo');
    let recent = 'Connect MongoDB to view persisted audit logs.';
    if (mongo.isConnected()) {
      const models = require('../database/models');
      const rows = await models.Logs.find().sort({ createdAt: -1 }).limit(10).lean();
      recent = rows.map((r) => `\`${new Date(r.createdAt).toISOString().slice(11, 19)}\` ${r.action} ${r.actor ? '· ' + r.actor : ''}`).join('\n') || 'No log entries.';
    }
    const e = embeds.info('Recent Activity', recent);
    e.addFields(
      { name: 'Last scan', value: scan ? new Date(scan.at).toISOString() : 'n/a', inline: true },
      { name: 'Hotspot', value: hotspot ? hotspot.state || 'n/a' : 'n/a', inline: true }
    );
    return { embeds: [e] };
  },
};

async function runHotspot(action, ctx) {
  const canonical = `hotspot.${action}`;
  if (isCritical(canonical) && !ctx.confirmed) {
    return {
      embeds: [embeds.warning(`Hotspot ${action}`, `This will ${action} the local hotspot. Confirm to proceed.`)],
      components: [confirmRow(canonical)],
    };
  }
  const res = await core.hotspot[action](ctx.actor);
  return { embeds: [embeds.success(`Hotspot ${action}`, `State: **${res.state || 'requested'}**`)] };
}

const META = {
  status: { role: 'user', desc: 'Show the current Wi-Fi connection' },
  networks: { role: 'user', desc: 'List nearby Wi-Fi networks' },
  scan: { role: 'user', desc: 'Channel congestion scan' },
  security: { role: 'user', desc: 'Security scan of your own network' },
  devices: { role: 'admin', desc: 'List devices connected to the hotspot' },
  qr: { role: 'user', desc: 'Generate a Wi-Fi QR code' },
  password: { role: 'user', desc: 'Generate a strong password' },
  ip: { role: 'user', desc: 'Approximate IP geolocation' },
  backup: { role: 'admin', desc: 'List Wi-Fi profiles and backups' },
  restore: { role: 'owner', desc: 'Restore Wi-Fi profiles from a backup' },
  logs: { role: 'admin', desc: 'Show recent activity' },
  'hotspot.info': { role: 'user', desc: 'Hotspot status' },
  'hotspot.start': { role: 'admin', desc: 'Start the hotspot' },
  'hotspot.stop': { role: 'admin', desc: 'Stop the hotspot' },
  'hotspot.restart': { role: 'admin', desc: 'Restart the hotspot' },
};

module.exports = { handlers, META, isCritical, confirmRow };
