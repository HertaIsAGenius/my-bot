import {
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getDashboardChannel, setDashboardChannel, getDashboardMessage, setDashboardMessage } from '../utils/modDashboard';
import { getModCases, getModCase, createModCase } from '../utils/db';

// ─── Slash command: /moddashboard setup ───

async function moddashboardCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'setup') {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [embed('Invalid Channel', 'Run this command in a text channel.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const panel = buildMainPanel(interaction.guild);
    const msg = await (channel as TextChannel).send(panel);

    setDashboardChannel(interaction.guild.id, channel.id);
    setDashboardMessage(interaction.guild.id, msg.id);

    await interaction.reply({ embeds: [embed('Dashboard Set Up', `Mod dashboard created in ${channel}.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    const channelId = getDashboardChannel(interaction.guild.id);
    if (channelId) {
      const ch = interaction.guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (ch) {
        const msgId = getDashboardMessage(interaction.guild.id);
        if (msgId) {
          try {
            const msg = await ch.messages.fetch(msgId);
            await msg.delete();
          } catch { /* ignore */ }
        }
      }
    }
    setDashboardChannel(interaction.guild.id, null);
    setDashboardMessage(interaction.guild.id, null);
    await interaction.reply({ embeds: [embed('Dashboard Removed', 'Mod dashboard removed.')], flags: MessageFlags.Ephemeral });
  }
}

// ─── Build panel embeds ───

function buildMainPanel(guild: any) {
  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle('Mod Dashboard')
    .setDescription('Control panel for moderation actions. Use the buttons below.')
    .addFields(
      { name: 'Members', value: `${guild.memberCount || '?'}`, inline: true },
      { name: 'Your Perms', value: 'Moderate Members', inline: true },
    )
    .setFooter({ text: 'Click a button to perform an action' });

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('moddash_lookup').setLabel('User Lookup').setEmoji('🔍').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('moddash_cases').setLabel('Recent Cases').setEmoji('📋').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('moddash_refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [e], components: [row1, row2] };
}

function buildUserPanel(guildId: string, userId: string, username: string, member: GuildMember | null) {
  const cases = getModCases(guildId, userId).slice(0, 5);
  const desc = [
    `**User:** ${member || `<@${userId}>`} (\`${userId}\`)`,
    member ? `**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:R>` : '',
    `**Cases:** ${cases.length}`,
  ].filter(Boolean).join('\n');

  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle(`User: ${username}`)
    .setDescription(desc);

  if (cases.length > 0) {
    e.addFields({
      name: 'Recent Cases',
      value: cases.map(c => `#${c.case_id} ${c.action} — ${c.reason || 'No reason'} — <t:${Math.floor(c.created_at / 1000)}:R>`).join('\n') || 'None',
    });
  }

  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`moddash_warn_${userId}`).setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`moddash_timeout_${userId}`).setLabel('Timeout').setEmoji('🔇').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`moddash_kick_${userId}`).setLabel('Kick').setEmoji('👢').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`moddash_ban_${userId}`).setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
  );

  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`moddash_cases_user_${userId}`).setLabel('View All Cases').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('moddash_main').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [e], components: [actions, nav] };
}

function buildCasesPanel(guildId: string, userId?: string) {
  const allCases = userId ? getModCases(guildId, userId) : getModCases(guildId);
  const cases = allCases.slice(0, 10);

  if (cases.length === 0) {
    const e = embed('Moderation Cases', userId ? `No cases for <@${userId}>.` : 'No cases found.');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('moddash_main').setLabel('Back').setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [e], components: [row] };
  }

  const desc = cases.map(c =>
    `**#${c.case_id}** ${c.action} — <@${c.user_id}> — ${c.reason || 'No reason'} — <t:${Math.floor(c.created_at / 1000)}:R>`
  ).join('\n');

  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle(userId ? `Cases for <@${userId}>` : 'Recent Moderation Cases')
    .setDescription(desc)
    .setFooter({ text: `Showing ${cases.length} of ${allCases.length} cases` });

  const selectRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('moddash_main').setLabel('Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [e], components: [selectRow] };
}

function buildCaseDetailPanel(c: any) {
  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle(`Case #${c.case_id}`)
    .setDescription([
      `**User:** <@${c.user_id}> (\`${c.user_id}\`)`,
      `**Moderator:** <@${c.moderator_id}>`,
      `**Action:** ${c.action}`,
      `**Reason:** ${c.reason || 'No reason provided'}`,
      c.duration ? `**Duration:** ${c.duration} ${c.duration_unit || 'seconds'}` : '',
      `**Date:** <t:${Math.floor(c.created_at / 1000)}:F>`,
    ].filter(Boolean).join('\n'));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('moddash_cases').setLabel('All Cases').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('moddash_main').setLabel('Main Menu').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [e], components: [row] };
}

// ─── Button handler ───

