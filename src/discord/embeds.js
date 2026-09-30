const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: 0x2b6cb0,
  success: 0x2f855a,
  warning: 0xdd6b20,
  danger: 0xc53030,
  neutral: 0x4a5568,
};

const FOOTER = 'WiFi Secret · #powerbywnersdev';

function base(color = COLORS.primary) {
  return new EmbedBuilder().setColor(color).setFooter({ text: FOOTER }).setTimestamp();
}

function info(title, description) {
  return base(COLORS.primary).setTitle(title).setDescription(description || null);
}

function success(title, description) {
  return base(COLORS.success).setTitle(title).setDescription(description || null);
}

function warning(title, description) {
  return base(COLORS.warning).setTitle(title).setDescription(description || null);
}

function danger(title, description) {
  return base(COLORS.danger).setTitle(title).setDescription(description || null);
}

module.exports = { base, info, success, warning, danger, COLORS, FOOTER };
