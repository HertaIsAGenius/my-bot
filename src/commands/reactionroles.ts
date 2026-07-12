import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getReactionRoles, getMessageReactionRoles, setReactionRole, removeReactionRole, removeMessageReactionRoles } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (sub === 'create') {
    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title') || 'Reaction Roles';
    const description = interaction.options.getString('description') || 'Select your roles below.';

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildChannel = interaction.guild?.channels.cache.get(channel.id) as any;
    if (!guildChannel?.isTextBased()) {
      await interaction.editReply({ embeds: [embed('Error', 'Invalid channel type.')] });
      return;
    }
    const msg = await guildChannel.send({
      embeds: [embed(title, description).setColor(COLORS.accent)],
      components: [],
    });

    const e = embed('Panel Created', `Panel created in <#${channel.id}>.\nMessage ID: \`${msg.id}\`\n\nUse **/reactionroles add** to add roles to this panel.`).setColor(COLORS.success);
    await interaction.editReply({ embeds: [e] });
    return;
  }

  if (sub === 'add') {
    const channelId = interaction.options.getChannel('channel', true).id;
    const messageId = interaction.options.getString('message_id', true);
    const role = interaction.options.getRole('role', true);
    const label = interaction.options.getString('label') || undefined;
    const emoji = interaction.options.getString('emoji') || '✅';
    const descText = interaction.options.getString('description') || undefined;

    setReactionRole(guildId, messageId, channelId, emoji, role.id, { label, description: descText });

    const roles = getMessageReactionRoles(guildId, messageId);
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rr_sel_${messageId}`)
      .setPlaceholder('Select a role...')
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map((r: any) => new StringSelectMenuOptionBuilder()
          .setLabel(r.label || r.emoji)
          .setValue(r.role_id)
          .setDescription(r.description || undefined)
          .setEmoji(r.emoji.match(/<a?:.+?:\d+>/) ? { id: r.emoji.match(/\d+/)![0] } : r.emoji)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    try {
      const channel = interaction.guild?.channels.cache.get(channelId) as any;
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.edit({ components: [row] });
      }
    } catch {}

    const e = embed('Role Added', `Added ${role} to the reaction panel.\nEmoji: ${emoji}${label ? `\nLabel: ${label}` : ''}`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    const messageId = interaction.options.getString('message_id', true);
    const emoji = interaction.options.getString('emoji');
    if (emoji) {
      removeReactionRole(guildId, messageId, emoji);
      await interaction.reply({ embeds: [embed('Role Removed', `Removed reaction role for emoji ${emoji}.`)], flags: MessageFlags.Ephemeral });
    } else {
      removeMessageReactionRoles(guildId, messageId);
      await interaction.reply({ embeds: [embed('Roles Removed', 'Removed all reaction roles from that message.')], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (sub === 'list') {
    const roles = getReactionRoles(guildId);
    if (roles.length === 0) {
      await interaction.reply({ embeds: [embed('Reaction Roles', 'No reaction roles configured.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = roles.map((r: any) => `[${r.emoji}](https://discord.com/channels/${guildId}/${r.channel_id}/${r.message_id}) → <@&${r.role_id}>${r.label ? ` (${r.label})` : ''}`).join('\n');
    const e = embed('Reaction Roles', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
