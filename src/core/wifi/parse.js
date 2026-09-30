const SYNONYMS = {
  name: ['name', 'ad', 'adı', 'isim'],
  ssid: ['ssid'],
  bssid: ['bssid'],
  state: ['state', 'durum'],
  signal: ['signal', 'sinyal'],
  channel: ['channel', 'kanal'],
  radioType: ['radio type', 'radyo türü', 'radyo turu'],
  band: ['band', 'bant'],
  authentication: ['authentication', 'kimlik doğrulama', 'kimlik dogrulama', 'yetkilendirme'],
  encryption: ['cipher', 'encryption', 'şifreleme', 'sifreleme', 'şifre'],
  networkType: ['network type', 'ağ türü', 'ag turu'],
  physicalAddress: ['physical address', 'fiziksel adres'],
  description: ['description', 'açıklama', 'aciklama'],
  guid: ['guid'],
  profile: ['profile', 'profil'],
};

function normalizeKey(rawKey) {
  const key = rawKey.trim().toLowerCase();
  for (const [canonical, variants] of Object.entries(SYNONYMS)) {
    if (variants.includes(key)) return canonical;
  }
  return null;
}

function splitKeyValue(line) {
  const idx = line.indexOf(':');
  if (idx === -1) return null;
  return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
}

function parseInterfaces(output) {
  const blocks = output.split(/\r?\n\s*\r?\n/);
  const interfaces = [];
  let current = null;

  for (const line of output.split(/\r?\n/)) {
    const kv = splitKeyValue(line);
    if (!kv) continue;
    const canonical = normalizeKey(kv.key);
    const lowerKey = kv.key.trim().toLowerCase();

    if (lowerKey === 'name' || lowerKey === 'ad' || lowerKey === 'adı') {
      if (current) interfaces.push(current);
      current = {};
    }
    if (!current) current = {};
    if (canonical) current[canonical] = kv.value;
  }
  if (current && Object.keys(current).length) interfaces.push(current);
  void blocks;
  return interfaces;
}

function parseNetworks(output) {
  const lines = output.split(/\r?\n/);
  const networks = [];
  let net = null;
  let bss = null;

  for (const line of lines) {
    const kv = splitKeyValue(line);
    if (!kv) continue;
    const lowerKey = kv.key.trim().toLowerCase();
    const canonical = normalizeKey(kv.key);

    if (/^ssid\s+\d+/.test(lowerKey)) {
      if (bss && net) net.bssids.push(bss), (bss = null);
      if (net) networks.push(net);
      net = { ssid: kv.value, bssids: [], authentication: null, encryption: null, networkType: null };
      continue;
    }
    if (!net) continue;

    if (lowerKey.startsWith('bssid')) {
      if (bss) net.bssids.push(bss);
      bss = { bssid: kv.value, signal: null, radioType: null, band: null, channel: null };
      continue;
    }

    if (bss && canonical && ['signal', 'radioType', 'band', 'channel'].includes(canonical)) {
      bss[canonical] = kv.value;
    } else if (canonical && ['authentication', 'encryption', 'networkType'].includes(canonical)) {
      net[canonical] = kv.value;
    }
  }
  if (bss && net) net.bssids.push(bss);
  if (net) networks.push(net);
  return networks;
}

function parseProfileList(output) {
  const profiles = [];
  for (const line of output.split(/\r?\n/)) {
    const kv = splitKeyValue(line);
    if (!kv) continue;
    const lowerKey = kv.key.trim().toLowerCase();
    if (lowerKey.includes('all user profile') || lowerKey.includes('tüm kullanıcı profili') || lowerKey.includes('tum kullanici profili')) {
      profiles.push(kv.value.trim());
    }
  }
  return profiles;
}

function signalToDbm(percent) {
  const p = parseInt(String(percent).replace('%', ''), 10);
  if (Number.isNaN(p)) return null;
  return Math.round(p / 2 - 100);
}

module.exports = { parseInterfaces, parseNetworks, parseProfileList, signalToDbm, normalizeKey };
