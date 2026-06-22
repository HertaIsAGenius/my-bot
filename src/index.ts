import 'dotenv/config';
import { Client, IntentsBitField, Partials, GuildMember, PermissionsBitField, Message, EmbedBuilder, TextChannel, NewsChannel, MessageFlags } from 'discord.js';
import { registerCommands } from './commands';
import { autoSlowmode } from './utils/autoSlowmode';
import { enableSlowmodeChannel, disableSlowmodeChannel } from './utils/slowmodeConfig';
import { getTickets, setModeratorChannel, preloadAllTickets } from './utils/tickets';
import { findTag, incrementTagUses } from './utils/tags';
import { addTodo, getTodos, removeTodo, editTodo, clearTodos } from './utils/todos';
import { isStickerDetectionEnabled } from './utils/stickers';
import {
  isMessageLoggingEnabled,
  isReactionLoggingEnabled,
  setMessageLoggingEnabled,
  setReactionLoggingEnabled,
  logMessage,
  logReaction
} from './utils/logs';
import { addXp } from './utils/levels';
import { getLevelUpChannel } from './utils/levelNotif';
import { getLevelRole } from './utils/levelRoles';
import { getCommandRoles } from './utils/botperms';
import { handleTicketPanelJsonModal, handleTicketCategorySelect, handleTicketReasonModal } from './utils/ticketInteractions';
const helpCmd: any = require('./commands/help');
const loggingCmd: any = require('./commands/logging');
const ticketCmd: any = require('./commands/ticket');
const todolistCmd: any = require('./commands/todolist');
const modchannelCmd: any = require('./commands/modchannel');
const stopCmd: any = require('./commands/stop');
const slowmodeCmd: any = require('./commands/slowmode');
const tagCmd: any = require('./commands/tag');
const stickersCmd: any = require('./commands/stickers');
const rankCmd: any = require('./commands/rank');
const leaderboardCmd: any = require('./commands/leaderboard');
const addxpCmd: any = require('./commands/addxp');
const stickerCheck: any = require('./utils/stickerCheck');
const ticketMessageCreateCmd: any = require('./commands/ticketmessagecreate');
const verifypanelCmd: any = require('./commands/verifypanel');
const top3Cmd: any = require('./commands/top3');
const weeklyresetCmd: any = require('./commands/weeklyreset');
const weeklyCmd: any = require('./commands/weekly');
const botpermsCmd: any = require('./commands/botperms');
const levelupnotificationCmd: any = require('./commands/levelupnotification');
const trialappCmd: any = require('./commands/trialapp');
const makeappCmd: any = require('./commands/makeapp');
const trialappstartCmd: any = require('./commands/trialappstart');
const levelroleCmd: any = require('./commands/levelrole');
const xpclearCmd: any = require('./commands/xpclear');
const styledembedCmd: any = require('./commands/styledembed');

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('DISCORD_TOKEN is not set in environment variables.');
}

if (!guildId) {
  throw new Error('GUILD_ID is not set in environment variables.');
}

const prefix = '!';

const commandMap = new Map<string, any>();

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  preloadAllTickets();

  commandMap.set('help', helpCmd);
  commandMap.set('logging', loggingCmd);
  commandMap.set('ticket', ticketCmd);
  commandMap.set('todolist', todolistCmd);
  commandMap.set('modchannel', modchannelCmd);
  commandMap.set('stop', stopCmd);
  commandMap.set('slowmode', slowmodeCmd);
  commandMap.set('tag', tagCmd);
  commandMap.set('stickers', stickersCmd);
  commandMap.set('rank', rankCmd);
  commandMap.set('leaderboard', leaderboardCmd);
  commandMap.set('addxp', addxpCmd);
  commandMap.set('ticketmessagecreate', ticketMessageCreateCmd);
  commandMap.set('verifypanel', verifypanelCmd);
  commandMap.set('top3', top3Cmd);
  commandMap.set('weeklyreset', weeklyresetCmd);
  commandMap.set('weekly', weeklyCmd);
  commandMap.set('botperms', botpermsCmd);
  commandMap.set('levelupnotification', levelupnotificationCmd);
  commandMap.set('trialapp', trialappCmd);
  commandMap.set('makeapp', makeappCmd);
  commandMap.set('applicationforms', trialappstartCmd);
  commandMap.set('levelrole', levelroleCmd);
  commandMap.set('xpclear', xpclearCmd);
  commandMap.set('styledembed', styledembedCmd);

  const clientId = client.user?.id ?? client.application?.id ?? '';
  if (!clientId) {
    console.error('Unable to resolve bot client ID; slash commands cannot be registered.');
    return;
  }

  await registerCommands(clientId, guildId, token);
});

