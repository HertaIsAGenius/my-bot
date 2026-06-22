import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';
import { withConfirmFlow } from '../utils/confirmFlow';
import { resetWeeklyXp } from '../utils/levels';

async function weeklyresetCommand(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: 'You need Manage Server permission to reset weekly XP.', flags: MessageFlags.Ephemeral });
    return;
  }

  await withConfirmFlow(interaction, {
    embed: embed('Confirm Weekly Reset', 'Are you sure? This will reset weekly XP for **all members** in this server. This action **cannot be undone**.'),
    confirmLabel: 'Yes, Reset All Weekly XP',
    cancelLabel: 'Cancel'
  }, async (btn) => {
    const count = resetWeeklyXp(guild.id);
    await btn.update({
      embeds: [embed('Weekly XP Reset', `Weekly XP has been reset for **${count}** member(s).`)],
      components: []
    });
  }, async (btn) => {
    await btn.update({ embeds: [embed('Cancelled', 'Weekly XP was not modified.')], components: [] });
  });
}

module.exports = { default: weeklyresetCommand };
