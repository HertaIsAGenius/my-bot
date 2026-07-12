import { ChatInputCommandInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getLeaderboard, xpForLevel } from '../utils/levels';
import { HSR_BG, HSR_GOLD, HSR_TEAL, HSR_MUTE, HSR_DARK, FONT, hexPath, loadAvatarBuffer, backdropSlice, goldAccent } from '../utils/canvas';

const S = 1.2;
const W = Math.round(750 * S);
const H = Math.round(450 * S);
const BORDER_COLORS = [HSR_GOLD, '#C0C0C0', '#CD7F32'];
const BORDER_LABELS = ['1ST', '2ND', '3RD'];
const AV_SIZES = [75, 62, 55];

async function top3Command(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const entries = getLeaderboard(interaction.guild.id, 3);
  if (entries.length === 0) {
    await interaction.editReply({ embeds: [embed('No XP', 'No XP data yet.')] });
    return;
  }

  const users = await Promise.all(entries.map(e =>
    interaction.guild!.members.fetch(e.userId)
      .then(m => m.user)
      .catch(() => interaction.client.users.fetch(e.userId).catch(() => null))
  ));

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = HSR_BG;
  ctx.fillRect(0, 0, W, H);

  // Backdrop and accent
  backdropSlice(ctx, W * 0.35, W * 0.22);
  goldAccent(ctx, W * 0.37, 0, W * 0.24, H, 4);
  goldAccent(ctx, W * 0.33, 0, W * 0.20, H, 2);

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(26 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_GOLD;
  ctx.fillText('TOP PLAYERS', W / 2, Math.round(40 * S));
  ctx.textAlign = 'left';

  const centers = [W / 2, W / 4, (3 * W) / 4];
  const yOffsets = [0, Math.round(25 * S), Math.round(25 * S)];

  for (let i = 0; i < entries.length && i < 3; i++) {
    const e = entries[i];
    const user = users[i];
    const cx = centers[i];
    const cy = Math.round(H * 0.42) + yOffsets[i];
    const avSize = Math.round(AV_SIZES[i] * S);
    const bc = BORDER_COLORS[i];
    const totalNeeded = xpForLevel(e.level + 1);

    // Avatar hexagon
    ctx.save();
    hexPath(ctx, cx, cy, avSize);
    ctx.clip();

    if (user) {
      const buf = await loadAvatarBuffer(user.displayAvatarURL({ extension: 'png', size: 256 }));
      if (buf) {
        try {
          const img = await loadImage(buf);
          ctx.drawImage(img, cx - avSize, cy - avSize, avSize * 2, avSize * 2);
        } catch {}
      }
    }
    ctx.restore();

    // Hexagon border
    ctx.strokeStyle = bc;
    ctx.lineWidth = 5;
    hexPath(ctx, cx, cy, avSize + 3);
    ctx.stroke();

    // Rank label above avatar
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `bold ${Math.round(18 * S)}px ${FONT}`;
    ctx.fillStyle = bc;
    ctx.fillText(BORDER_LABELS[i], cx, cy - avSize - Math.round(15 * S));

    // Username
    ctx.textBaseline = 'top';
    ctx.font = `bold ${Math.round(18 * S)}px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    const name = user?.username || 'Unknown';
    ctx.fillText(name.length > 14 ? name.slice(0, 13) + '…' : name, cx, cy + avSize + Math.round(20 * S));

    // Level
    ctx.font = `${Math.round(15 * S)}px ${FONT}`;
    ctx.fillStyle = HSR_GOLD;
    ctx.fillText(`Level ${e.level}`, cx, cy + avSize + Math.round(50 * S));

    // XP
    ctx.font = `${Math.round(14 * S)}px ${FONT}`;
    ctx.fillStyle = HSR_MUTE;
    ctx.fillText(`${e.xp.toLocaleString()} / ${totalNeeded.toLocaleString()}`, cx, cy + avSize + Math.round(75 * S));

    ctx.textAlign = 'left';
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.round(12 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_MUTE;
  ctx.fillText(`${interaction.guild.name.toUpperCase()}  •  LEADERBOARD`, W / 2, H - Math.round(15 * S));

  const buf = await canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buf, { name: 'top3.png' });
  await interaction.editReply({ files: [attachment] });
}

module.exports = { default: top3Command };
