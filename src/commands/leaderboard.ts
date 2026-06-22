import { ChatInputCommandInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getLeaderboard, xpForLevel, progressToNext } from '../utils/levels';
import { HSR_BG, HSR_GOLD, HSR_TEAL, HSR_MUTE, HSR_DARK, HSR_BAR_BG, FONT, hexPath, loadAvatarBuffer, backdropSlice, goldAccent } from '../utils/canvas';

const S = 1.2;
const ROW_H = Math.round(90 * S);
const HEADER_H = Math.round(70 * S);
const PAD = Math.round(20 * S);
const W = Math.round(900 * S);
const LIMIT = 5;

async function leaderboardCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const entries = getLeaderboard(interaction.guild.id, LIMIT);
  if (entries.length === 0) {
    await interaction.reply({
      embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x2B3A67).setTitle('Leaderboard').setDescription('No XP data yet.')]
    });
    return;
  }

  const users = await Promise.all(entries.map(e =>
    interaction.guild!.members.fetch(e.userId)
      .then(m => m.user)
      .catch(() => interaction.client.users.fetch(e.userId).catch(() => null))
  ));

  const totalH = HEADER_H + entries.length * ROW_H + Math.round(30 * S);
  const canvas = createCanvas(W, totalH);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = HSR_BG;
  ctx.fillRect(0, 0, W, totalH);

  // Backdrop and accents
  backdropSlice(ctx, W * 0.35, W * 0.22);
  goldAccent(ctx, W * 0.37, 0, W * 0.24, totalH, 4);

  // Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(22 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_GOLD;
  ctx.fillText(`${interaction.guild.name} — LEADERBOARD`, PAD, Math.round(20 * S));

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const user = users[i];
    const y = HEADER_H + i * ROW_H;
    const rank = i + 1;
    const isTop3 = i < 3;
    const rankColors = [HSR_GOLD, '#C0C0C0', '#CD7F32'];
    const rc = isTop3 ? rankColors[i] : HSR_MUTE;
    const totalNeeded = xpForLevel(e.level + 1);
    const prog = progressToNext(e);
    const pct = Math.min(prog.percent, 1);

    // Row background
    ctx.fillStyle = i % 2 === 0 ? 'rgba(20, 26, 38, 0.5)' : 'rgba(12, 15, 23, 0.5)';
    ctx.fillRect(0, y, W, ROW_H);

    // Rank hex badge
    const badgeR = Math.round(18 * S);
    const badgeCx = PAD + badgeR + Math.round(5 * S);
    const badgeCy = y + ROW_H / 2;
    ctx.fillStyle = rc + '33';
    hexPath(ctx, badgeCx, badgeCy, badgeR);
    ctx.fill();
    ctx.strokeStyle = rc;
    ctx.lineWidth = 2;
    hexPath(ctx, badgeCx, badgeCy, badgeR);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(16 * S)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`#${rank}`, badgeCx, badgeCy);
    ctx.textAlign = 'left';

    // Avatar hex
    const avR = Math.round(28 * S);
    const avCx = badgeCx + badgeR + Math.round(25 * S);
    const avCy = y + ROW_H / 2;

    ctx.save();
    hexPath(ctx, avCx, avCy, avR);
    ctx.clip();
    if (user) {
      const buf = await loadAvatarBuffer(user.displayAvatarURL({ extension: 'png', size: 128 }));
      if (buf) {
        try {
          const img = await loadImage(buf);
          ctx.drawImage(img, avCx - avR, avCy - avR, avR * 2, avR * 2);
        } catch {}
      }
    }
    ctx.restore();

    // Avatar ring
    ctx.strokeStyle = isTop3 ? rc : HSR_TEAL;
    ctx.lineWidth = 2;
    hexPath(ctx, avCx, avCy, avR + 2);
    ctx.stroke();

    const textX = avCx + avR + Math.round(20 * S);

    // Username
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(17 * S)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user?.username || 'Unknown', textX, y + Math.round(12 * S));

    // Level (right-aligned)
    ctx.textAlign = 'right';
    ctx.font = `${Math.round(15 * S)}px ${FONT}`;
    ctx.fillStyle = HSR_GOLD;
    ctx.fillText(`Level ${e.level}`, W - PAD, y + Math.round(12 * S));
    ctx.textAlign = 'left';

    // XP bar
    const barX = textX;
    const barY = y + Math.round(44 * S);
    const barW = Math.round(360 * S);
    const barH = Math.round(12 * S);
    const barR = barH / 2;

    ctx.fillStyle = HSR_BAR_BG;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barR);
    ctx.fill();

    if (pct > 0) {
      ctx.fillStyle = isTop3 ? rc : HSR_TEAL;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, barR);
      ctx.fill();
    }

    // XP text
    ctx.font = `${Math.round(13 * S)}px ${FONT}`;
    ctx.fillStyle = HSR_MUTE;
    ctx.fillText(`${e.xp.toLocaleString()} / ${totalNeeded.toLocaleString()} XP`, textX, y + Math.round(62 * S));
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.round(11 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_MUTE;
  ctx.fillText('Keep chatting to earn XP!', W / 2, totalH - Math.round(8 * S));

  const buf = await canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buf, { name: 'leaderboard.png' });
  await interaction.editReply({ files: [attachment] });
}

module.exports = { default: leaderboardCommand };
