import { ChatInputCommandInteraction, Message, AttachmentBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } from 'discord.js';
import { embed } from '../utils/embed';
import { getLevelData, progressToNext, getRank, getWeeklyRank } from '../utils/levels';
import { renderRankCard, renderAnimatedRankCard } from '../utils/rankCardRenderer';
import { getCardConfig, setCardConfig, resetCardConfig } from '../utils/rankCards';
import { listLevelRoles } from '../utils/levelRoles';

// ── Constants ──

const FONT_STACK = "'DIN', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

interface ColorPreset {
  name: string;
  emoji: string;
  bg: string;
  accent: string;
  bar: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Dark Gold',     emoji: '🌟', bg: '#0c0f17', accent: '#f2c866', bar: '#f2c866' },
  { name: 'Pastel Pink',   emoji: '🌸', bg: '#1a0f14', accent: '#EC4899', bar: '#F472B6' },
  { name: 'Ocean Teal',    emoji: '🌊', bg: '#0a1628', accent: '#4ef2d2', bar: '#4ef2d2' },
  { name: 'Midnight Purple',emoji:'🌙', bg: '#0f0a1a', accent: '#a855f7', bar: '#a855f7' },
  { name: 'Forest Green',  emoji: '🌲', bg: '#0a140a', accent: '#22c55e', bar: '#22c55e' },
  { name: 'Sunset Orange', emoji: '🌅', bg: '#1a0f0a', accent: '#f97316', bar: '#f97316' },
  { name: 'Frost Blue',     emoji: '🧊', bg: '#0a101a', accent: '#3b82f6', bar: '#60a5fa' },
  { name: 'Crimson',       emoji: '❤️', bg: '#1a0a0a', accent: '#ef4444', bar: '#ef4444' },
  { name: 'Cyberpunk',     emoji: '🤖', bg: '#0a0014', accent: '#06b6d4', bar: '#f59e0b' },
  { name: 'Monochrome',    emoji: '⬜', bg: '#111111', accent: '#ffffff', bar: '#888888' },
  { name: 'Strawberry',    emoji: '🍓', bg: '#1a0a12', accent: '#f43f5e', bar: '#fb7185' },
  { name: 'Royal Blue',    emoji: '👑', bg: '#080e24', accent: '#6366f1', bar: '#818cf8' },
  { name: 'Lime Punch',    emoji: '🍋', bg: '#0f1a0a', accent: '#a3e635', bar: '#65a30d' },
  { name: 'Plum Wine',     emoji: '🍷', bg: '#140a12', accent: '#d946ef', bar: '#e879f9' },
  { name: 'Slate',         emoji: '🪨', bg: '#0f1117', accent: '#94a3b8', bar: '#64748b' },
];

const AVATAR_STYLES = [
  { label: 'Circle',   value: 'circle',   emoji: '⭕' },
  { label: 'Hexagon',  value: 'hexagon',  emoji: '🔶' },
  { label: 'Square',   value: 'square',   emoji: '🔲' },
];

// ── Helpers ──

function presetToPartial(p: ColorPreset) {
  return { backgroundColor: p.bg, accentColor: p.accent, barColor: p.bar };
}

function formatMsgs(n: number): string {
  const avgXpPerMsg = 20;
  return `${Math.ceil(n / avgXpPerMsg)}`;
}

// ── Render the rank card (shared by slash + prefix) ──

async function sendRank(target: any, guild: any, channelOrInteraction: any, isSlash: boolean) {
  const data = getLevelData(target.id, guild.id);
  if (!data || data.xp === 0) {
    if (isSlash) {
      await (channelOrInteraction as ChatInputCommandInteraction).reply({ embeds: [embed('No XP', `${target} hasn't earned any XP yet.`)], flags: MessageFlags.Ephemeral });
    } else {
      await (channelOrInteraction as Message).reply({ embeds: [embed('No XP', `${target} hasn't earned any XP yet.`)] });
    }
    return;
  }

  if (isSlash) {
    await (channelOrInteraction as ChatInputCommandInteraction).deferReply({ flags: MessageFlags.Ephemeral });
  }

  const buf = await renderRankCard(target, guild);
  const attachment = new AttachmentBuilder(buf, { name: 'rank.png' });

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new (require('discord.js').MediaGalleryBuilder)().addItems(
        new (require('discord.js').MediaGalleryItemBuilder)().setURL('attachment://rank.png')
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('rank_customise')
            .setLabel('Customise Profile')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('rank_extras')
            .setLabel('Extras')
            .setStyle(ButtonStyle.Secondary),
        )
    );

  if (isSlash) {
    await (channelOrInteraction as ChatInputCommandInteraction).editReply({ files: [attachment], components: [container], flags: MessageFlags.IsComponentsV2 });
  } else {
    await (channelOrInteraction as Message).reply({ files: [attachment], components: [container], flags: MessageFlags.IsComponentsV2 });
  }
}

// ── Customise Profile UI ──

