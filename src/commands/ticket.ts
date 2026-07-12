import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  Message,
  Guild,
  User,
  PermissionsBitField,
  MessageFlags
} from 'discord.js';
import { embedColored, COLORS } from '../utils/embed';
import { getTickets, getTicket, getTicketByChannel, createTicket, claimTicket, addNote, closeTicket, reopenTicket, updateTicket, searchTickets, getTicketStats, Ticket } from '../utils/tickets';
import { getTicketConfig, setTicketConfig, setPingRole, getPingRole, CATEGORY_LABELS, CATEGORY_COLORS, TicketCategory, THREAD_CATEGORY_LABELS, ThreadCategory } from '../utils/ticketConfig';
import { generateTranscript } from '../utils/transcripts';

const embed = (title: string, desc?: string) => embedColored(COLORS.info, title, desc);

function priorityColor(p: string) {
  switch (p) {
    case 'urgent': return 0xF44336;
    case 'high': return 0xFFA726;
    case 'low': return 0x66BB6A;
    default: return 0x4FC3F7;
  }
}

function ticketEmbed(t: Ticket) {
  const e = embed(`Ticket #${t.id} — ${CATEGORY_LABELS[t.category]}`)
    .setColor(priorityColor(t.priority))
    .addFields(
      { name: 'Creator', value: `<@${t.creatorId}>`, inline: true },
      { name: 'Status', value: t.status.charAt(0).toUpperCase() + t.status.slice(1), inline: true },
      { name: 'Priority', value: t.priority.charAt(0).toUpperCase() + t.priority.slice(1), inline: true },
      { name: 'Subject', value: t.subject || 'No subject', inline: false },
      { name: 'Created', value: `<t:${Math.floor(t.createdAt / 1000)}:f>`, inline: true }
    );
  if (t.claimedBy) e.addFields({ name: 'Claimed by', value: `<@${t.claimedBy}>`, inline: true });
  if (t.closedBy) {
    e.addFields(
      { name: 'Closed by', value: `<@${t.closedBy}>`, inline: true },
      { name: 'Reason', value: t.closeReason || 'No reason', inline: false }
    );
  }
  if (t.notes.length > 0) {
    const noteText = t.notes.slice(-3).map(n => `<@${n.authorId}>: ${n.content.slice(0, 100)}`).join('\n');
    e.addFields({ name: `Recent Notes (${t.notes.length})`, value: noteText, inline: false });
  }
  return e;
}

// ── Config ─────────────────────────────────────────────