async function handleButton(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const id = interaction.customId;

  if (id === 'moddash_main') {
    const panel = buildMainPanel(interaction.guild);
    await interaction.update(panel);
    return;
  }

  if (id === 'moddash_lookup') {
    const modal = new ModalBuilder()
      .setCustomId('moddash_lookup_modal')
      .setTitle('User Lookup')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Paste the user ID here')
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  if (id === 'moddash_cases') {
    const panel = buildCasesPanel(interaction.guild.id);
    await interaction.update(panel);
    return;
  }

  if (id === 'moddash_refresh') {
    const panel = buildMainPanel(interaction.guild);
    await interaction.update(panel);
    return;
  }

  // User details
  if (id.startsWith('moddash_user_')) {
    const userId = id.replace('moddash_user_', '');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    const username = member?.user?.username || userId;
    const panel = buildUserPanel(interaction.guild.id, userId, username, member);
    await interaction.update(panel);
    return;
  }

  // Cases for user
  if (id.startsWith('moddash_cases_user_')) {
    const userId = id.replace('moddash_cases_user_', '');
    const panel = buildCasesPanel(interaction.guild.id, userId);
    await interaction.update(panel);
    return;
  }

  // View specific case
  if (id.startsWith('moddash_case_')) {
    const caseId = parseInt(id.replace('moddash_case_', ''), 10);
    const c = getModCase(interaction.guild.id, caseId);
    if (!c) {
      await interaction.reply({ embeds: [embed('Not Found', `Case #${caseId} not found.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const panel = buildCaseDetailPanel(c);
    await interaction.update(panel);
    return;
  }

  // Action buttons (warn, timeout, kick, ban)
  const actionMatch = id.match(/^moddash_(warn|timeout|kick|ban)_(\d+)$/);
  if (actionMatch) {
    const action = actionMatch[1];
    const userId = actionMatch[2];

    if (!interaction.memberPermissions?.has('ModerateMembers')) {
      await interaction.reply({ embeds: [embed('Permission Denied', 'You need Moderate Members permission.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`moddash_action_${action}_${userId}`)
      .setTitle(`${action.charAt(0).toUpperCase() + action.slice(1)} User`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Reason for this action')
            .setRequired(true),
        ),
      );

    if (action === 'timeout' || action === 'ban') {
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel(`Duration in seconds (${action === 'timeout' ? 'max 2,419,200' : 'max 604,800'})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(action === 'timeout' ? 'e.g. 3600 for 1 hour' : 'e.g. 86400 for 1 day')
            .setRequired(true),
        ),
      );
    }

    await interaction.showModal(modal);
    return;
  }
}

// ─── Modal handler ───

async function handleModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  // User lookup modal
  if (interaction.customId === 'moddash_lookup_modal') {
    const userId = interaction.fields.getTextInputValue('user_id').trim();
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    const username = member?.user?.username || userId;
    const panel = buildUserPanel(interaction.guild.id, userId, username, member);
    await interaction.reply(panel);
    return;
  }

  // Action modals
  const actionMatch = interaction.customId.match(/^moddash_action_(warn|timeout|kick|ban)_(\d+)$/);
  if (actionMatch) {
    const action = actionMatch[1];
    const userId = actionMatch[2];
    const reason = interaction.fields.getTextInputValue('reason');

    let durationValue: number | undefined;
    if (action === 'timeout' || action === 'ban') {
      const durStr = interaction.fields.getTextInputValue('duration');
      durationValue = parseInt(durStr, 10);
      if (isNaN(durationValue) || durationValue <= 0) {
        await interaction.reply({ embeds: [embed('Invalid Duration', 'Provide a valid number of seconds.')], flags: MessageFlags.Ephemeral });
        return;
      }
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      switch (action) {
        case 'warn': {
          createModCase(interaction.guild.id, userId, interaction.user.id, 'warn', reason);
          await interaction.editReply({ embeds: [embed('Warned', `<@${userId}> has been warned.\n**Reason:** ${reason}`)] });
          break;
        }
        case 'timeout': {
          if (!member) {
            await interaction.editReply({ embeds: [embed('Error', 'User is not in the server.')] });
            return;
          }
          await member.timeout(durationValue! * 1000, reason);
          createModCase(interaction.guild.id, userId, interaction.user.id, 'timeout', reason, { value: durationValue!, unit: 'seconds' });
          await interaction.editReply({ embeds: [embed('Timed Out', `<@${userId}> has been timed out for ${durationValue} seconds.\n**Reason:** ${reason}`)] });
          break;
        }
        case 'kick': {
          if (!member) {
            await interaction.editReply({ embeds: [embed('Error', 'User is not in the server.')] });
            return;
          }
          await member.kick(reason);
          createModCase(interaction.guild.id, userId, interaction.user.id, 'kick', reason);
          await interaction.editReply({ embeds: [embed('Kicked', `<@${userId}> has been kicked.\n**Reason:** ${reason}`)] });
          break;
        }
        case 'ban': {
          await interaction.guild.members.ban(userId, { reason });
          createModCase(interaction.guild.id, userId, interaction.user.id, 'ban', reason);
          await interaction.editReply({ embeds: [embed('Banned', `<@${userId}> has been banned.\n**Reason:** ${reason}`)] });
          break;
        }
      }
    } catch (err: any) {
      await interaction.editReply({ embeds: [embed('Error', `Failed to ${action}: ${err.message || 'Unknown error'}`)] });
    }
    return;
  }
}

module.exports = { default: moddashboardCommand, handleButton, handleModal };