function buildCustomiseContainer(guildId: string, userId: string): ContainerBuilder {
  const cfg = getCardConfig(guildId, userId);
  const presetNames = COLOR_PRESETS.map(p => `**${p.emoji} ${p.name}** — bg: \`${p.bg}\`, accent: \`${p.accent}\``).join('\n');

  return new ContainerBuilder()
    .setAccentColor(0x2B3A67)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🎨 Customise Profile'),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Current settings:**\n` +
        `• Background: \`${cfg.backgroundColor}\`\n` +
        `• Accent: \`${cfg.accentColor}\`\n` +
        `• XP Bar: \`${cfg.barColor}\`\n` +
        `• Avatar: \`${cfg.avatarStyle}\`\n` +
        `• Font: \`${cfg.fontFamily}\``
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Available presets:**\n' + presetNames +
        '\n\nSelect a preset below to apply it immediately. Use the other controls for individual settings.'
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rank_preset')
          .setPlaceholder('Pick a color preset...')
          .addOptions(
            COLOR_PRESETS.map(p => new StringSelectMenuOptionBuilder()
              .setLabel(p.name)
              .setValue(p.name)
              .setDescription(`bg ${p.bg} · accent ${p.accent}`)
              .setEmoji({ name: p.emoji })
            )
          ),
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('rank_avatar_style')
          .setPlaceholder('Avatar border style...')
          .addOptions(
            AVATAR_STYLES.map(s => new StringSelectMenuOptionBuilder()
              .setLabel(s.label)
              .setValue(s.value)
              .setEmoji({ name: s.emoji })
            )
          ),
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rank_customise_reset')
          .setLabel('Reset to Defaults')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('rank_customise_close')
          .setLabel('Done')
          .setStyle(ButtonStyle.Primary),
      ),
    );
}

// ── Extras UI ──

