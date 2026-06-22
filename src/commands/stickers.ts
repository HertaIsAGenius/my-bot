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
import { COLORS } from '../utils/embed';
import { isStickerDetectionEnabled, setStickerDetectionEnabled } from '../utils/stickers';

async function stickersCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need **Manage Server** permission.', flags: MessageFlags.Ephemeral });
    return;
  }
  const current = isStickerDetectionEnabled(interaction.guild.id);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const select = new StringSelectMenuBuilder()
    .setCustomId('sticker_toggle')
    .setPlaceholder('Select option...')
    .addOptions([
      { label: 'Enable', value: 'on', description: 'Detect and remove forwarded external stickers' },
      { label: 'Disable', value: 'off', description: 'Stop sticker detection' }
    ]);

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Sticker Sentinel'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Sticker detection is currently **${current ? 'enabled' : 'disabled'}**.\n\nDetects forwarded messages containing stickers from other servers and removes them if the sender lacks \`Use External Stickers\` permission.`))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));

  const msg = await (interaction.channel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const sel = await msg.awaitMessageComponent<ComponentType.StringSelect>({
    componentType: ComponentType.StringSelect, time: 60000
  }).catch(() => null);

  if (!sel || sel.user.id !== interaction.user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }

  const enabled = sel.values[0] === 'on';
  setStickerDetectionEnabled(interaction.guild.id, enabled);

  const result = new ContainerBuilder()
    .setAccentColor(COLORS.accent)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Sticker Sentinel'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Sticker detection is now **${enabled ? 'enabled' : 'disabled'}**.`));

  await sel.update({ components: [result] });
}

module.exports = { default: stickersCommand };
