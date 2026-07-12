import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { createModCase, getModCases, getModCase, getInfractions, setInfractions } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.commandName;
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const member = interaction.member as any;

  if (!member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Moderate Members permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'ban' || sub === 'kick' || sub === 'timeout' || sub === 'warn' || sub === 'unban' || sub === 'untimeout') {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [embed('Invalid Target', 'You cannot target yourself.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'ban') {
      const deleteDays = interaction.options.getInteger('delete_days') || 0;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (targetMember && !targetMember.bannable) {
          await interaction.editReply({ embeds: [embed('Cannot Ban', 'I cannot ban this user. Check role hierarchy.')] });
          return;
        }
        await guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays });
        createModCase(guildId, target.id, interaction.user.id, 'ban', reason);
        const e = embed('Ban', `Banned ${target.tag}\nReason: ${reason}`).setColor(COLORS.danger);
        await interaction.editReply({ embeds: [e] });
      } catch (err: any) {
        await interaction.editReply({ embeds: [embed('Error', `Failed to ban: ${err.message}`)] });
      }
      return;
    }

    if (sub === 'unban') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const bans = await guild.bans.fetch();
        const banned = bans.get(target.id);
        if (!banned) {
          await interaction.editReply({ embeds: [embed('Not Banned', 'User is not banned.')] });
          return;
        }
        await guild.members.unban(target.id, reason);
        createModCase(guildId, target.id, interaction.user.id, 'unban', reason);
        const e = embed('Unban', `Unbanned ${target.tag}`).setColor(COLORS.success);
        await interaction.editReply({ embeds: [e] });
      } catch (err: any) {
        await interaction.editReply({ embeds: [embed('Error', `Failed to unban: ${err.message}`)] });
      }
      return;
    }

    if (sub === 'kick') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const targetMember = await guild.members.fetch(target.id);
        if (!targetMember.kickable) {
          await interaction.editReply({ embeds: [embed('Cannot Kick', 'I cannot kick this user. Check role hierarchy.')] });
          return;
        }
        await targetMember.kick(reason);
        createModCase(guildId, target.id, interaction.user.id, 'kick', reason);
        const e = embed('Kick', `Kicked ${target.tag}\nReason: ${reason}`).setColor(COLORS.danger);
        await interaction.editReply({ embeds: [e] });
      } catch (err: any) {
        await interaction.editReply({ embeds: [embed('Error', `Failed to kick: ${err.message}`)] });
      }
      return;
    }

    if (sub === 'timeout') {
      const duration = interaction.options.getInteger('duration', true);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const targetMember = await guild.members.fetch(target.id);
        if (!targetMember.moderatable) {
          await interaction.editReply({ embeds: [embed('Cannot Timeout', 'I cannot timeout this user. Check role hierarchy.')] });
          return;
        }
        await targetMember.timeout(duration * 1000, reason);
        createModCase(guildId, target.id, interaction.user.id, 'timeout', reason, { value: duration, unit: 'seconds' });
        const e = embed('Timeout', `Timed out ${target.tag}\nDuration: ${duration}s\nReason: ${reason}`).setColor(COLORS.danger);
        await interaction.editReply({ embeds: [e] });
      } catch (err: any) {
        await interaction.editReply({ embeds: [embed('Error', `Failed to timeout: ${err.message}`)] });
      }
      return;
    }

    if (sub === 'untimeout') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const targetMember = await guild.members.fetch(target.id);
        if (!targetMember.moderatable) {
          await interaction.editReply({ embeds: [embed('Cannot Modify', 'I cannot modify this user.')] });
          return;
        }
        await targetMember.timeout(null, reason);
        createModCase(guildId, target.id, interaction.user.id, 'untimeout', reason);
        const e = embed('Timeout Removed', `Removed timeout for ${target.tag}`).setColor(COLORS.success);
        await interaction.editReply({ embeds: [e] });
      } catch (err: any) {
        await interaction.editReply({ embeds: [embed('Error', `Failed to remove timeout: ${err.message}`)] });
      }
      return;
    }

    if (sub === 'warn') {
      const existing = getInfractions(guildId, target.id);
      existing.push({ type: 'warn', reason, moderatorId: interaction.user.id, createdAt: Date.now() });
      setInfractions(guildId, target.id, existing);
      createModCase(guildId, target.id, interaction.user.id, 'warn', reason);

      try {
        await target.send(`You have been warned in **${guild.name}**.\nReason: ${reason}`);
      } catch {}

      const e = embed('Warn', `Warned ${target.tag}\nReason: ${reason}`).setColor(COLORS.warning);
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
      return;
    }
  }

  if (sub === 'purge') {
    const amount = interaction.options.getInteger('amount', true);
    if (amount < 1 || amount > 100) {
      await interaction.reply({ embeds: [embed('Invalid Amount', 'Amount must be between 1-100.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (!member?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Messages permission.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const channel = interaction.channel as any;
    if (!channel?.isTextBased()) {
      await interaction.reply({ embeds: [embed('Error', 'This command only works in text channels.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const messages = await channel.bulkDelete(amount, true).catch(() => null);
    if (messages) {
      await interaction.reply({ embeds: [embed('Purge Complete', `Deleted ${messages.size} messages.`)], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [embed('Error', 'Could not delete messages.')], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (sub === 'lock' || sub === 'unlock') {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const ch = channel as any;
    if (!ch?.isTextBased()) {
      await interaction.reply({ embeds: [embed('Error', 'Cannot lock/unlock this channel type.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const isLock = sub === 'lock';
    try {
      await ch.permissionOverwrites.edit(guild.id, {
        SendMessages: isLock ? false : null,
      });
      await interaction.reply({ embeds: [embed(`${isLock ? 'Locked' : 'Unlocked'}`, `${isLock ? 'Locked' : 'Unlocked'} ${ch}.`)], flags: MessageFlags.Ephemeral });
    } catch (err: any) {
      await interaction.reply({ embeds: [embed('Error', `Failed: ${err.message}`)], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (sub === 'cases') {
    const target = interaction.options.getUser('user');
    const cases = target
      ? getModCases(guildId, target.id).slice(0, 10)
      : getModCases(guildId).slice(0, 10);
    if (cases.length === 0) {
      await interaction.reply({ embeds: [embed('Moderation Cases', 'No moderation cases found.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = cases.map((c: any) => `**#${c.case_id}** ${c.action} — <@${c.user_id}> — ${c.reason || 'No reason'} — <t:${Math.floor(c.created_at / 1000)}:R>`).join('\n');
    const e = embed('Moderation Cases', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'case') {
    const caseId = interaction.options.getInteger('id', true);
    const c = getModCase(guildId, caseId);
    if (!c) {
      await interaction.reply({ embeds: [embed('Case Not Found', 'Case not found.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const e = embed(`Case #${c.case_id}`, `
**User:** <@${c.user_id}>
**Moderator:** <@${c.moderator_id}>
**Action:** ${c.action}
**Reason:** ${c.reason || 'No reason'}
**Duration:** ${c.duration ? `${c.duration} ${c.duration_unit || 'seconds'}` : 'N/A'}
**Date:** <t:${Math.floor(c.created_at / 1000)}:F>
    `.trim()).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