async function buildExtrasContainer(target: any, guild: any): Promise<ContainerBuilder> {
  const data = getLevelData(target.id, guild.id);
  const guildLevelData = data;
  const prog = guildLevelData ? progressToNext(guildLevelData) : null;
  const rank = getRank(target.id, guild.id);
  const weeklyRank = getWeeklyRank(target.id, guild.id);
  const roles = listLevelRoles(guild.id);
  const member = guild.members?.cache?.get(target.id);
  const userRoles = member?.roles?.cache;

  // Progress info
  let progressText = '*No level data available.*';
  if (guildLevelData && prog) {
    const msgsNeeded = formatMsgs(prog.needed - prog.current);
    progressText =
      `**Level ${guildLevelData.level}** — \`${prog.current}/${prog.needed} XP\`\n` +
      `~**${msgsNeeded}** more ${msgsNeeded === '1' ? 'message' : 'messages'} to reach **Level ${guildLevelData.level + 1}**!`;
  }

  // Role rewards
  let roleText = '*No level roles configured.*';
  if (roles.length > 0) {
    const sorted = roles.sort((a, b) => a.level - b.level);
    const lines = sorted.map(r => {
      const unlocked = guildLevelData && guildLevelData.level >= r.level;
      const nextUp = guildLevelData && !unlocked && (!guildLevelData || r.level > guildLevelData.level);
      const hasRole = userRoles?.has(r.roleId) ?? false;
      const roleMention = `<@&${r.roleId}>`;
      if (unlocked && hasRole) return `✅ **Lv ${r.level}** — ${roleMention} *(unlocked)*`;
      if (unlocked && !hasRole) return `⚠️ **Lv ${r.level}** — ${roleMention} *(should assign)*`;
      return `🔒 **Lv ${r.level}** — ${roleMention}`;
    });
    roleText = lines.join('\n');

    // Find next unlockable
    if (guildLevelData) {
      const next = sorted.find(r => r.level > guildLevelData.level);
      if (next) {
        const xpNeeded = (next.level * (next.level + 1) * 50) - guildLevelData.xp;
        roleText += `\n\n**Next unlock:** Lv ${next.level} — ~${formatMsgs(xpNeeded)} messages away`;
      }
    }
  }

  // Rank comparison
  const rankDiff = weeklyRank > 0 ? rank - weeklyRank : 0;
  const rankTrend = rankDiff === 0 ? '— same' : rankDiff > 0 ? `⬆ ${rankDiff} higher` : `⬇ ${Math.abs(rankDiff)} lower`;

  return new ContainerBuilder()
    .setAccentColor(0x2B3A67)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`📊 ${target.username} — Rank Extras`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Progress to next level**\n${progressText}`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Role rewards**\n${roleText}`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Rank overview**\n` +
        `All-time: **#${rank}**  •  Weekly: **#${weeklyRank}**\n` +
        `Trend: ${rankTrend}`
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Total XP:** ${guildLevelData?.xp ?? 0}  •  **Weekly XP:** ${guildLevelData?.weeklyXp ?? 0}`
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('rank_extras_compare')
          .setLabel('Compare with another user')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rank_extras_share')
          .setLabel('Share Card')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rank_extras_share_gif')
          .setLabel('Share as GIF')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('rank_extras_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Primary),
      ),
    );
}

// ── Exported handlers for index.ts registry ──

export async function handleRankCustomise(interaction: any) {
  const gid = interaction.guildId;
  const uid = interaction.user.id;
  if (!gid) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This can only be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const container = buildCustomiseContainer(gid, uid);
  await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

export async function handleRankExtras(interaction: any) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This can only be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  // Try the user who owns the original rank card (from the original interaction) or fall back to the button clicker
  const targetId = interaction.user.id;

  // Build a fake user-like object with the required fields
  const member = guild.members?.cache?.get(targetId);
  const target = member?.user ?? { id: targetId, username: interaction.user.username, displayAvatarURL: () => '' };

  const container = await buildExtrasContainer(target, guild);
  await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

export async function handleRankPreset(interaction: any) {
  const gid = interaction.guildId;
  const uid = interaction.user.id;
  if (!gid) return;
  const presetName = interaction.values[0];
  const preset = COLOR_PRESETS.find(p => p.name === presetName);
  if (!preset) return;
  setCardConfig(gid, uid, presetToPartial(preset));
  await interaction.update({ components: [buildCustomiseContainer(gid, uid)] });
}

export async function handleRankAvatarStyle(interaction: any) {
  const gid = interaction.guildId;
  const uid = interaction.user.id;
  if (!gid) return;
  const style = interaction.values[0];
  setCardConfig(gid, uid, { avatarStyle: style });
  await interaction.update({ components: [buildCustomiseContainer(gid, uid)] });
}

export async function handleRankCustomiseReset(interaction: any) {
  const gid = interaction.guildId;
  const uid = interaction.user.id;
  if (!gid) return;
  resetCardConfig(gid, uid);
  // Also need to re-render and send the rank card? No, just update the customise container.
  // The user can run /rank again to see the new card.
  await interaction.update({ components: [buildCustomiseContainer(gid, uid)] });
}

export async function handleRankCustomiseClose(interaction: any) {
  await interaction.message?.delete().catch(() => {});
  try { await interaction.deferUpdate(); } catch {}
}

export async function handleRankExtrasShare(interaction: any) {
  // Re-render the card and post it to the current channel so everyone can see
  const guild = interaction.guild;
  if (!guild || !interaction.channel) {
    await interaction.reply({ embeds: [embed('Error', 'Cannot share here.')], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = guild.members?.cache?.get(interaction.user.id);
  const target = member?.user ?? interaction.user;
  const buf = await renderRankCard(target, guild);
  const attachment = new AttachmentBuilder(buf, { name: 'rank.png' });

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new (require('discord.js').MediaGalleryBuilder)().addItems(
        new (require('discord.js').MediaGalleryItemBuilder)().setURL('attachment://rank.png')
      )
    );

  try {
    await (interaction.channel as any).send({ files: [attachment], components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.editReply({ embeds: [embed('Shared!', 'Your rank card was posted to this channel.')], flags: MessageFlags.Ephemeral });
  } catch {
    await interaction.editReply({ embeds: [embed('Error', 'Could not share the card.')], flags: MessageFlags.Ephemeral });
  }
}

export async function handleRankExtrasShareGif(interaction: any) {
  const guild = interaction.guild;
  if (!guild || !interaction.channel) {
    await interaction.reply({ embeds: [embed('Error', 'Cannot share here.')], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = guild.members?.cache?.get(interaction.user.id);
  const target = member?.user ?? interaction.user;
  const buf = await renderAnimatedRankCard(target, guild);
  const attachment = new AttachmentBuilder(buf, { name: 'rank.gif' });

  try {
    await (interaction.channel as any).send({ files: [attachment] });
    await interaction.editReply({ embeds: [embed('Shared!', 'Your animated rank card was posted to this channel.')], flags: MessageFlags.Ephemeral });
  } catch {
    await interaction.editReply({ embeds: [embed('Error', 'Could not share the animated card.')], flags: MessageFlags.Ephemeral });
  }
}

export async function handleRankExtrasCompare(interaction: any) {
  // Opens a user-select modal — for now, prompt the user to mention a user
  await interaction.reply({
    embeds: [embed('Compare', 'Mention a user in chat to compare ranks with them!')],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleRankExtrasClose(interaction: any) {
  await interaction.message?.delete().catch(() => {});
  try { await interaction.deferUpdate(); } catch {}
}

// ── Slash command handler ──

async function rankCommand(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  await sendRank(target, interaction.guild, interaction, true);
}

async function rankMessageCommand(message: Message) {
  const target = message.mentions.users?.first() ?? message.author;
  if (!message.guild) {
    await message.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')] });
    return;
  }
  await sendRank(target, message.guild, message, false);
}

module.exports = {
  default: rankCommand,
  rankMessageCommand,
  handleRankCustomise,
  handleRankExtras,
  handleRankPreset,
  handleRankAvatarStyle,
  handleRankCustomiseReset,
  handleRankCustomiseClose,
  handleRankExtrasShare,
  handleRankExtrasShareGif,
  handleRankExtrasCompare,
  handleRankExtrasClose,
};