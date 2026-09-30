const { execFile } = require('child_process');

const PS = 'powershell.exe';
const PS_ARGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];

function isWindows() {
  return process.platform === 'win32';
}

function assertWindows() {
  if (!isWindows()) {
    const err = new Error('This operation requires Windows.');
    err.code = 'ENOTWINDOWS';
    throw err;
  }
}

function run(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 * 8, encoding: 'utf8', ...options },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          return reject(error);
        }
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      }
    );
  });
}

async function netsh(args) {
  assertWindows();
  const { stdout } = await run('netsh.exe', args);
  return stdout;
}

async function powershell(script) {
  assertWindows();
  const { stdout } = await run(PS, [...PS_ARGS, '-Command', script]);
  return stdout.trim();
}

async function powershellJson(script) {
  const wrapped = `$ErrorActionPreference='Stop'; $out = ${script}; $out | ConvertTo-Json -Depth 6 -Compress`;
  const raw = await powershell(wrapped);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

module.exports = { isWindows, assertWindows, run, netsh, powershell, powershellJson };
