import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getTrialAppChannel, setTrialAppChannel, getForms, removeForm } from '../utils/trialapps';

async function trialappCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const group = interaction.options.getSubcommandGroup();
  const sub = interaction.options.getSubcommand();

  if (group === 'channel' && sub === 'set') {
    const channel = interaction.options.getChannel('channel') as any;
    if (!channel || !channel.isTextBased || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [embed('Invalid Channel', 'Please select a valid text channel.')], flags: MessageFlags.Ephemeral });
      return;
    }
    setTrialAppChannel(interaction.guild.id, channel.id);
    const e = new EmbedBuilder()
      .setColor(COLORS.accent)
      .setTitle('Trial App Channel')
      .setDescription(`Application threads will be created in ${channel}.`);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'channel' && sub === 'remove') {
    setTrialAppChannel(interaction.guild.id, null);
    const e = new EmbedBuilder()
      .setColor(COLORS.accent)
      .setTitle('Trial App Channel')
      .setDescription('Application channel cleared. Use `/trialapp channel set #channel` to set one.');
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'form' && sub === 'list') {
    const forms = getForms(interaction.guild.id);
    if (forms.length === 0) {
      await interaction.reply({ embeds: [embed('No Forms', 'No application forms exist for this server. Use `/makeapp` to create one.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = forms.map((f, i) => `**${i + 1}.** ${f.name} — ${f.questions.length} question(s)`).join('\n');
    const e = new EmbedBuilder()
      .setColor(COLORS.accent)
      .setTitle('Application Forms')
      .setDescription(lines);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'form' && sub === 'remove') {
    const name = interaction.options.getString('name', true);
    const removed = removeForm(interaction.guild.id, name);
    if (!removed) {
      await interaction.reply({ embeds: [embed('Not Found', `No form named "${name}" found. Use \`/trialapp form list\` to see existing forms.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const e = new EmbedBuilder()
      .setColor(COLORS.accent)
      .setTitle('Form Removed')
      .setDescription(`The form **${name}** has been removed.`);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
  }
}

module.exports = { default: trialappCommand };
