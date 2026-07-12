import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';

async function styledEmbedCommand(interaction: ChatInputCommandInteraction) {
  const title = interaction.options.getString('title') || 'Styled Embed';
  const description = interaction.options.getString('description') || 'Select an option below.';

  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'Must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const select = new StringSelectMenuBuilder()
      .setCustomId('styledembed_opt')
      .setPlaceholder('Choose an option')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Option A').setValue('a').setDescription('First option'),
        new StringSelectMenuOptionBuilder().setLabel('Option B').setValue('b').setDescription('Second option'),
        new StringSelectMenuOptionBuilder().setLabel('Option C').setValue('c').setDescription('Third option')
      );

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(description))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));

    const channel = interaction.channel!;
    await (channel as any).send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    await interaction.editReply({ embeds: [embed('Sent', 'Styled embed sent.')] });
  } catch (e: any) {
    await interaction.editReply({ embeds: [embed('Error', `Error: ${e.message}`)] });
  }
}

module.exports = { default: styledEmbedCommand };
