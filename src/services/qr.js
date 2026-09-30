const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

function escapeWifi(value) {
  return String(value).replace(/([\\;,":])/g, '\\$1');
}

function normalizeSecurity(security) {
  const s = (security || 'WPA').toUpperCase();
  if (s.includes('WPA3') || s.includes('WPA2') || s.includes('WPA')) return 'WPA';
  if (s.includes('WEP')) return 'WEP';
  if (s.includes('OPEN') || s === 'NONE' || s === '') return 'nopass';
  return 'WPA';
}

function buildPayload({ ssid, password, security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('SSID is required for a Wi-Fi QR code.');
  const type = normalizeSecurity(security);
  const parts = [`T:${type}`, `S:${escapeWifi(ssid)}`];
  if (type !== 'nopass') parts.push(`P:${escapeWifi(password || '')}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

async function toDataUrl(input) {
  const payload = buildPayload(input);
  const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
  return { payload, dataUrl };
}

async function toFile(input, outPath) {
  const payload = buildPayload(input);
  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await QRCode.toFile(target, payload, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
  return { payload, file: target };
}

async function toBuffer(input) {
  const payload = buildPayload(input);
  const buffer = await QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', margin: 2, width: 512 });
  return { payload, buffer };
}

module.exports = { buildPayload, toDataUrl, toFile, toBuffer };