client.on('interactionCreate', async (interaction) => {
  // ── Modal submit: ticket panel JSON ────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_json_modal') {
    await handleTicketPanelJsonModal(interaction);
    return;
  }

  // ── Select menu: ticket category chosen → show reason modal ─
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_cat_sel_panel') {
    await handleTicketCategorySelect(interaction);
    return;
  }

  // ── Modal submit: ticket reason → create thread ──────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('trm_')) {
    await handleTicketReasonModal(interaction);
    return;
  }

  // ── Modal submit: verify panel ────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'verify_panel_modal') {
    await verifypanelCmd.handleVerifyPanelSubmit(interaction);
    return;
  }

  // ── Button click: verify role grant ───────────────
  if (interaction.isButton() && interaction.customId.startsWith('verify_grant_')) {
    await verifypanelCmd.handleVerifyButton(interaction);
    return;
  }

  // ── MakeApp: form name modal ──────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'makeapp_name_modal') {
    await makeappCmd.handleMakeAppNameSubmit(interaction);
    return;
  }

  // ── TrialApp: form selection ──────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'trialapp_form_sel') {
    await trialappstartCmd.handleFormSelect(interaction);
    return;
  }

  // ── TrialApp: accept / cancel buttons ──────────────
  if (interaction.isButton() && interaction.customId === 'trialapp_accept') {
    await trialappstartCmd.handleAccept(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === 'trialapp_cancel') {
    await trialappstartCmd.handleCancel(interaction);
    return;
  }
  if (interaction.isButton() && (interaction.customId === 'trialapp_channel_accept' || interaction.customId === 'trialapp_channel_deny')) {
    await trialappstartCmd.handleChannelDecision(interaction);
    return;
  }

  // ── Modal submit: tag import ───────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'tag_import_modal') {
    await tagCmd.handleImportSubmit(interaction, interaction.guild, interaction.user);
    return;
  }

  // ── Autocomplete: tag names ────────────────────────
  if (interaction.isAutocomplete() && interaction.commandName === 'tag') {
    await tagCmd.tagAutocomplete(interaction);
    return;
  }

  // ── StyledEmbed: option selected ───────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'styledembed_opt') {
    const chosen = interaction.values[0];
    await interaction.reply({ content: `You selected: **${chosen}**`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // Permission check
  if (interaction.guild && command !== 'botperms') {
    const allowedRoles = getCommandRoles(interaction.guild.id, command);
    if (allowedRoles.length > 0) {
      const member = interaction.member as any;
      const hasRole = member?.roles?.cache?.some((r: any) => allowedRoles.includes(r.id));
      if (!hasRole) {
        await interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        return;
      }
    }
  }

  try {
    const cmd = commandMap.get(command);
    if (cmd?.default) {
      await cmd.default(interaction);
    } else {
      console.warn(`Unhandled slash command: ${command}`);
    }
  } catch (error) {
    console.error(`Error handling slash command ${command}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while executing the command.', flags: MessageFlags.Ephemeral });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ── DM handler: trialapp question answers ─────────
  if (!message.guild) {
    await trialappstartCmd.handleDmMessage(message);
    return;
  }

  // ── Guild message handler for makeApp questions ───
  if (makeappCmd.handleMakeAppMessage(message)) return;

  const xpResult = addXp(message.author.id, message.guild.id);
  if (xpResult.leveledUp) {
    const notifChannelId = getLevelUpChannel(message.guild.id);
    const targetChannel = notifChannelId
      ? (message.guild.channels.cache.get(notifChannelId) ?? await message.guild.channels.fetch(notifChannelId).catch(() => null))
      : null;
    const ch = (targetChannel ?? message.channel) as any;
    if (ch?.isTextBased()) {
      try {
        await ch.send({
          embeds: [new EmbedBuilder()
            .setColor(0x2B3A67)
            .setDescription(`${message.author} reached level **${xpResult.newLevel}**!`)
          ]
        });
      } catch {}
    }

    const roleId = getLevelRole(message.guild.id, xpResult.newLevel);
    if (roleId && message.member) {
      try {
        const role = message.guild.roles.cache.get(roleId) ?? await message.guild.roles.fetch(roleId).catch(() => null);
        if (role && message.member instanceof GuildMember && !message.member.roles.cache.has(roleId)) {
          await message.member.roles.add(role);
        }
      } catch {}
    }
  }

  if (message.channel.isTextBased()) {
    const shouldLogPerChannel = isMessageLoggingEnabled(message.guild.id, message.channel.id);
    const shouldLogGuild = isMessageLoggingEnabled(message.guild.id);
    if (shouldLogGuild || shouldLogPerChannel) {
      try {
        logMessage(message.guild.id, {
          messageId: message.id,
          authorId: message.author.id,
          content: message.content,
          channelId: message.channel.id
        });
      } catch (e) {
        console.error('Failed to log message:', e);
      }
    }

    await autoSlowmode.handleMessage(message as Message<true>);
  }

  // Sticker Sentinel — detect forwarded messages with external stickers
  const snap = message.messageSnapshots?.first();
  if (snap && isStickerDetectionEnabled(message.guild.id)) {
    try {
      await stickerCheck.default(message);
    } catch (e) {
      console.error('Sticker check error:', e);
    }
  }

  if (!message.content?.startsWith(prefix)) return;

  const [commandName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = commandName.toLowerCase();

  if (command === 'todolist') {
    const sub = args.shift();
    if (!sub || !['add', 'list', 'edit', 'remove', 'clear'].includes(sub)) {
      await message.reply('Usage: !todolist add <text> | list | edit <id> <text> | remove <id> | clear');
      return;
    }
    if (sub === 'add') {
      await todolistCmd.addFlow(message, message.guild, message.author);
    } else if (sub === 'list') {
      const items = getTodos(message.guild.id);
      if (items.length === 0) {
        await message.reply('The todo list is empty.');
        return;
      }
      const desc = items.map(t => {
        const edited = t.editedAt ? ` (edited <t:${Math.floor(t.editedAt / 1000)}:R>)` : '';
        return `**#${t.id}** ${t.text} -- *${t.authorTag}*${edited}`;
      }).join('\n');
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x2B3A67).setTitle('Server Todo List').setDescription(desc).setFooter({ text: `${items.length} item(s)` })] });
    } else if (sub === 'edit') {
      await todolistCmd.editFlow(message, message.guild, message.author);
    } else if (sub === 'remove') {
      await todolistCmd.removeFlow(message, message.guild, message.author);
    } else if (sub === 'clear') {
      clearTodos(message.guild.id);
      await message.reply('Cleared the server todo list.');
    }
  } else if (command === 'tickets') {
    const sub = args.shift();
    if (sub === 'list') {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await message.reply('You need Manage Server permission.');
        return;
      }
      const tickets = getTickets(message.guild.id);
      if (tickets.length === 0) {
        await message.reply('No tickets found.');
        return;
      }
      const description = tickets.map((t) => `#${t.id} - ${t.status} - ${t.subject || 'No subject'}`).join('\n');
      await message.reply({ content: `Tickets:\n${description}` });
    }
  } else if (command === 'ticket') {
    const ticketCmdModule = commandMap.get('ticket');
    if (ticketCmdModule?.ticketMessageFlow) {
      await ticketCmdModule.ticketMessageFlow(message, message.guild, message.author);
    }
  } else if (command === 'modchannel') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply('You need Manage Server permission.');
      return;
    }
    const channelArg = args.shift();
    if (!channelArg) {
      await message.reply('Usage: !modchannel #channel [messages:on|off] [reactions:on|off]');
      return;
    }
    const chId = channelArg.replace(/[<#>]/g, '');
    setModeratorChannel(message.guild.id, chId);

    const logConfig = [];
    for (const arg of args) {
      if (arg.startsWith('messages:')) {
        const val = arg.split(':')[1]?.toLowerCase();
        if (val === 'on' || val === 'true') {
          setMessageLoggingEnabled(message.guild.id, true, chId);
          logConfig.push('messages: on');
        } else if (val === 'off' || val === 'false') {
          setMessageLoggingEnabled(message.guild.id, false, chId);
          logConfig.push('messages: off');
        }
      } else if (arg.startsWith('reactions:')) {
        const val = arg.split(':')[1]?.toLowerCase();
        if (val === 'on' || val === 'true') {
          setReactionLoggingEnabled(message.guild.id, true, chId);
          logConfig.push('reactions: on');
        } else if (val === 'off' || val === 'false') {
          setReactionLoggingEnabled(message.guild.id, false, chId);
          logConfig.push('reactions: off');
        }
      }
    }
    const logText = logConfig.length > 0 ? ` - logging: ${logConfig.join(', ')}` : '';
    await message.reply(`Moderator channel set to <#${chId}>${logText}`);
  } else if (command === 'logmessages' || command === 'logreactions') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply('You need Manage Server permission.');
      return;
    }
    const value = args.shift();
    if (!value || !['on', 'off', 'true', 'false'].includes(value.toLowerCase())) {
      await message.reply(`Usage: !${command} on|off`);
      return;
    }
    const enabled = ['on', 'true'].includes(value.toLowerCase());
    if (command === 'logmessages') setMessageLoggingEnabled(message.guild.id, enabled);
    else setReactionLoggingEnabled(message.guild.id, enabled);
    await message.reply(`${command} set to ${enabled ? 'on' : 'off'}`);
  } else if (command === 'stop') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply('You need Manage Server permission.');
      return;
    }
    await message.reply('Shutting down the bot now.');
    process.exit(0);
  } else if (command === 'slowmode') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply('You need Manage Server permission.');
      return;
    }

    const enabledArg = args.shift();
    if (!enabledArg) {
      await message.reply('Usage: !slowmode on|off');
      return;
    }

    const enabled = enabledArg.toLowerCase() === 'on' || enabledArg.toLowerCase() === 'true';
    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased() || channel.isThread()) {
      await message.reply('This command only works in text channels.');
      return;
    }

    if (enabled) {
      enableSlowmodeChannel(channel.id);
      autoSlowmode.enableChannel(channel.id);
      await message.reply('Auto slowmode enabled for this channel.');
    } else {
      disableSlowmodeChannel(channel.id);
      await autoSlowmode.disableChannel(channel as TextChannel | NewsChannel);
      await message.reply('Auto slowmode disabled for this channel.');
    }
  } else if (command === 'rank') {
    const rankCmdModule = commandMap.get('rank');
    if (rankCmdModule?.rankMessageCommand) {
      await rankCmdModule.rankMessageCommand(message);
    }
  } else if (command === 'help') {
    await helpCmd.sendHelpToChannel(message.channel, message.author.id);
  } else if (command === 'tag') {
    const tagCmdModule = commandMap.get('tag');
    if (tagCmdModule?.tagMessageFlow) {
      await tagCmdModule.tagMessageFlow(message, message.guild, message.author);
    }
  } else {
    const tag = findTag(message.guild.id, command);
    if (tag) {
      incrementTagUses(message.guild.id, tag.name);
      const e = new EmbedBuilder().setColor(0x2B3A67).setTitle(tag.title || tag.name).setDescription(tag.content);
      if (tag.footer) e.setFooter({ text: tag.footer });
      if (tag.imageUrl) e.setImage(tag.imageUrl);
      if (message.channel.isTextBased() && !message.channel.isDMBased()) {
        await (message.channel as any).send({ embeds: [e] });
      }
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    const msg = reaction.message;
    if (!msg || !msg.guild) return;
    const shouldLogPerChannel = isReactionLoggingEnabled(msg.guild.id, msg.channel.id);
    const shouldLogGuild = isReactionLoggingEnabled(msg.guild.id);
    if (!shouldLogGuild && !shouldLogPerChannel) return;
    logReaction(msg.guild.id, { messageId: msg.id, emoji: reaction.emoji.toString(), authorId: user.id, added: true, channelId: msg.channel.id });
  } catch (e) {
    console.error('Failed to handle reaction add:', e);
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  try {
    if (user.bot) return;
    const msg = reaction.message;
    if (!msg || !msg.guild) return;
    const shouldLogPerChannel = isReactionLoggingEnabled(msg.guild.id, msg.channel.id);
    const shouldLogGuild = isReactionLoggingEnabled(msg.guild.id);
    if (!shouldLogGuild && !shouldLogPerChannel) return;
    logReaction(msg.guild.id, { messageId: msg.id, emoji: reaction.emoji.toString(), authorId: user.id, added: false, channelId: msg.channel.id });
  } catch (e) {
    console.error('Failed to handle reaction remove:', e);
  }
});

client.login(token);
