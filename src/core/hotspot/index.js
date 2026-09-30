const path = require('path');
const { run, assertWindows } = require('../../utils/win');
const logger = require('../../utils/logger').child('hotspot');
const runtime = require('../../database/croxy');

const SCRIPT = path.join(__dirname, 'winrt.ps1');
const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT];

async function invoke(action, params = {}) {
  assertWindows();
  const args = [...PS_ARGS, '-Action', action];
  if (params.ssid) args.push('-Ssid', params.ssid);
  if (params.passphrase) args.push('-Passphrase', params.passphrase);
  if (params.band) args.push('-Band', params.band);

  const { stdout } = await run('powershell.exe', args);
  let result;
  try {
    result = JSON.parse(stdout.trim());
  } catch {
    throw new Error(`Hotspot control returned unparseable output: ${stdout.slice(0, 200)}`);
  }
  if (!result.ok && result.error) {
    const err = new Error(result.error);
    err.result = result;
    throw err;
  }
  return result;
}

async function status() {
  const res = await invoke('status');
  runtime.set('hotspot.status', { ...res, at: Date.now() });
  return res;
}

async function configure({ ssid, passphrase }) {
  if (passphrase && passphrase.length < 8) throw new Error('Hotspot passphrase must be at least 8 characters.');
  const res = await invoke('configure', { ssid, passphrase });
  logger.info('hotspot configured', { ssid });
  return res;
}

async function start() {
  const res = await invoke('start');
  runtime.set('hotspot.running', true);
  logger.info('hotspot start requested', { state: res.state });
  return res;
}

async function stop() {
  const res = await invoke('stop');
  runtime.set('hotspot.running', false);
  logger.info('hotspot stop requested', { state: res.state });
  return res;
}

async function restart() {
  await stop().catch((e) => logger.warn('stop during restart failed', { error: e.message }));
  await new Promise((r) => setTimeout(r, 1500));
  const res = await start();
  logger.info('hotspot restarted');
  return res;
}

async function connectedDevices() {
  const res = await invoke('clients');
  return { clientCount: res.clientCount || 0, clients: res.clients || [] };
}

module.exports = { status, configure, start, stop, restart, connectedDevices };
