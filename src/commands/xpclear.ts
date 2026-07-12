import { ChatInputCommandInteraction, PermissionsBitField, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';
import { withConfirmFlow } from '../utils/confirmFlow';
import { clearGuildXp } from '../utils/levels';

async function xpclearCommand(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await withConfirmFlow(interaction, {
    embed: embed('Confirm XP Clear', 'Are you sure? This will **permanently delete all XP and level data** for every member in this server. This cannot be undone.'),
    confirmLabel: 'Yes, Clear All XP',
    cancelLabel: 'Cancel'
  }, async (btn) => {
    const count = clearGuildXp(guild.id);
    await btn.update({
      embeds: [embed('XP Cleared', `All XP data has been cleared for **${count}** member(s) in this server.`)],
      components: []
    });
  }, async (btn) => {
    await btn.update({ embeds: [embed('Cancelled', 'XP data was not modified.')], components: [] });
  });
}

module.exports = { default: xpclearCommand };
