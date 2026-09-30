const fs = require('fs');
const path = require('path');
const { powershell, isWindows } = require('./win');

const STORE = path.resolve(__dirname, '..', '..', 'data', 'credentials.dat');

function readStore() {
  if (!fs.existsSync(STORE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(obj) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(obj, null, 2), { mode: 0o600 });
}

function b64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function protect(plain) {
  if (!isWindows()) {
    throw new Error('Credential encryption requires Windows DPAPI. Run on Windows to store secrets.');
  }
  const script = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$bytes = [System.Text.Encoding]::UTF8.GetBytes([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(plain)}')))
$enc = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($enc)`;
  return (await powershell(script)).trim();
}

async function unprotect(cipherB64) {
  if (!isWindows()) {
    throw new Error('Credential decryption requires Windows DPAPI.');
  }
  const script = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$enc = [Convert]::FromBase64String('${cipherB64}')
$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.Text.Encoding]::UTF8.GetString($dec)`;
  return (await powershell(script)).trim();
}

async function setCredential(key, value) {
  const store = readStore();
  store[key] = { cipher: await protect(value), updatedAt: new Date().toISOString() };
  writeStore(store);
}

async function getCredential(key) {
  const store = readStore();
  const entry = store[key];
  if (!entry) return null;
  return unprotect(entry.cipher);
}

function hasCredential(key) {
  return Boolean(readStore()[key]);
}

function listCredentialKeys() {
  return Object.keys(readStore());
}

function deleteCredential(key) {
  const store = readStore();
  if (store[key]) {
    delete store[key];
    writeStore(store);
    return true;
  }
  return false;
}

module.exports = {
  setCredential,
  getCredential,
  hasCredential,
  listCredentialKeys,
  deleteCredential,
};
