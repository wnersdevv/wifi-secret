const config = require('../utils/config');

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /:/;

function isValidIp(ip) {
  if (IPV4.test(ip)) return ip.split('.').every((o) => Number(o) >= 0 && Number(o) <= 255);
  return IPV6.test(ip);
}

async function lookup(ip) {
  if (!ip || !isValidIp(ip.trim())) throw new Error('Enter a valid IPv4 or IPv6 address.');
  const target = ip.trim();
  const { geo } = config.app();
  const fields = 'status,message,country,regionName,city,isp,org,as,timezone,query';
  const url = `${geo.endpoint}${encodeURIComponent(target)}?fields=${fields}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'WiFi-Secret/1.0' } });
  if (!res.ok) throw new Error(`Geolocation service returned HTTP ${res.status}.`);
  const data = await res.json();
  if (data.status && data.status !== 'success') {
    throw new Error(data.message || 'Geolocation lookup failed.');
  }

  return {
    ip: data.query || target,
    country: data.country || null,
    region: data.regionName || null,
    city: data.city || null,
    isp: data.isp || null,
    organization: data.org || null,
    asn: data.as || null,
    timezone: data.timezone || null,
    note: 'IP geolocation is approximate and regional only. It does not reveal a precise physical address.',
  };
}

module.exports = { lookup, isValidIp };
