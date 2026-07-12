import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getJtcConfig, setJtcConfig, deleteJtcConfig } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel', true);
    const category = interaction.options.getChannel('category') as any;
    const format = interaction.options.getString('format') || undefined;

    setJtcConfig(guildId, {
      channel_id: channel.id,
      category_id: category?.id || undefined,
      voice_format: format,
    });

    const e = embed('Join-to-Create', `Channel: <#${channel.id}>\nCategory: ${category ? `<#${category.id}>` : '*default*'}\nFormat: \`${format || "{user}'s Channel"}\``).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    deleteJtcConfig(guildId);
    await interaction.reply({ embeds: [embed('Join-to-Create Disabled', 'Join-to-Create voice channels have been disabled.').setColor(COLORS.danger)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'view') {
    const config = getJtcConfig(guildId);
    const e = embed('Join-to-Create Config', `
Trigger Channel: ${config.channel_id ? `<#${config.channel_id}>` : '*not set*'}
Category: ${config.category_id ? `<#${config.category_id}>` : '*default*'}
Voice Format: \`${config.voice_format}\`
    `.trim()).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
