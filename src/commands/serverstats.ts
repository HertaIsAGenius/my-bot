import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ChannelType, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getServerStatsConfig, setServerStatsConfig } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  if (sub === 'set') {
    const category = interaction.options.getChannel('category') as any;
    const prefix = interaction.options.getString('prefix') || '📊';

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = getServerStatsConfig(guildId);
    config.channel_category = category?.id || config.channel_category;

    await guild.members.fetch();
    const members = guild.members.cache;
    const totalMembers = members.size;
    const bots = members.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;

    if (config.member_channel_id) {
      const old = guild.channels.cache.get(config.member_channel_id) as any;
      if (old) await old.delete().catch(() => {});
    }
    const memberCh = await guild.channels.create({
      name: `${prefix} Members: ${humans}`,
      type: ChannelType.GuildVoice,
      parent: config.channel_category || undefined,
      permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }],
    });
    config.member_channel_id = memberCh.id;

    if (config.bot_channel_id) {
      const old = guild.channels.cache.get(config.bot_channel_id) as any;
      if (old) await old.delete().catch(() => {});
    }
    const botCh = await guild.channels.create({
      name: `${prefix} Bots: ${bots}`,
      type: ChannelType.GuildVoice,
      parent: config.channel_category || undefined,
      permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }],
    });
    config.bot_channel_id = botCh.id;

    const voiceMembers = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice)
      .reduce((sum, c) => sum + (c as any).members.size, 0);
    if (config.voice_channel_id) {
      const old = guild.channels.cache.get(config.voice_channel_id) as any;
      if (old) await old.delete().catch(() => {});
    }
    const voiceCh = await guild.channels.create({
      name: `${prefix} Voice: ${voiceMembers}`,
      type: ChannelType.GuildVoice,
      parent: config.channel_category || undefined,
      permissionOverwrites: [{ id: guild.id, deny: ['Connect'] }],
    });
    config.voice_channel_id = voiceCh.id;

    setServerStatsConfig(guildId, config);

    const e = embed('Server Stats', 'Counter channels created/updated.').setColor(COLORS.success);
    await interaction.editReply({ embeds: [e] });
    return;
  }

  if (sub === 'remove') {
    const config = getServerStatsConfig(guildId);
    for (const id of [config.member_channel_id, config.bot_channel_id, config.voice_channel_id]) {
      if (id) {
        const ch = guild.channels.cache.get(id) as any;
        if (ch) await ch.delete().catch(() => {});
      }
    }
    setServerStatsConfig(guildId, { member_channel_id: null, bot_channel_id: null, voice_channel_id: null, channel_category: null });
    await interaction.reply({ embeds: [embed('Counter Channels Removed', 'All server stats counter channels have been removed.').setColor(COLORS.danger)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'view') {
    const config = getServerStatsConfig(guildId);
    const e = embed('Server Stats Config', `
Members: ${config.member_channel_id ? `<#${config.member_channel_id}>` : '*not set*'}
Bots: ${config.bot_channel_id ? `<#${config.bot_channel_id}>` : '*not set*'}
Voice: ${config.voice_channel_id ? `<#${config.voice_channel_id}>` : '*not set*'}
Category: ${config.channel_category ? `<#${config.channel_category}>` : '*not set*'}
    `.trim()).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
