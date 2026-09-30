const wifi = require('../wifi');

function channelCongestion(networks) {
  const byChannel = new Map();
  for (const net of networks) {
    for (const bss of net.bssids.length ? net.bssids : [net]) {
      const ch = parseInt(bss.channel, 10);
      if (Number.isNaN(ch)) continue;
      const band = bss.band || wifi.bandFromChannel(ch);
      const key = `${band || '?'}|${ch}`;
      if (!byChannel.has(key)) byChannel.set(key, { channel: ch, band, count: 0, networks: [] });
      const entry = byChannel.get(key);
      entry.count += 1;
      entry.networks.push(net.ssid);
    }
  }
  return [...byChannel.values()].sort((a, b) => b.count - a.count);
}

function recommendChannel(congestion, band = '2.4 GHz') {
  const candidates = band === '2.4 GHz' ? [1, 6, 11] : [36, 40, 44, 48, 149, 153, 157, 161];
  const load = new Map(candidates.map((c) => [c, 0]));
  for (const entry of congestion) {
    if (entry.band !== band) continue;
    if (load.has(entry.channel)) load.set(entry.channel, load.get(entry.channel) + entry.count);
  }
  let best = candidates[0];
  let bestLoad = Infinity;
  for (const [ch, count] of load) {
    if (count < bestLoad) {
      bestLoad = count;
      best = ch;
    }
  }
  return { band, recommended: best, load: bestLoad };
}

async function analyze() {
  const networks = await wifi.scanNetworks();
  const congestion = channelCongestion(networks);
  return {
    scannedAt: new Date().toISOString(),
    networkCount: networks.length,
    networks,
    congestion,
    recommendations: [recommendChannel(congestion, '2.4 GHz'), recommendChannel(congestion, '5 GHz')],
  };
}

module.exports = { analyze, channelCongestion, recommendChannel };
