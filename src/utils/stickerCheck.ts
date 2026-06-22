import { EmbedBuilder, Message, PermissionsBitField } from 'discord.js';
import { getModeratorChannel } from './tickets';

const accent = 0xCA3A3A;

async function handleStickerMessage(message: Message) {
  if (message.author.bot || !message.guild) return;
  if (!message.messageSnapshots || message.messageSnapshots.size === 0) return;

  const snap = message.messageSnapshots.first();
  if (!snap) return;

  const stickerIds: string[] = [];
  const rawStickers = (snap as any).stickers;
  if (rawStickers) {
    if (Array.isArray(rawStickers)) {
      stickerIds.push(...rawStickers.map((s: any) => s.id).filter(Boolean));
    } else if (rawStickers instanceof Map) {
      stickerIds.push(...[...rawStickers.values()].map((s: any) => s.id).filter(Boolean));
    } else if (typeof rawStickers === 'object') {
      const vals = Object.values(rawStickers);
      stickerIds.push(...vals.map((s: any) => s?.id).filter(Boolean));
    }
  }

  if (stickerIds.length === 0) return;

  const resolved: { id: string; name: string; guildId?: string }[] = [];
  const failed: { id: string }[] = [];

  for (const sid of stickerIds) {
    try {
      let st = message.stickers.get(sid) || message.guild.stickers.cache.get(sid);
      if (!st) st = await message.client.fetchSticker(sid).catch(() => undefined);
      if (st) {
        resolved.push({ id: sid, name: st.name, guildId: (st as any).guildId });
      } else {
        failed.push({ id: sid });
      }
    } catch {
      failed.push({ id: sid });
    }
  }

  const hasExternal = resolved.some((s) => s.guildId && s.guildId !== message.guild!.id);
  const hasFailed = failed.length > 0;
  if (!hasExternal && !hasFailed) return;

  let member = message.member;
  if (!member) {
    try { member = await message.guild.members.fetch(message.author.id); } catch {}
  }
  if (member) {
    const hasPerm = member.permissions.has(PermissionsBitField.Flags.UseExternalStickers, true);
    if (hasPerm) return;
  }

  try { await message.delete(); } catch {}

  const logEmbed = new EmbedBuilder()
    .setColor(accent)
    .setTitle('Sticker Bypass Detected')
    .setDescription('A forwarded message with external stickers was removed.')
    .addFields(
      { name: 'Forwarded by', value: `${message.author} (${message.author.id})`, inline: false },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Stickers found', value: `${resolved.length} resolved, ${failed.length} failed`, inline: true }
    )
    .setTimestamp();

  if (resolved.length > 0) {
    logEmbed.addFields({
      name: 'External stickers',
      value: resolved.filter(s => s.guildId && s.guildId !== message.guild!.id).map(s => `**${s.name}** (${s.id})`).join('\n') || 'None',
      inline: false
    });
  }
  if (failed.length > 0) {
    logEmbed.addFields({ name: 'Unresolvable stickers', value: failed.map(s => s.id).join(', '), inline: false });
  }

  const modChannelId = getModeratorChannel(message.guild.id);
  if (modChannelId) {
    const modChan = message.guild.channels.cache.get(modChannelId);
    if (modChan?.isTextBased()) {
      await modChan.send({ embeds: [logEmbed] }).catch(() => {});
    }
  }
}

module.exports = { default: handleStickerMessage };