async function configFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const config = getTicketConfig(guild.id);
  const sub = interaction.options.getSubcommand(true);

  if (sub === 'view') {
    const pingLines = Object.entries(config.pingRoles)
      .filter(([, r]) => r)
      .map(([c, r]) => `${THREAD_CATEGORY_LABELS[c as ThreadCategory] || c}: <@&${r}>`);
    const lines = [
      `**Ticket Category:** ${config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : '*Not set*'}`,
      `**Log Channel:** ${config.loggingChannelId ? `<#${config.loggingChannelId}>` : '*Not set*'}`,
      `**Support Roles:** ${config.supportRoleIds.length > 0 ? config.supportRoleIds.map(r => `<@&${r}>`).join(', ') : '*None*'}`,
      `**Ping Roles:** ${pingLines.length > 0 ? pingLines.join('\n') : '*None set*'}`
    ];
    await interaction.reply({ embeds: [embed('Ticket Configuration', lines.join('\n'))], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'category') {
    const cat = interaction.options.getChannel('channel', true);
    setTicketConfig(guild.id, { ticketCategoryId: cat.id });
    await interaction.reply({ embeds: [embed('Set', `Ticket category set to ${cat}.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'logchannel') {
    const ch = interaction.options.getChannel('channel', true);
    setTicketConfig(guild.id, { loggingChannelId: ch.id });
    await interaction.reply({ embeds: [embed('Set', `Ticket log channel set to ${ch}.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'supportrole') {
    const role = interaction.options.getRole('role', true);
    const current = getTicketConfig(guild.id);
    const updated = current.supportRoleIds.includes(role.id)
      ? current.supportRoleIds.filter(r => r !== role.id)
      : [...current.supportRoleIds, role.id];
    setTicketConfig(guild.id, { supportRoleIds: updated });
    const action = current.supportRoleIds.includes(role.id) ? 'removed from' : 'added to';
    await interaction.reply({ embeds: [embed('Updated', `${role} ${action} support roles.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'pingrole') {
    const category = interaction.options.getString('category', true);
    const role = interaction.options.getRole('role', false);
    if (role) {
      setPingRole(guild.id, category as any, role.id);
      await interaction.reply({ embeds: [embed('Ping Role Set', `${role} will be pinged for **${THREAD_CATEGORY_LABELS[category as ThreadCategory] || category}** tickets.`)], flags: MessageFlags.Ephemeral });
    } else {
      setPingRole(guild.id, category as any, null);
      await interaction.reply({ embeds: [embed('Ping Role Cleared', `No role will be pinged for **${THREAD_CATEGORY_LABELS[category as ThreadCategory] || category}** tickets.`)], flags: MessageFlags.Ephemeral });
    }
    return;
  }
}

// ── Claim ──────────────────────────────────────────────

async function claimFlow(interaction: ChatInputCommandInteraction, guild: Guild, user: User) {
  const ticket = getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [embed('Not a Ticket', 'This command must be used inside a ticket channel.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.status === 'closed') {
    await interaction.reply({ embeds: [embed('Closed', 'This ticket is already closed.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.claimedBy) {
    await interaction.reply({ embeds: [embed('Already Claimed', `This ticket is claimed by <@${ticket.claimedBy}>.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  claimTicket(guild.id, ticket.id, user.id);
  await interaction.reply({ embeds: [embed('Claimed', `<@${user.id}> claimed ticket **#${ticket.id}**.`)] });
  const ch = interaction.channel;
  if (ch && 'send' in ch) {
    await (ch as any).send({ embeds: [ticketEmbed({ ...ticket, status: 'claimed', claimedBy: user.id, claimedAt: Date.now() })] }).catch(() => {});
  }
}

// ── Close ──────────────────────────────────────────────

async function closeFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const channelId = interaction instanceof ChatInputCommandInteraction ? interaction.channelId : interaction.channel.id;
  const ticket = getTicketByChannel(channelId);
  if (!ticket) {
    const msg = { embeds: [embed('Not a Ticket', 'This command must be used inside a ticket channel.')], flags: MessageFlags.Ephemeral as number };
    if (interaction instanceof ChatInputCommandInteraction) await interaction.reply(msg);
    else await interaction.reply({ embeds: [embed('Not a Ticket', 'This command must be used inside a ticket channel.')] });
    return;
  }
  if (ticket.status === 'closed') {
    const msg = { embeds: [embed('Already Closed', 'This ticket is already closed.')], flags: MessageFlags.Ephemeral as number };
    if (interaction instanceof ChatInputCommandInteraction) await interaction.reply(msg);
    else await interaction.reply({ embeds: [embed('Already Closed', 'This ticket is already closed.')] });
    return;
  }

  if (interaction instanceof ChatInputCommandInteraction) {
    const reason = interaction.options.getString('reason') || undefined;
    await finishClose(interaction, guild, user, ticket, reason);
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('ticket_close_reason')
    .setTitle(`Close Ticket #${ticket.id}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason').setLabel('Close reason').setStyle(TextInputStyle.Paragraph)
          .setRequired(false).setMaxLength(512).setPlaceholder('Why is this ticket being closed?')
      )
    );
  const msg = await interaction.reply({ embeds: [embed('Closing...', 'Closing ticket...')] }) as Message;
  if (msg) {
    const btn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger)
    );
    await msg.edit({ embeds: [embed('Confirm Close', 'Click below to confirm closing this ticket.')], components: [btn] });
    const confirm = await msg.awaitMessageComponent({
      filter: (i: any) => i.customId === 'ticket_confirm_close' && i.user.id === user.id,
      componentType: ComponentType.Button,
      time: 30000
    }).catch(() => null);
    if (!confirm) {
      await msg.edit({ embeds: [embed('Cancelled', 'Close cancelled.')], components: [] });
      return;
    }
    await confirm.showModal(modal);
    const modalSub = await confirm.awaitModalSubmit({
      filter: (i: any) => i.customId === 'ticket_close_reason' && i.user.id === user.id,
      time: 120000
    }).catch(() => null);
    if (!modalSub) return;
    const reason = modalSub.fields.getTextInputValue('reason') || undefined;
    await modalSub.deferUpdate();
    await finishClose(modalSub as any, guild, user, ticket, reason, true);
    try { await msg.delete().catch(() => {}); } catch {}
  }
}

async function finishClose(ctx: any, guild: Guild, user: User, ticket: Ticket, reason?: string, fromModal = false) {
  const channel = guild.channels.cache.get(ticket.channelId);
  let transcriptPath: string | undefined;

  if (channel && 'messages' in channel) {
    try {
      const result = await generateTranscript(channel as any, ticket.id, guild.id, reason);
      transcriptPath = result.htmlPath;
    } catch {}
  }

  closeTicket(guild.id, ticket.id, user.id, reason, transcriptPath);

  const resultEmbed = embed('Ticket Closed', `Ticket **#${ticket.id}** has been closed.`)
    .addFields(
      { name: 'Closed by', value: `<@${user.id}>`, inline: true },
      { name: 'Reason', value: reason || 'No reason given', inline: false }
    );

  if (fromModal) await ctx.editReply({ embeds: [resultEmbed] });
  else await ctx.reply({ embeds: [resultEmbed] });

  try {
    const closeChan = await guild.channels.fetch(ticket.channelId);
    if (closeChan?.isThread()) {
      await closeChan.setLocked(true, 'Ticket closed');
      await closeChan.setArchived(true, 'Ticket closed');
    } else if (closeChan && 'deletable' in closeChan && (closeChan as any).deletable) {
      await (closeChan as any).delete('Ticket closed');
    }
  } catch {} // channel gone or no permission

  const config = getTicketConfig(guild.id);
  if (config.loggingChannelId) {
    const logCh = guild.channels.cache.get(config.loggingChannelId);
    if (logCh && 'send' in logCh) {
      const logEmbed = embed('Ticket Closed', `Ticket **#${ticket.id}** (${CATEGORY_LABELS[ticket.category]})`)
        .addFields(
          { name: 'Creator', value: `<@${ticket.creatorId}>`, inline: true },
          { name: 'Closed by', value: `<@${user.id}>`, inline: true },
          { name: 'Reason', value: reason || 'No reason', inline: false },
          { name: 'Ticket', value: `[Jump to Ticket](https://discord.com/channels/${guild.id}/${ticket.channelId})`, inline: true }
        );
      await (logCh as any).send({ embeds: [logEmbed] }).catch(() => {});
    }
  }
}

// ── Reopen ─────────────────────────────────────────────

async function reopenFlow(interaction: ChatInputCommandInteraction, guild: Guild, user: User) {
  const id = interaction.options.getInteger('id', true);
  const ticket = getTicket(guild.id, id);
  if (!ticket) {
    await interaction.reply({ embeds: [embed('Not Found', `Ticket #${id} not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.status !== 'closed') {
    await interaction.reply({ embeds: [embed('Not Closed', 'Only closed tickets can be reopened.')], flags: MessageFlags.Ephemeral });
    return;
  }
  reopenTicket(guild.id, id);
  await interaction.reply({ embeds: [embed('Reopened', `Ticket **#${id}** has been reopened.`)] });
}

// ── Priority ───────────────────────────────────────────

async function priorityFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const id = interaction.options.getInteger('id', true);
  const level = interaction.options.getString('level', true) as any;
  const ticket = getTicket(guild.id, id);
  if (!ticket) {
    await interaction.reply({ embeds: [embed('Not Found', `Ticket #${id} not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  updateTicket(guild.id, id, { priority: level });
  await interaction.reply({ embeds: [embed('Priority Updated', `Ticket **#${id}** priority set to **${level}**.`)] });
}

// ── Note ───────────────────────────────────────────────

async function noteFlow(interaction: ChatInputCommandInteraction, guild: Guild, user: User) {
  const ticket = getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [embed('Not a Ticket', 'Use this inside a ticket channel.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const content = interaction.options.getString('content', true);
  addNote(guild.id, ticket.id, user.id, content);
  await interaction.reply({ embeds: [embed('Note Added', `Note added to ticket **#${ticket.id}**.`)], flags: MessageFlags.Ephemeral });
}

// ── Rename ─────────────────────────────────────────────

async function renameFlow(interaction: ChatInputCommandInteraction) {
  const ticket = getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ embeds: [embed('Not a Ticket', 'Use this inside a ticket channel.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const name = interaction.options.getString('name', true);
  const ch = interaction.channel;
  if (ch && ch.isTextBased() && 'setName' in ch) {
    await (ch as any).setName(name);
  }
  updateTicket(ticket.guildId, ticket.id, { subject: name });
  await interaction.reply({ embeds: [embed('Renamed', `Ticket renamed to **${name}**.`)] });
}

// ── Search ─────────────────────────────────────────────

async function searchFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const userId = interaction.options.getString('user') || undefined;
  const status = interaction.options.getString('status') as any || undefined;
  const category = interaction.options.getString('category') as any || undefined;

  const results = searchTickets(guild.id, { userId, status, category });
  if (results.length === 0) {
    await interaction.reply({ embeds: [embed('No Results', 'No tickets match your search.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const desc = results.slice(0, 20).map(t =>
    `**#${t.id}** — ${CATEGORY_LABELS[t.category]} — ${t.status} — <@${t.creatorId}>`
  ).join('\n');
  await interaction.reply({
    embeds: [embed(`Search Results (${results.length})`, desc)],
    flags: MessageFlags.Ephemeral
  });
}

// ── Stats ──────────────────────────────────────────────

async function statsFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const stats = getTicketStats(guild.id);
  const catDesc = Object.entries(stats.byCategory)
    .map(([c, n]) => `${CATEGORY_LABELS[c as TicketCategory] || c}: ${n}`)
    .join('\n') || 'None';
  const staffDesc = Object.entries(stats.byStaff)
    .sort((a, b) => b[1].closed - a[1].closed)
    .slice(0, 5)
    .map(([id, s]) => `<@${id}>: ${s.closed} closed / ${s.claimed} claimed`)
    .join('\n') || 'None';

  await interaction.reply({
    embeds: [embed('Ticket Statistics')
      .addFields(
        { name: 'Total', value: `${stats.total}`, inline: true },
        { name: 'Open', value: `${stats.open}`, inline: true },
        { name: 'Closed', value: `${stats.closed}`, inline: true },
        { name: 'Avg Closure', value: `${stats.avgClosureHours}h`, inline: true },
        { name: 'By Category', value: catDesc, inline: false },
        { name: 'Top Staff', value: staffDesc, inline: false }
      )
    ],
    flags: MessageFlags.Ephemeral
  });
}

// ── Router ─────────────────────────────────────────────

async function ticketCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const guild = interaction.guild;
  const user = interaction.user;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(true);

  const needsManage = ['config', 'search', 'stats', 'reopen'].includes(sub);
  if (needsManage && !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'config') {
    await configFlow(interaction, guild);
    return;
  }

  switch (sub) {
    case 'claim':
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await claimFlow(interaction, guild, user);
      break;
    case 'close':
      await closeFlow(interaction, guild, user);
      break;
    case 'reopen':
      await reopenFlow(interaction, guild, user);
      break;
    case 'priority':
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await priorityFlow(interaction, guild);
      break;
    case 'note':
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await noteFlow(interaction, guild, user);
      break;
    case 'rename':
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
        return;
      }
      await renameFlow(interaction);
      break;
    case 'search':
      await searchFlow(interaction, guild);
      break;
    case 'stats':
      await statsFlow(interaction, guild);
      break;
    default:
      await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
  }
}

async function ticketMessageFlow(message: Message, guild: Guild, user: User) {
  const parts = message.content.slice(1).trim().split(/\s+/);
  const sub = parts[1]?.toLowerCase();
  if (sub === 'close') {
    await closeFlow(message, guild, user);
  } else {
    await message.reply({ embeds: [embed('Usage', 'Usage: `!ticket close` (must be in a ticket channel).')] });
  }
}

module.exports = { default: ticketCommand, ticketMessageFlow };
