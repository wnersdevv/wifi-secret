const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(path, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data;
}

function kv(label, value) {
  return `<div class="kv"><span>${label}</span><span>${value ?? '—'}</span></div>`;
}

function sigClass(dbm) {
  if (dbm == null) return '';
  if (dbm >= -60) return 'sig';
  if (dbm >= -75) return 'sig mid';
  return 'sig low';
}

async function loadCurrent() {
  try {
    const s = await api('/status');
    const c = s.connection || {};
    const ip = s.ip || {};
    if (!c.ssid) { $('current').innerHTML = '<div class="muted">Not connected.</div>'; return; }
    $('current').innerHTML =
      kv('SSID', c.ssid) +
      kv('Signal', c.signal ? `${c.signal} (${c.signalDbm} dBm)` : '—') +
      kv('Security', c.authentication) +
      kv('Band', c.band) + kv('Channel', c.channel) +
      kv('IP', ip.IPv4) + kv('Gateway', ip.Gateway) + kv('DNS', ip.DNS) + kv('MAC', ip.MAC) +
      kv('Internet', s.internet ? '<span class="badge ok">Online</span>' : '<span class="badge off">Offline</span>');
  } catch (e) { $('current').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function loadAdapters() {
  try {
    const a = await api('/adapters');
    $('adapters').innerHTML = a.map((x) => `<div><span>${x.name || x.description || '?'}</span><span class="muted">${x.state || ''}</span></div>`).join('') || '<div class="muted">None</div>';
  } catch (e) { $('adapters').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function loadHotspot() {
  try {
    const h = await api('/hotspot');
    const on = (h.state || '').toLowerCase() === 'on';
    $('hotspot').innerHTML =
      kv('State', on ? '<span class="badge ok">ONLINE</span>' : '<span class="badge off">OFFLINE</span>') +
      kv('SSID', h.ssid) + kv('Clients', `${h.clientCount ?? 0}/${h.maxClientCount ?? '?'}`) + kv('Band', h.band);
  } catch (e) { $('hotspot').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function hotspot(action) {
  try { toast('Hotspot ' + action + '…'); await api('/hotspot/' + action, 'POST'); await loadHotspot(); toast('Hotspot ' + action + ' done'); }
  catch (e) { toast(e.message); }
}

async function configureHotspot() {
  try {
    await api('/hotspot/configure', 'POST', { ssid: $('hsSsid').value.trim(), passphrase: $('hsPass').value });
    toast('Hotspot configured'); loadHotspot();
  } catch (e) { toast(e.message); }
}

async function loadDevices() {
  try {
    const d = await api('/hotspot/devices');
    $('devices').innerHTML = d.clients.length
      ? d.clients.map((c) => `<div><span>${c.ip || '?'}</span><span class="muted">${c.mac || ''}</span></div>`).join('')
      : '<div class="muted">No connected devices.</div>';
  } catch (e) { $('devices').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function loadScan() {
  $('networks').innerHTML = '<div class="muted">Scanning…</div>';
  try {
    const nets = await api('/networks');
    nets.sort((a, b) => (b.signalDbm ?? -200) - (a.signalDbm ?? -200));
    $('networks').innerHTML = nets.map((n) =>
      `<div><span><span class="dot ${sigClass(n.signalDbm)}">●</span>${n.ssid}</span>` +
      `<span class="muted">${n.signal || '?'} · ${n.band || '?'} · ch${n.channel || '?'} · ${n.authentication || 'Open'}</span></div>`).join('');
  } catch (e) { $('networks').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function loadSecurity() {
  $('security').innerHTML = '<div class="muted">Scanning…</div>';
  try {
    const r = await api('/security');
    const icons = { critical: '🔴', weak: '🟠', warning: '🟡', info: '🔵' };
    $('security').innerHTML =
      `<div style="font-size:22px;font-weight:700;margin-bottom:8px">${r.rating} <span class="muted" style="font-size:13px">${r.score}/100</span></div>` +
      r.findings.map((f) => `<div class="finding">${icons[f.severity] || '•'} ${f.message}</div>`).join('');
  } catch (e) { $('security').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function genPassword() {
  try {
    const r = await api('/password', 'POST', { length: parseInt($('pwLen').value, 10) });
    $('pwOut').innerHTML = `<code id="pwVal">${r.password}</code><div class="muted" style="margin-top:6px">${r.strength.label} · ${r.strength.bits} bits</div>`;
  } catch (e) { toast(e.message); }
}
function copyPw() { const v = $('pwVal'); if (v) { navigator.clipboard.writeText(v.textContent); toast('Copied'); } }

async function makeQr() {
  try {
    const r = await api('/qr', 'POST', { ssid: $('qrSsid').value.trim(), password: $('qrPass').value, security: $('qrSec').value });
    $('qrOut').innerHTML = `<img src="${r.dataUrl}" alt="QR" />`;
  } catch (e) { toast(e.message); }
}

async function lookupIp() {
  $('ipOut').innerHTML = '<div class="muted">Looking up…</div>';
  try {
    const r = await api('/ip', 'POST', { address: $('ipAddr').value.trim() });
    $('ipOut').innerHTML = kv('Country', r.country) + kv('Region', r.region) + kv('City', r.city) +
      kv('ISP', r.isp) + kv('Org', r.organization) + kv('ASN', r.asn) + kv('Timezone', r.timezone) +
      `<div class="muted" style="margin-top:6px;font-size:11px">${r.note}</div>`;
  } catch (e) { $('ipOut').innerHTML = `<div class="muted">${e.message}</div>`; }
}

async function loadBackups() {
  $('backups').innerHTML = '<div class="muted">Loading…</div>';
  try {
    const [profiles, backups] = await Promise.all([api('/backup/profiles'), api('/backup/list')]);
    $('backups').innerHTML =
      `<div class="row" style="align-items:flex-start;gap:24px">` +
      `<div style="flex:1"><label>Saved profiles (${profiles.length})</label><div class="list">${profiles.map((p) => `<div><span>${p}</span></div>`).join('') || '<div class="muted">None</div>'}</div></div>` +
      `<div style="flex:1"><label>Backups (${backups.length})</label><div class="list">${backups.map((b) => `<div><span>${b.file}</span><span class="muted">${b.profileCount || '?'}p</span></div>`).join('') || '<div class="muted">None</div>'}</div></div>` +
      `</div>`;
  } catch (e) { $('backups').innerHTML = `<div class="muted">${e.message}</div>`; }
}

function refreshAll() { loadCurrent(); loadAdapters(); loadHotspot(); loadDevices(); }
refreshAll();
setInterval(loadHotspot, 12000);
