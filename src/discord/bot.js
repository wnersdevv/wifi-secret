const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const config = require('../utils/config');
const { getCredential } = require('../utils/credentials');
const logger = require('../utils/logger').child('discord');
const permissions = require('./permissions');
const cooldown = require('./cooldown');
const { handlers, META } = require('./commands');
const embeds = require('./embeds');
const audit = require('../services/audit');

let client = null;

function makeCtx({ actor, tag, role, getString, confirmed = false }) {
  return { actor, tag, role, getString, confirmed };
}

async function dispatch(canonical, ctx, reply) {
  const meta = META[canonical];
  if (!meta || !handlers[canonical]) {
    return reply({ embeds: [embeds.warning('Unknown command', `No handler for \`${canonical}\`.`)] });
  }

  const perm = await permissions.can(ctx.actor, meta.role, canonical);
  ctx.role = perm.role;
  if (!perm.allowed) {
    return reply({ embeds: [embeds.danger('Permission denied', perm.reason)], ephemeral: true });
  }

  const cd = cooldown.check(ctx.actor, canonical);
  if (cd.limited) {
    return reply({ embeds: [embeds.warning('Slow down', `Try again in ${cd.remaining}s.`)], ephemeral: true });
  }

  await permissions.touchUser(ctx.actor, ctx.tag);

  try {
    const payload = await handlers[canonical](ctx);
    await audit.record({ action: `cmd.${canonical}`, actor: ctx.tag || ctx.actor, source: 'discord' });
    return reply(payload);
  } catch (err) {
    logger.error('command failed', { canonical, error: err.message });
    return reply({ embeds: [embeds.danger('Command error', err.message)], ephemeral: true });
  }
}

function slashReplyFactory(interaction) {
  return async (payload) => {
    const data = { embeds: payload.embeds || [], files: payload.files || [], components: payload.components || [] };
    if (payload.ephemeral) data.ephemeral = true;
    if (interaction.deferred || interaction.replied) return interaction.editReply(data);
    return interaction.reply(data);
  };
}

function resolveCanonical(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);
  if (group === 'hotspot') return `hotspot.${sub}`;
  return sub;
}

async function onInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'wifi') {
    const canonical = resolveCanonical(interaction);
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const ctx = makeCtx({
      actor: interaction.user.id,
      tag: interaction.user.tag,
      getString: (name) => interaction.options.getString(name),
    });
    return dispatch(canonical, ctx, slashReplyFactory(interaction));
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'wscancel') {
      return interaction.update({ embeds: [embeds.neutral ? embeds.neutral('Cancelled') : embeds.info('Cancelled', 'No action taken.')], components: [] }).catch(() => {});
    }
    if (interaction.customId.startsWith('wsconfirm:')) {
      const canonical = interaction.customId.split(':')[1];
      const meta = META[canonical];
      const perm = await permissions.can(interaction.user.id, meta ? meta.role : 'owner', canonical);
      if (!perm.allowed) {
        return interaction.update({ embeds: [embeds.danger('Permission denied', perm.reason)], components: [] }).catch(() => {});
      }
      await interaction.update({ embeds: [embeds.info('Working…', 'Executing confirmed action.')], components: [] }).catch(() => {});
      const ctx = makeCtx({ actor: interaction.user.id, tag: interaction.user.tag, role: perm.role, getString: () => null, confirmed: true });
      const payload = await handlers[canonical](ctx).catch((e) => ({ embeds: [embeds.danger('Error', e.message)] }));
      await audit.record({ action: `confirm.${canonical}`, actor: interaction.user.tag, source: 'discord' });
      return interaction.editReply({ embeds: payload.embeds || [], components: [], files: payload.files || [] }).catch(() => {});
    }
  }
}

function parsePrefix(content, prefix) {
  const body = content.slice(prefix.length).trim();
  const tokens = body.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { canonical: 'status', rest: [] };
  if (tokens[0] === 'hotspot') {
    const action = tokens[1] || 'info';
    return { canonical: `hotspot.${action}`, rest: tokens.slice(2) };
  }
  return { canonical: tokens[0], rest: tokens.slice(1) };
}

async function onMessage(message) {
  if (message.author.bot) return;
  const cfg = config.discord();
  const prefix = cfg.prefix;
  if (!message.content.startsWith(prefix)) return;

  const { canonical, rest } = parsePrefix(message.content, prefix);
  const positional = { ssid: rest[0], password: rest[1], security: rest[2], address: rest[0], length: rest[0] };
  const ctx = makeCtx({
    actor: message.author.id,
    tag: message.author.tag,
    getString: (name) => positional[name] ?? null,
  });
  const reply = async (payload) => message.reply({ embeds: payload.embeds || [], files: payload.files || [], components: payload.components || [] });
  return dispatch(canonical, ctx, reply);
}

async function start() {
  const cfg = config.discord();
  if (!cfg.enabled) {
    logger.warn('Discord bot disabled in config.');
    return null;
  }
  const token = await getCredential(cfg.credentialKey);
  if (!token) {
    logger.warn(`No Discord token stored under "${cfg.credentialKey}". Run: npm run set-credential ${cfg.credentialKey}`);
    return null;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (c) => logger.info(`Discord bot ready as ${c.user.tag}`));
  client.on(Events.InteractionCreate, (i) => onInteraction(i).catch((e) => logger.error('interaction handler', { error: e.message })));
  client.on(Events.MessageCreate, (m) => onMessage(m).catch((e) => logger.error('message handler', { error: e.message })));
  client.on(Events.Error, (e) => logger.error('client error', { error: e.message }));

  await client.login(token);
  return client;
}

async function stop() {
  if (client) await client.destroy();
  client = null;
}

module.exports = { start, stop };
