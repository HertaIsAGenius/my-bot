import { LeaderboardEntry, renderLeaderboard } from './leaderboardRenderer';
import { AttachmentBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } from 'discord.js';
import crypto from 'crypto';

interface Session {
  entries: LeaderboardEntry[];
  guildName: string;
  mode: 'overall' | 'weekly';
  page: number;
  totalPages: number;
}

const sessions = new Map<string, Session>();

// Clean up stale sessions every 5 minutes
setInterval(() => {
  sessions.clear();
}, 300_000);

export function createSession(token: string, s: Session) {
  sessions.set(token, s);
}

export function getSession(token: string): Session | undefined {
  return sessions.get(token);
}

export function generateToken(): string {
  return crypto.randomBytes(4).toString('hex');
}

export async function renderPageAndBuildContainer(token: string): Promise<{ files: AttachmentBuilder[]; components: any[] } | null> {
  const session = sessions.get(token);
  if (!session) return null;

  const { entries, guildName, mode, page, totalPages } = session;
  const pageSize = 10;
  const start = (page - 1) * pageSize;
  const pageEntries = entries.slice(start, start + pageSize);

  if (pageEntries.length === 0) return null;

  const title = mode === 'weekly' ? `${guildName} — WEEKLY LEADERBOARD` : `${guildName} — LEADERBOARD`;
  const buf = await renderLeaderboard({ title, entries: pageEntries, mode });
  const attachment = new AttachmentBuilder(buf, { name: 'leaderboard.png' });

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder().setURL('attachment://leaderboard.png')
        )
    );

  if (totalPages > 1) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(`lb_prev_${token}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1);
    const pageLabel = new ButtonBuilder()
      .setCustomId(`lb_page_${token}`)
      .setLabel(`Page ${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const nextBtn = new ButtonBuilder()
      .setCustomId(`lb_next_${token}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages);

    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, pageLabel, nextBtn)
    );
  }

  return { files: [attachment], components: [container] };
}

export async function handleLeaderboardPage(interaction: any, direction: 'prev' | 'next') {
  const customId = interaction.customId as string;
  const token = customId.slice(8); // 'lb_prev_' / 'lb_next_' = both 8 chars
  const session = sessions.get(token);
  if (!session) {
    await interaction.reply({ content: 'This leaderboard session has expired. Run the command again.', flags: MessageFlags.Ephemeral });
    return;
  }

  session.page += direction === 'next' ? 1 : -1;
  session.page = Math.max(1, Math.min(session.page, session.totalPages));

  const result = await renderPageAndBuildContainer(token);
  if (!result) {
    await interaction.reply({ content: 'Failed to render page.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.update({ files: result.files, components: result.components });
}
