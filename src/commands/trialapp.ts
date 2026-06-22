import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getTrialAppChannel, setTrialAppChannel } from '../utils/trialapps';

async function trialappCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
    return;
  }

  const group = interaction.options.getSubcommandGroup();
  const sub = interaction.options.getSubcommand();

  if (group === 'channel' && sub === 'set') {
    const channel = interaction.options.getChannel('channel') as any;
    if (!channel || !channel.isTextBased || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ content: 'Please select a valid text channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    setTrialAppChannel(interaction.guild.id, channel.id);
    const embed = new EmbedBuilder()
      .setColor(0x2B3A67)
      .setTitle('Trial App Channel')
      .setDescription(`Application threads will be created in ${channel}.`);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'channel' && sub === 'remove') {
    setTrialAppChannel(interaction.guild.id, null);
    const embed = new EmbedBuilder()
      .setColor(0x2B3A67)
      .setTitle('Trial App Channel')
      .setDescription('Application channel cleared. Use `/trialapp channel set #channel` to set one.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

module.exports = { default: trialappCommand };
