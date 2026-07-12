import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ComponentType,
  Message,
  ChannelSelectMenuInteraction,
  StringSelectMenuInteraction,
  PermissionsBitField,
  ChannelType,
  MessageFlags
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { setModeratorChannel } from '../utils/tickets';
import { setMessageLoggingEnabled, setReactionLoggingEnabled } from '../utils/logs';

async function modChannelCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('modchannel_channel_select')
    .setPlaceholder('Choose a channel...')
    .setChannelTypes(ChannelType.GuildText);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Set Moderator Channel'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a text channel where the bot will send ticket reports and moderation alerts.'))
    .addActionRowComponents(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect));

  const msg = await (interaction.channel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const col = msg.createMessageComponentCollector<ComponentType.ChannelSelect>({
    componentType: ComponentType.ChannelSelect,
    time: 60000,
    max: 1
  });

  col.on('collect', async (sel: ChannelSelectMenuInteraction) => {
    if (sel.user.id !== interaction.user.id) {
      await sel.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const channelId = sel.values[0];
    setModeratorChannel(interaction.guild!.id, channelId);

    const logSelect = new StringSelectMenuBuilder()
      .setCustomId('modchannel_log_select')
      .setPlaceholder('Select logging options...')
      .setMinValues(0)
      .setMaxValues(2)
      .addOptions([
        { label: 'Log Messages', value: 'messages', description: 'Record all messages sent in this channel' },
        { label: 'Log Reactions', value: 'reactions', description: 'Record all reactions in this channel' },
        { label: 'Skip -- no logging', value: 'skip', description: 'Do not enable any logging' }
      ]);

    const logContainer = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Configure Logging'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Channel set to <#${channelId}>. Would you like to enable message or reaction logging for this channel as well?`))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(logSelect));

    await sel.update({ components: [logContainer] });

    const logCol = msg.createMessageComponentCollector<ComponentType.StringSelect>({
      componentType: ComponentType.StringSelect,
      time: 60000,
      max: 1
    });

    logCol.on('collect', async (logSel: StringSelectMenuInteraction) => {
      if (logSel.user.id !== interaction.user.id) {
        await logSel.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const values = logSel.values;
      if (!values.includes('skip')) {
        if (values.includes('messages')) {
          setMessageLoggingEnabled(interaction.guild!.id, true, channelId);
        }
        if (values.includes('reactions')) {
          setReactionLoggingEnabled(interaction.guild!.id, true, channelId);
        }
      }

      const parts: string[] = values.includes('skip') ? ['no logging enabled'] : values;
      const result = new ContainerBuilder()
        .setAccentColor(COLORS.accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Moderator Channel Configured'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Notifications will be sent to <#${channelId}>.\n\nLogging: ${parts.join(', ')}`));

      await logSel.update({ components: [result] });
    });

    logCol.on('end', async (collected) => {
      if (collected.size === 0) {
        try { await msg.edit({ components: [] }); } catch {}
      }
    });
  });

  col.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await msg.edit({ components: [] }); } catch {}
    }
  });
}

module.exports = { default: modChannelCommand };
