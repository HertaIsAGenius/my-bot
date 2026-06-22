import { ChatInputCommandInteraction, Message, AttachmentBuilder, MessageFlags } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getLevelData, progressToNext, getRank } from '../utils/levels';
import { HSR_BG, HSR_GOLD, HSR_TEAL, HSR_MUTE, HSR_BAR_BG, FONT, hexPath, loadAvatarBuffer, backdropSlice, goldAccent } from '../utils/canvas';

const S = 1.2;
const W = Math.round(900 * S);
const H = Math.round(300 * S);

async function sendRank(target: any, guild: any, channelOrInteraction: any, isSlash: boolean) {
  const data = getLevelData(target.id, guild.id);
  if (!data || data.xp === 0) {
    const msg = `${target} hasn't earned any XP yet.`;
    if (isSlash) {
      await (channelOrInteraction as ChatInputCommandInteraction).reply({ content: msg, flags: MessageFlags.Ephemeral });
    } else {
      await (channelOrInteraction as Message).reply(msg);
    }
    return;
  }

  if (isSlash) {
    await (channelOrInteraction as ChatInputCommandInteraction).deferReply({ flags: MessageFlags.Ephemeral });
  }

  const serverRank = getRank(target.id, guild.id);
  const prog = progressToNext(data);
  const { current: currentXp, needed: requiredXp, percent } = prog;
  const progressPct = Math.min(percent, 1);
  const level = data.level;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = HSR_BG;
  ctx.fillRect(0, 0, W, H);

  // Angled backdrop slice and accent lines
  backdropSlice(ctx, 325, 205);
  goldAccent(ctx, 325, 0, 205, H, 2);
  goldAccent(ctx, 340, 0, 220, H, 4);

  // Hexagon avatar
  ctx.save();
  const avX = Math.round(130 * S);
  const avY = Math.round(150 * S);
  const avSize = Math.round(75 * S);

  hexPath(ctx, avX, avY, avSize);
  ctx.clip();

  const avatarBuf = await loadAvatarBuffer(target.displayAvatarURL({ extension: 'png', size: 256 }));
  if (avatarBuf) {
    try {
      const img = await loadImage(avatarBuf);
      ctx.drawImage(img, avX - avSize, avY - avSize, avSize * 2, avSize * 2);
    } catch {
      ctx.fillStyle = HSR_BAR_BG;
      ctx.fill();
    }
  } else {
    ctx.fillStyle = HSR_BAR_BG;
    ctx.fill();
  }
  ctx.restore();

  // Gold hexagon border
  ctx.strokeStyle = HSR_GOLD;
  ctx.lineWidth = 4;
  hexPath(ctx, avX, avY, avSize + 2);
  ctx.stroke();

  // Username
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.round(34 * S)}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(target.username, Math.round(340 * S), Math.round(55 * S));

  // Rank
  const formattedRank = String(serverRank).padStart(3, '0');
  ctx.font = `${Math.round(16 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_TEAL;
  ctx.fillText(`RANK #${formattedRank}`, Math.round(340 * S), Math.round(100 * S));

  // Level label
  ctx.textAlign = 'right';
  ctx.font = `${Math.round(18 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_GOLD;
  ctx.fillText('TRAILBLAZE LEVEL', Math.round(850 * S), Math.round(45 * S));

  // Level value
  ctx.font = `italic bold ${Math.round(65 * S)}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(level), Math.round(850 * S), Math.round(70 * S));
  ctx.textAlign = 'left';

  // XP label
  ctx.font = `bold ${Math.round(16 * S)}px ${FONT}`;
  ctx.fillStyle = HSR_MUTE;
  ctx.fillText('EXP', Math.round(340 * S), Math.round(180 * S));

  // XP value
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(16 * S)}px ${FONT}`;
  ctx.fillText(`${currentXp} / ${requiredXp}`, Math.round(850 * S), Math.round(180 * S));
  ctx.textAlign = 'left';

  // Progress bar (rounded)
  const barX = Math.round(340 * S);
  const barY = Math.round(205 * S);
  const barWidth = Math.round(510 * S);
  const barHeight = 20;
  const radius = barHeight / 2;
  const progressWidth = barWidth * progressPct;

  ctx.fillStyle = HSR_BAR_BG;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barWidth, barHeight, radius);
  ctx.fill();

  if (progressWidth > 0) {
    ctx.fillStyle = HSR_TEAL;
    ctx.beginPath();
    ctx.roundRect(barX, barY, progressWidth, barHeight, radius);
    ctx.fill();
  }

  // Tech square accent
  ctx.fillStyle = HSR_GOLD;
  const sqX = Math.round(855 * S);
  ctx.fillRect(sqX, barY + (barHeight - 6) / 2, 6, 6);

  const buf = await canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buf, { name: 'hsr-rank.png' });

  if (isSlash) {
    await (channelOrInteraction as ChatInputCommandInteraction).editReply({ files: [attachment] });
  } else {
    await (channelOrInteraction as Message).reply({ files: [attachment] });
  }
}

async function rankCommand(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  await sendRank(target, interaction.guild, interaction, true);
}

async function rankMessageCommand(message: Message) {
  const target = message.mentions.users?.first() ?? message.author;
  if (!message.guild) {
    await message.reply('This command must be used in a server.');
    return;
  }
  await sendRank(target, message.guild, message, false);
}

module.exports = { default: rankCommand, rankMessageCommand };
