import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ComponentType,
  Message,
  StringSelectMenuInteraction,
  PermissionsBitField,
  MessageFlags
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { setMessageLoggingEnabled, setReactionLoggingEnabled, isMessageLoggingEnabled, isReactionLoggingEnabled } from '../utils/logs';

async function loggingCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  const isMessages = sub === 'messages';
  const current = isMessages
    ? isMessageLoggingEnabled(guildId)
    : isReactionLoggingEnabled(guildId);

  const label = isMessages ? 'Message Logging' : 'Reaction Logging';
  const statusText = current ? 'currently enabled' : 'currently disabled';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const select = new StringSelectMenuBuilder()
    .setCustomId('logging_select')
    .setPlaceholder('Toggle this setting...')
    .addOptions([
      { label: 'Turn On', value: 'on', description: `Enable ${label.toLowerCase()}` },
      { label: 'Turn Off', value: 'off', description: `Disable ${label.toLowerCase()}` }
    ]);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${label}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${label} is **${statusText}** guild-wide. When enabled, all ${isMessages ? 'messages' : 'reactions'} are recorded to a local JSONL file for review.`))
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
      await sel.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const enabled = sel.values[0] === 'on';

    if (isMessages) {
      setMessageLoggingEnabled(guildId, enabled);
    } else {
      setReactionLoggingEnabled(guildId, enabled);
    }

    const result = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${label} ${enabled ? 'Enabled' : 'Disabled'}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${label} has been turned **${enabled ? 'on' : 'off'}** guild-wide.`));

    await sel.update({ components: [result] });
  });

  col.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await msg.edit({ components: [] }); } catch {}
    }
  });
}

module.exports = { default: loggingCommand };
