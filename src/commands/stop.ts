import { ChatInputCommandInteraction, PermissionsBitField, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';
import { withConfirmFlow } from '../utils/confirmFlow';

async function stopCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await withConfirmFlow(interaction, {
    embed: embed('Confirm Shutdown', 'Are you sure you want to shut down the bot? This will disconnect it from Discord and stop all services.'),
    confirmLabel: 'Yes, Shut Down',
    cancelLabel: 'Cancel'
  }, async (btn) => {
    await btn.update({ embeds: [embed('Shutting Down', 'Goodbye! The bot is now shutting down.')], components: [] });
    process.exit(0);
  }, async (btn) => {
    await btn.update({ embeds: [embed('Cancelled', 'Shutdown cancelled. The bot will continue running.')], components: [] });
  });
}

module.exports = { default: stopCommand };
