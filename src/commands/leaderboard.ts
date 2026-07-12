import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';
import { getLeaderboard, xpForLevel, progressToNext } from '../utils/levels';
import { LeaderboardEntry } from '../utils/leaderboardRenderer';
import { loadAvatarBuffer } from '../utils/canvas';
import { createSession, generateToken, renderPageAndBuildContainer } from '../utils/leaderboardSession';

const PAGE_SIZE = 10;
const MAX_ENTRIES = 50;

async function leaderboardCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const entries = getLeaderboard(interaction.guild.id, MAX_ENTRIES);
  if (entries.length === 0) {
    await interaction.editReply({ embeds: [embed('Leaderboard', 'No XP data yet.')] });
    return;
  }

  const members = await Promise.all(entries.map(e =>
    interaction.guild!.members.fetch(e.userId)
      .then(m => ({ user: m.user, nickname: m.displayName }))
      .catch(() => interaction.client.users.fetch(e.userId).then(u => ({ user: u, nickname: u.username })).catch(() => ({ user: null as any, nickname: 'Unknown' })))
  ));

  const lbEntries: LeaderboardEntry[] = [];
  const avatarPromises: Promise<Buffer | null>[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const { user, nickname } = members[i];
    const totalNeeded = xpForLevel(e.level + 1);
    avatarPromises.push(user ? loadAvatarBuffer(user.displayAvatarURL({ extension: 'png', size: 128 })) : Promise.resolve(null));
    lbEntries.push({
      title: nickname,
      username: user?.username || 'Unknown',
      avatarBuffer: null,
      rank: i + 1,
      level: e.level,
      exp: e.xp,
      weeklyExp: e.weeklyXp,
      expMax: totalNeeded,
    });
  }
  const avatarBuffers = await Promise.all(avatarPromises);
  for (let i = 0; i < lbEntries.length; i++) {
    lbEntries[i].avatarBuffer = avatarBuffers[i];
  }

  const totalPages = Math.ceil(lbEntries.length / PAGE_SIZE);
  const token = generateToken();
  createSession(token, { entries: lbEntries, guildName: interaction.guild.name, mode: 'overall', page: 1, totalPages });

  const result = await renderPageAndBuildContainer(token);
  if (!result) {
    await interaction.editReply({ embeds: [embed('Error', 'Failed to render leaderboard.')] });
    return;
  }

  await interaction.editReply({ files: result.files, components: result.components, flags: MessageFlags.IsComponentsV2 });
}

module.exports = { default: leaderboardCommand };
