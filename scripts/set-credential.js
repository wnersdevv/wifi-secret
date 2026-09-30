const readline = require('readline');
const { setCredential, listCredentialKeys, deleteCredential } = require('../src/utils/credentials');

const KNOWN = {
  discord_token: 'Discord bot token',
  discord_client_id: 'Discord application (client) ID',
  mongo_uri: 'MongoDB connection URI',
};

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      const stdout = process.stdout;
      rl._writeToOutput = (str) => {
        if (str.includes(question)) stdout.write(str);
        else stdout.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const [, , cmd, key] = process.argv;

  if (cmd === 'list') {
    const keys = listCredentialKeys();
    console.log(keys.length ? keys.join('\n') : '(no credentials stored)');
    return;
  }

  if (cmd === 'delete' && key) {
    console.log(deleteCredential(key) ? `Removed ${key}` : `Not found: ${key}`);
    return;
  }

  console.log('WiFi Secret - secure credential setup (Windows DPAPI, CurrentUser scope)\n');
  console.log('Stored encrypted in data/credentials.dat. No .env, no plaintext secrets.\n');
  console.log('Known keys:');
  for (const [k, desc] of Object.entries(KNOWN)) console.log(`  ${k.padEnd(18)} ${desc}`);
  console.log('');

  const chosen = key || (await ask('Credential key: '));
  if (!chosen) {
    console.log('No key given, aborting.');
    return;
  }
  const value = await ask(`Value for "${chosen}": `, true);
  if (!value) {
    console.log('Empty value, aborting.');
    return;
  }
  await setCredential(chosen, value);
  console.log(`Stored "${chosen}" securely.`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
