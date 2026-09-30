const wifi = require('../wifi');
const scanner = require('../scanner');

function classifyAuth(auth) {
  const a = (auth || '').toLowerCase();
  if (a.includes('wpa3')) return { level: 'strong', standard: 'WPA3' };
  if (a.includes('wpa2')) return { level: 'good', standard: 'WPA2' };
  if (a.includes('wpa')) return { level: 'weak', standard: 'WPA' };
  if (a.includes('wep')) return { level: 'critical', standard: 'WEP' };
  if (a.includes('open') || a.includes('açık') || a.includes('acik') || a === '') return { level: 'critical', standard: 'Open' };
  return { level: 'unknown', standard: auth || 'Unknown' };
}

function grade(findings) {
  const weights = { critical: 40, weak: 20, warning: 10, info: 0 };
  const penalty = findings.reduce((sum, f) => sum + (weights[f.severity] || 0), 0);
  const score = Math.max(0, 100 - penalty);
  let rating = 'A';
  if (score < 90) rating = 'B';
  if (score < 75) rating = 'C';
  if (score < 60) rating = 'D';
  if (score < 40) rating = 'F';
  return { score, rating };
}

async function scanOwnNetwork() {
  const findings = [];
  const [connection, ip, scan] = await Promise.all([
    wifi.currentConnection().catch(() => null),
    wifi.ipConfiguration().catch(() => null),
    scanner.analyze().catch(() => null),
  ]);

  if (!connection || !connection.ssid) {
    findings.push({ severity: 'warning', code: 'no-connection', message: 'No active Wi-Fi connection detected.' });
    return { findings, ...grade(findings), connection, ip, checkedAt: new Date().toISOString() };
  }

  const auth = classifyAuth(connection.authentication);
  if (auth.level === 'critical') {
    findings.push({
      severity: 'critical',
      code: 'weak-auth',
      message: `Network uses ${auth.standard}. This offers little or no protection. Use WPA2 or WPA3.`,
    });
  } else if (auth.level === 'weak') {
    findings.push({ severity: 'weak', code: 'legacy-auth', message: `Network uses ${auth.standard}. Prefer WPA2/WPA3.` });
  } else {
    findings.push({ severity: 'info', code: 'auth-ok', message: `Authentication: ${auth.standard}.` });
  }

  const signalPct = parseInt(String(connection.signal || '0').replace('%', ''), 10) || 0;
  if (signalPct && signalPct < 40) {
    findings.push({ severity: 'warning', code: 'weak-signal', message: `Signal is low (${connection.signal}). Reliability may suffer.` });
  }

  if (scan && scan.congestion.length) {
    const myChannel = parseInt(connection.channel, 10);
    const myBand = connection.band;
    const same = scan.congestion.find((c) => c.channel === myChannel && c.band === myBand);
    if (same && same.count >= 4) {
      const rec = scan.recommendations.find((r) => r.band === myBand);
      findings.push({
        severity: 'warning',
        code: 'channel-congestion',
        message: `Channel ${myChannel} (${myBand}) is shared by ${same.count} networks.${rec ? ` Consider channel ${rec.recommended}.` : ''}`,
      });
    }
  }

  if (ip && ip.DNS) {
    const dnsList = ip.DNS.split(',').map((s) => s.trim()).filter(Boolean);
    findings.push({ severity: 'info', code: 'dns', message: `DNS servers: ${dnsList.join(', ') || 'none'}.` });
  } else {
    findings.push({ severity: 'warning', code: 'no-dns', message: 'No DNS servers detected on the active adapter.' });
  }

  if (ip && !ip.Gateway) {
    findings.push({ severity: 'warning', code: 'no-gateway', message: 'No default gateway configured.' });
  }

  return {
    findings,
    ...grade(findings),
    connection,
    ip,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { scanOwnNetwork, classifyAuth };
