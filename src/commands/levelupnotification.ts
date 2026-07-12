import { ChatInputCommandInteraction, ChannelType, EmbedBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getLevelUpChannel, setLevelUpChannel } from '../utils/levelNotif';

async function levelupnotificationCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'channel') {
    const channel = interaction.options.getChannel('channel') as any;

    if (channel) {
      if (!channel.isTextBased || !channel.isTextBased() || channel.isDMBased()) {
        await interaction.reply({ embeds: [embed('Invalid Channel', 'Please select a text channel.')], flags: MessageFlags.Ephemeral });
        return;
      }
      setLevelUpChannel(interaction.guild.id, channel.id);
      const e = new EmbedBuilder()
        .setColor(COLORS.accent)
        .setTitle('Level-Up Notifications')
        .setDescription(`Level-up messages will be sent to ${channel}.`);
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    } else {
      setLevelUpChannel(interaction.guild.id, null);
      const current = getLevelUpChannel(interaction.guild.id);
      const e = new EmbedBuilder()
        .setColor(COLORS.accent)
        .setTitle('Level-Up Notifications')
        .setDescription(current
          ? `Level-up channel cleared. Messages will go back to the user's current channel.`
          : 'No level-up channel was set.');
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    }
  }
}

module.exports = { default: levelupnotificationCommand };
