import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ComponentType,
  Message,
  StringSelectMenuInteraction,
  TextChannel,
  NewsChannel,
  PermissionsBitField,
  MessageFlags
} from 'discord.js';
import { COLORS } from '../utils/embed';
import { autoSlowmode } from '../utils/autoSlowmode';
import { enableSlowmodeChannel, disableSlowmodeChannel } from '../utils/slowmodeConfig';

async function slowmodeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
    return;
  }

  const channel = interaction.channel;
  if (!channel?.isTextBased() || channel.isDMBased() || channel.isThread()) {
    await interaction.reply({ content: 'This command only works in text channels.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const select = new StringSelectMenuBuilder()
    .setCustomId('slowmode_select')
    .setPlaceholder('Choose an option...')
    .addOptions([
      { label: 'Enable', value: 'enable', description: 'Turn on auto slowmode for this channel' },
      { label: 'Disable', value: 'disable', description: 'Turn off auto slowmode for this channel' }
    ]);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Auto Slowmode'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Configure auto slowmode for **#${(channel as any).name}**. When enabled, the bot will automatically apply a 10-second slowmode if message activity exceeds 20 messages in 10 seconds, and remove it once traffic normalizes.`))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));

  const msg = await (interaction.channel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const col = msg.createMessageComponentCollector<ComponentType.StringSelect>({
    componentType: ComponentType.StringSelect,
    time: 60000,
    max: 1
  });

  col.on('collect', async (sel: StringSelectMenuInteraction) => {
    if (sel.user.id !== interaction.user.id) {
      await sel.reply({ content: 'These controls are not for you.', flags: MessageFlags.Ephemeral });
      return;
    }

    const choice = sel.values[0];

    if (choice === 'enable') {
      enableSlowmodeChannel(channel.id);
      autoSlowmode.enableChannel(channel.id);
      const result = new ContainerBuilder()
        .setAccentColor(COLORS.accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Slowmode Enabled'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Auto slowmode is now active in **#${(channel as any).name}**. The bot will monitor message frequency and adjust slowmode as needed.`));
      await sel.update({ components: [result] });
    } else {
      disableSlowmodeChannel(channel.id);
      await autoSlowmode.disableChannel(channel as TextChannel | NewsChannel);
      const result = new ContainerBuilder()
        .setAccentColor(COLORS.accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Slowmode Disabled'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Auto slowmode has been turned off for **#${(channel as any).name}**. Any existing slowmode has been removed.`));
      await sel.update({ components: [result] });
    }
  });

  col.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await msg.edit({ components: [] }); } catch {}
    }
  });
}

module.exports = { default: slowmodeCommand };
