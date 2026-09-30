const { netsh, powershell } = require('../../utils/win');
const { parseInterfaces, parseNetworks, signalToDbm } = require('./parse');
const logger = require('../../utils/logger').child('wifi');

function bandFromChannel(channel) {
  const ch = parseInt(channel, 10);
  if (Number.isNaN(ch)) return null;
  if (ch >= 1 && ch <= 14) return '2.4 GHz';
  if (ch >= 32 && ch <= 177) return '5 GHz';
  if (ch >= 1 && ch <= 233) return '6 GHz';
  return null;
}

async function currentConnection() {
  const out = await netsh(['wlan', 'show', 'interfaces']);
  const interfaces = parseInterfaces(out);
  const connected = interfaces.find((i) => i.ssid) || interfaces[0] || null;
  if (!connected) return null;

  return {
    adapter: connected.name || connected.description || null,
    description: connected.description || null,
    ssid: connected.ssid || null,
    bssid: connected.bssid || null,
    state: connected.state || null,
    signal: connected.signal || null,
    signalDbm: connected.signal ? signalToDbm(connected.signal) : null,
    channel: connected.channel || null,
    band: connected.band || bandFromChannel(connected.channel),
    radioType: connected.radioType || null,
    authentication: connected.authentication || null,
    encryption: connected.encryption || null,
    profile: connected.profile || null,
  };
}

async function listAdapters() {
  const out = await netsh(['wlan', 'show', 'interfaces']);
  return parseInterfaces(out).map((i) => ({
    name: i.name || null,
    description: i.description || null,
    guid: i.guid || null,
    physicalAddress: i.physicalAddress || null,
    state: i.state || null,
  }));
}

async function scanNetworks() {
  try {
    await netsh(['wlan', 'show', 'networks', 'mode=bssid']);
  } catch (e) {
    logger.warn('scan pre-trigger failed', { error: e.message });
  }
  const out = await netsh(['wlan', 'show', 'networks', 'mode=bssid']);
  const networks = parseNetworks(out);

  return networks.map((n) => {
    const strongest = n.bssids.reduce((best, b) => {
      const s = parseInt(String(b.signal || '0').replace('%', ''), 10) || 0;
      return s > (best.__s || -1) ? { ...b, __s: s } : best;
    }, {});
    return {
      ssid: n.ssid || '(hidden)',
      authentication: n.authentication,
      encryption: n.encryption,
      networkType: n.networkType,
      bssCount: n.bssids.length,
      signal: strongest.signal || null,
      signalDbm: strongest.signal ? signalToDbm(strongest.signal) : null,
      channel: strongest.channel || null,
      band: strongest.band || bandFromChannel(strongest.channel),
      radioType: strongest.radioType || null,
      bssids: n.bssids.map((b) => ({
        bssid: b.bssid,
        signal: b.signal,
        signalDbm: b.signal ? signalToDbm(b.signal) : null,
        channel: b.channel,
        band: b.band || bandFromChannel(b.channel),
        radioType: b.radioType,
      })),
    };
  });
}

async function ipConfiguration() {
  const script = `
$ErrorActionPreference='SilentlyContinue'
$cfg = Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
$mac = (Get-NetAdapter -InterfaceIndex $cfg.InterfaceIndex).MacAddress
[PSCustomObject]@{
  InterfaceAlias = $cfg.InterfaceAlias
  IPv4 = ($cfg.IPv4Address.IPAddress -join ', ')
  IPv6 = ($cfg.IPv6Address.IPAddress -join ', ')
  Gateway = ($cfg.IPv4DefaultGateway.NextHop -join ', ')
  DNS = ($cfg.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | ForEach-Object { $_.ServerAddresses } | Select-Object -Unique) -join ', '
  MAC = $mac
} | ConvertTo-Json -Compress`;
  const raw = await powershell(script);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function internetReachable(host = '1.1.1.1') {
  const script = `(Test-Connection -ComputerName ${host} -Count 1 -Quiet)`;
  try {
    const raw = (await powershell(script)).trim().toLowerCase();
    return raw === 'true';
  } catch {
    return false;
  }
}

async function summary() {
  const [connection, ip, internet] = await Promise.all([
    currentConnection().catch(() => null),
    ipConfiguration().catch(() => null),
    internetReachable().catch(() => false),
  ]);
  return { connection, ip, internet, checkedAt: new Date().toISOString() };
}

module.exports = {
  currentConnection,
  listAdapters,
  scanNetworks,
  ipConfiguration,
  internetReachable,
  summary,
  bandFromChannel,
};
