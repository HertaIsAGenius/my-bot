import 'dotenv/config';
import { Client, IntentsBitField, Partials, GuildMember, PermissionsBitField, Message, EmbedBuilder, TextChannel, NewsChannel, MessageFlags, ChannelType } from 'discord.js';
import { embed } from './utils/embed';
import { commands, registerCommands } from './commands';
import { autoSlowmode } from './utils/autoSlowmode';
import { enableSlowmodeChannel, disableSlowmodeChannel } from './utils/slowmodeConfig';
import { getTickets, setModeratorChannel, preloadAllTickets } from './utils/tickets';
import { findTag, incrementTagUses } from './utils/tags';
import { getTodos, clearTodos } from './utils/todos';
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
import { handleLeaderboardPage } from './utils/leaderboardSession';
import { getLevelUpChannel } from './utils/levelNotif';
import { getLevelRole } from './utils/levelRoles';
import { getCommandRoles } from './utils/botperms';
import { handleTicketPanelJsonModal, handleTicketCategorySelect, handleTicketReasonModal } from './utils/ticketInteractions';
import { runMigrations, getWelcomeConfig, getGoodbyeConfig, getAutoRoles, getMessageReactionRoles, getJtcConfig, getServerStatsConfig } from './utils/db';

type CmdMod = Record<string, any>;
const helpCmd: CmdMod = require('./commands/help');
const loggingCmd: CmdMod = require('./commands/logging');
const ticketCmd: CmdMod = require('./commands/ticket');
const todolistCmd: CmdMod = require('./commands/todolist');
const modchannelCmd: CmdMod = require('./commands/modchannel');
const stopCmd: CmdMod = require('./commands/stop');
const slowmodeCmd: CmdMod = require('./commands/slowmode');
const tagCmd: CmdMod = require('./commands/tag');
const stickersCmd: CmdMod = require('./commands/stickers');
const rankCmd: CmdMod = require('./commands/rank');
const leaderboardCmd: CmdMod = require('./commands/leaderboard');
const addxpCmd: CmdMod = require('./commands/addxp');
const stickerCheck: CmdMod = require('./utils/stickerCheck');
const ticketMessageCreateCmd: CmdMod = require('./commands/ticketmessagecreate');
const verifypanelCmd: CmdMod = require('./commands/verifypanel');
const top3Cmd: CmdMod = require('./commands/top3');
const weeklyresetCmd: CmdMod = require('./commands/weeklyreset');
const weeklyCmd: CmdMod = require('./commands/weekly');
const botpermsCmd: CmdMod = require('./commands/botperms');
const levelupnotificationCmd: CmdMod = require('./commands/levelupnotification');
const trialappCmd: CmdMod = require('./commands/trialapp');
const makeappCmd: CmdMod = require('./commands/makeapp');
const trialappstartCmd: CmdMod = require('./commands/trialappstart');
const levelroleCmd: CmdMod = require('./commands/levelrole');
const xpclearCmd: CmdMod = require('./commands/xpclear');
const styledembedCmd: CmdMod = require('./commands/styledembed');
const automodCmd: CmdMod = require('./commands/automod');
const economyCmd: CmdMod = require('./commands/economy');
const welcomeCmd: CmdMod = require('./commands/welcome');
const reactionrolesCmd: CmdMod = require('./commands/reactionroles');
const giveawaysCmd: CmdMod = require('./commands/giveaways');
const serverstatsCmd: CmdMod = require('./commands/serverstats');
const jointocreateCmd: CmdMod = require('./commands/jointocreate');
const birthdayCmd: CmdMod = require('./commands/birthday');
const moderationCmd: CmdMod = require('./commands/moderation');
const slumberguardCmd: CmdMod = require('./commands/slumberguard');
const moddashboardCmd: CmdMod = require('./commands/moddashboard');
const llmCmd: CmdMod = require('./commands/llm');
const topicaiCmd: CmdMod = require('./commands/topicai');
const inviteCmd: CmdMod = require('./commands/invite');
const chessCmd: CmdMod = require('./commands/chess');
const hsrCmd: CmdMod = require('./commands/hsr');
const modmailCmd: CmdMod = require('./commands/modmail');
const askCmd: CmdMod = require('./commands/ask');
const rankcardCmd: CmdMod = require('./commands/rankcard');
import * as modmailUtils from './utils/modmail';

import { checkMessage } from './utils/automod';
import { slumberGuard } from './utils/slumberguard';
import { getLlmConfig } from './utils/llmConfig';
import { queryLlm, buildContext } from './utils/llm';
import { addChatMessage } from './utils/db';
import { Registry } from './core/Registry';
import { ChessFeature } from './features/chess/ChessFeature';

const OWNER_ID = '723573953578139731';
const registry = new Registry();
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('DISCORD_TOKEN is not set in environment variables.');
}

if (!guildId) {
  throw new Error('GUILD_ID is not set in environment variables.');
}

// ── Registry: register all non-command interaction handlers ──
function registerAllHandlers() {
  // Ticket
  registry.registerModal('ticket_json_modal', handleTicketPanelJsonModal);
  registry.registerSelectMenu('ticket_cat_sel_panel', handleTicketCategorySelect);
  registry.registerModal(/^trm_/, handleTicketReasonModal);

  // Verify
  registry.registerModal('verify_panel_modal', (i) => verifypanelCmd.handleVerifyPanelSubmit(i));
  registry.registerButton(/^verify_grant_/, (i) => verifypanelCmd.handleVerifyButton(i));

  // MakeApp
  registry.registerModal('makeapp_name_modal', (i) => makeappCmd.handleMakeAppNameSubmit(i));

  // ModMail
  registry.registerSelectMenu('modmail_guild_sel', (i) => modmailUtils.handleModMailGuildSelect(i));
  registry.registerButton('modmail_confirm', (i) => modmailUtils.handleModMailConfirm(i));
  registry.registerButton('modmail_deny', (i) => modmailUtils.handleModMailDeny(i));
  registry.registerButton('modmail_close_thread', (i) => modmailUtils.handleModMailCloseThread(i));
  registry.registerButton('modmail_suggest_confirm', (i) => modmailUtils.handleModMailSuggestConfirm(i));
  registry.registerButton('modmail_suggest_regenerate', (i) => modmailUtils.handleModMailSuggestRegenerate(i));

  // TrialApp: guild + form selection
  registry.registerSelectMenu('trialapp_guild_sel', (i) => trialappstartCmd.handleGuildSelect(i));
  registry.registerSelectMenu('trialapp_form_sel', (i) => trialappstartCmd.handleFormSelect(i));
  registry.registerButton('trialapp_form_start', (i) => trialappstartCmd.handleFormStart(i));
  registry.registerButton('trialapp_accept', (i) => trialappstartCmd.handleAccept(i));
  registry.registerButton('trialapp_cancel', (i) => trialappstartCmd.handleCancel(i));
  registry.registerButton('trialapp_form_stop', (i) => trialappstartCmd.handleCancel(i));
  registry.registerButton(/^tapp_acc_/, (i) => trialappstartCmd.handleChannelDecision(i));
  registry.registerButton(/^tapp_den_/, (i) => trialappstartCmd.handleChannelDecision(i));

  // Tag
  registry.registerModal('tag_import_modal', (i) => tagCmd.handleImportSubmit(i, i.guild, i.user));
  registry.registerAutocomplete('tag', (i) => tagCmd.tagAutocomplete(i));

  // StyledEmbed
  registry.registerSelectMenu('styledembed_opt', async (i) => {
    const chosen = i.values[0];
    await i.reply({ embeds: [embed('Selected', `You selected: **${chosen}**`)], flags: MessageFlags.Ephemeral });
  });

  // Topic AI
  registry.registerButton(/^topicai_/, (i) => topicaiCmd.handleTopicAiButton(i));

  // Chess
  new ChessFeature().register(registry);

  // Mod Dashboard
  registry.registerButton(/^moddash_/, (i) => moddashboardCmd.handleButton(i));
  registry.registerModal(/^moddash_/, (i) => moddashboardCmd.handleModal(i));

  // Leaderboard pagination
  registry.registerButton(/^lb_prev_/, (i) => handleLeaderboardPage(i, 'prev'));
  registry.registerButton(/^lb_next_/, (i) => handleLeaderboardPage(i, 'next'));

  // Rank card buttons
  registry.registerButton('rank_customise', (i) => rankCmd.handleRankCustomise(i));
  registry.registerButton('rank_extras', (i) => rankCmd.handleRankExtras(i));
  registry.registerSelectMenu('rank_preset', (i) => rankCmd.handleRankPreset(i));
  registry.registerSelectMenu('rank_avatar_style', (i) => rankCmd.handleRankAvatarStyle(i));
  registry.registerButton('rank_customise_reset', (i) => rankCmd.handleRankCustomiseReset(i));
  registry.registerButton('rank_customise_close', (i) => rankCmd.handleRankCustomiseClose(i));
  registry.registerButton('rank_extras_share', (i) => rankCmd.handleRankExtrasShare(i));
  registry.registerButton('rank_extras_share_gif', (i) => rankCmd.handleRankExtrasShareGif(i));
  registry.registerButton('rank_extras_compare', (i) => rankCmd.handleRankExtrasCompare(i));
  registry.registerButton('rank_extras_close', (i) => rankCmd.handleRankExtrasClose(i));

  // HSR creation flow
  registry.registerSelectMenu('hsr_slot_pick', (i) => hsrCmd.handleHsrSlotPick(i));
  registry.registerSelectMenu('hsr_pronouns', (i) => hsrCmd.handleHsrPronouns(i));
  registry.registerSelectMenu('hsr_path', (i) => hsrCmd.handleHsrPath(i));
  registry.registerModal(/^hsr_begin_/, (i) => hsrCmd.handleHsrBeginModal(i));
  registry.registerModal('hsr_pronouns_custom', (i) => hsrCmd.handleHsrPronounsCustom(i));

  // HSR explore
  const hsrExploreCmd: CmdMod = require('./commands/hsr_explore');
  registry.registerButton('hsr_explore_search', (i) => hsrExploreCmd.handleHsrExploreSearch(i));
  registry.registerButton('hsr_explore_gather', (i) => hsrExploreCmd.handleHsrExploreGather(i));
  registry.registerButton('hsr_explore_deliver', (i) => hsrExploreCmd.handleHsrExploreDeliver(i));
  registry.registerButton('hsr_explore_back', (i) => hsrExploreCmd.handleHsrBackToExplore(i));
  registry.registerButton(/^hsr_explore_move_/, (i) => hsrExploreCmd.handleHsrExploreMove(i));
  registry.registerButton('hsr_explore', (i) => hsrExploreCmd.handleHsrExplore(i));
  registry.registerButton('hsr_explore_available_resources', (i) => hsrExploreCmd.handleHsrExploreAvailableResources(i));

  // HSR combat
  const hsrCombatCmd: CmdMod = require('./commands/hsr_combat');
  registry.registerButton('hsr_combat', (i) => hsrCombatCmd.handleHsrCombat(i));
  registry.registerButton(/^hsr_combat_action_/, (i) => hsrCombatCmd.handleHsrCombatAction(i));
  registry.registerButton('hsr_combat_enemy_turn', (i) => hsrCombatCmd.handleHsrCombatEnemyTurn(i));
  registry.registerButton('hsr_combat_run', (i) => hsrCombatCmd.handleHsrCombatRun(i));

  // HSR warp
  const hsrWarpCmd: CmdMod = require('./commands/hsr_warp');
  registry.registerButton('hsr_warp', (i) => hsrWarpCmd.handleHsrWarp(i));
  registry.registerButton(/^hsr_warp_pull_/, (i) => hsrWarpCmd.handleHsrWarpPull(i));
  registry.registerButton(/^hsr_warp_history_/, (i) => hsrWarpCmd.handleHsrWarpHistory(i));
  registry.registerButton('hsr_warp_shop', (i) => hsrWarpCmd.handleHsrWarpShop(i));
  registry.registerButton(/^hsr_warp_buy_/, (i) => hsrWarpCmd.handleHsrWarpBuy(i));

  // HSR express
  const hsrExpressCmd: CmdMod = require('./commands/hsr_express');
  registry.registerButton('hsr_express', (i) => hsrExpressCmd.handleHsrExpress(i));
  registry.registerButton(/^hsr_express_room_/, (i) => hsrExpressCmd.handleHsrExpressRoom(i));
  registry.registerButton(/^hsr_express_workshop_craft_/, (i) => hsrExpressCmd.handleHsrExpressCraft(i));
  registry.registerButton('hsr_express_storage_view', (i) => hsrExpressCmd.handleHsrExpressStorageView(i));
  registry.registerButton('hsr_express_vault_view', (i) => hsrExpressCmd.handleHsrExpressVaultView(i));
  registry.registerButton('hsr_express_forge_enhance', (i) => hsrExpressCmd.handleHsrExpressForgeEnhance(i));
  registry.registerButton(/^hsr_express_upgrade_/, (i) => hsrExpressCmd.handleHsrExpressUpgrade(i));

  // HSR dailies
  const hsrDailiesCmd: CmdMod = require('./commands/hsr_dailies');
  registry.registerButton('hsr_dailies', (i) => hsrDailiesCmd.handleHsrDailies(i));
  registry.registerButton('hsr_dailies_claim', (i) => hsrDailiesCmd.handleHsrClaimDaily(i));

  // HSR profile button (used by express "Back to Profile")
  registry.registerButton('hsr_profile', (i) => hsrCmd.handleHsrProfile(i));
  registry.registerButton('hsr_quests', (i) => hsrCmd.handleHsrQuestBoard(i));

  // Reaction Roles
  registry.registerSelectMenu(/^rr_sel_/, async (i) => {
    const messageId = i.customId.replace('rr_sel_', '');
    const guildId = i.guildId!;
    const roles = getMessageReactionRoles(guildId, messageId);
    const selected = i.values;
    const member = i.member as any;
    if (!member?.roles) return;
    const added: string[] = [];
    const removed: string[] = [];
    for (const rr of roles) {
      const hasRole = member.roles.cache.has(rr.role_id);
      if (selected.includes(rr.role_id) && !hasRole) {
        await member.roles.add(rr.role_id).catch(() => {});
        added.push(rr.role_id);
      } else if (!selected.includes(rr.role_id) && hasRole) {
        await member.roles.remove(rr.role_id).catch(() => {});
        removed.push(rr.role_id);
      }
    }
    const parts: string[] = [];
    if (added.length > 0) parts.push(`Added: ${added.map((id: string) => `<@&${id}>`).join(', ')}`);
    if (removed.length > 0) parts.push(`Removed: ${removed.map((id: string) => `<@&${id}>`).join(', ')}`);
    if (parts.length === 0) parts.push('No changes.');
    await i.reply({ embeds: [embed('Roles Updated', parts.join('\n'))], flags: MessageFlags.Ephemeral });
  });
}

registerAllHandlers();

const prefix = '!';

const commandMap = new Map<string, CmdMod>();

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction],
  allowedMentions: { parse: [] }
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
  commandMap.set('automod', automodCmd);
  commandMap.set('balance', economyCmd);
  commandMap.set('daily', economyCmd);
  commandMap.set('work', economyCmd);
  commandMap.set('beg', economyCmd);
  commandMap.set('gamble', economyCmd);
  commandMap.set('pay', economyCmd);
  commandMap.set('rob', economyCmd);
  commandMap.set('deposit', economyCmd);
  commandMap.set('withdraw', economyCmd);
  commandMap.set('shop', economyCmd);
  commandMap.set('buy', economyCmd);
  commandMap.set('inventory', economyCmd);
  commandMap.set('ecoleaderboard', economyCmd);
  commandMap.set('shopadmin', economyCmd);
  commandMap.set('welcome', welcomeCmd);
  commandMap.set('goodbye', welcomeCmd);
  commandMap.set('autorole', welcomeCmd);
  commandMap.set('reactionroles', reactionrolesCmd);
  commandMap.set('giveaway', giveawaysCmd);
  commandMap.set('serverstats', serverstatsCmd);
  commandMap.set('jointocreate', jointocreateCmd);
  commandMap.set('birthday', birthdayCmd);
  commandMap.set('ban', moderationCmd);
  commandMap.set('unban', moderationCmd);
  commandMap.set('kick', moderationCmd);
  commandMap.set('timeout', moderationCmd);
  commandMap.set('untimeout', moderationCmd);
  commandMap.set('warn', moderationCmd);
  commandMap.set('purge', moderationCmd);
  commandMap.set('lock', moderationCmd);
  commandMap.set('unlock', moderationCmd);
  commandMap.set('cases', moderationCmd);
  commandMap.set('case', moderationCmd);
  commandMap.set('slumberguard', slumberguardCmd);
  commandMap.set('moddashboard', moddashboardCmd);
  commandMap.set('llm', llmCmd);
  commandMap.set('topic-ai', topicaiCmd);
  commandMap.set('invite', inviteCmd);
  commandMap.set('chess', chessCmd);
  commandMap.set('hsr', hsrCmd);
  commandMap.set('modmail', modmailCmd);
  commandMap.set('ask', askCmd);
  commandMap.set('rankcard', rankcardCmd);

  const clientId = client.user?.id ?? client.application?.id ?? '';
  if (!clientId) {
    console.error('Unable to resolve bot client ID; slash commands cannot be registered.');
    return;
  }

  await registerCommands(clientId, guildId, token);

  // Register commands for all guilds the bot is already in (instant)
  const { REST, Routes } = require('discord.js');
  const guildRest = new REST({ version: '10' }).setToken(token);
  for (const [, g] of client.guilds.cache) {
    try {
      await guildRest.put(Routes.applicationGuildCommands(clientId, g.id), { body: commands });
    } catch (e) {
      console.error(`Failed guild commands for ${g.id}:`, e);
    }
  }
  console.log(`Registered commands for ${client.guilds.cache.size} guild(s).`);
});

// ── Auto-register commands when joining a new guild ──
client.on('guildCreate', async (guild) => {
  const { REST, Routes } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user!.id, guild.id), { body: commands });
    console.log(`Registered commands for new guild: ${guild.name} (${guild.id})`);
  } catch (e) {
    console.error(`Failed to register commands for guild ${guild.id}:`, e);
  }
});

client.on('interactionCreate', async (interaction) => {
  // Dispatch via registry (buttons, modals, select menus, autocomplete)
  if (interaction.isButton() && registry.handleButton(interaction)) return;
  if (interaction.isModalSubmit() && registry.handleModal(interaction)) return;
  if (interaction.isStringSelectMenu() && registry.handleSelectMenu(interaction)) return;
  if (interaction.isAutocomplete() && registry.handleAutocomplete(interaction)) return;

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  // Permission check — owner bypasses all restrictions
  if (interaction.guild && command !== 'botperms' && interaction.user.id !== OWNER_ID) {
    const allowedRoles = getCommandRoles(interaction.guild.id, command);
    if (allowedRoles.length > 0) {
      const member = interaction.member;
      if (member && 'roles' in member) {
        const roles = member.roles as any;
        const hasRole = roles?.cache?.some((r: { id: string }) => allowedRoles.includes(r.id));
        if (!hasRole) {
          await interaction.reply({ embeds: [embed('Permission Denied', 'You do not have permission to use this command.')], flags: MessageFlags.Ephemeral });
          return;
        }
      }
    }
  }

  try {
    const cmd = commandMap.get(command) as CmdMod | undefined;
    if (cmd?.default) {
      await cmd.default(interaction);
    } else {
      console.warn(`Unhandled slash command: ${command}`);
    }
  } catch (error) {
    console.error(`Error handling slash command ${command}:`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [embed('Error', 'An error occurred while executing the command.')], flags: MessageFlags.Ephemeral });
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  try {
  // ── DM handler: modmail relay + trialapp ──────────
  if (!message.guild) {
    if (await modmailUtils.handleModMailDm(message)) return;
    await trialappstartCmd.handleDmMessage(message);
    return;
  }

  // ── Guild message handler for makeApp questions ───
  if (await makeappCmd.handleMakeAppMessage(message)) return;

  checkMessage(message);
  slumberGuard.handleMessage(message as Message<true>);

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

  // ── LLM chat handler ───────────────────────────
  if (message.guild && message.channel.isTextBased() && !message.content.startsWith(prefix) && message.mentions.has(client.user!)) {
    const cfg = getLlmConfig(message.channel.id);
    if (cfg.enabled) {
      try {
        const apiKey = process.env.LLM_API_KEY;
        const baseUrl = process.env.LLM_BASE_URL;
        const model = process.env.LLM_MODEL;
        if (apiKey) {
          await message.channel.sendTyping();
          const cleanContent = message.content.replace(/<@!?\d+>/g, '').trim();
          const context = buildContext(message.guild.id, message.channel.id, cleanContent, cfg.systemPrompt, cfg.memoryEnabled);
          const reply = await queryLlm(context, { apiKey, baseUrl, model });
          addChatMessage(message.guild.id, message.channel.id, message.author.id, 'user', cleanContent);
          addChatMessage(message.guild.id, message.channel.id, message.author.id, 'assistant', reply);
          await message.reply(reply);
        }
      } catch (e) {
        console.error('LLM error:', e);
      }
      return;
    }
  }

  // ── ModMail: thread relay ────────────────────────
  if (await modmailUtils.handleModMailThread(message)) return;

  if (!message.content?.startsWith(prefix)) return;

  const [commandName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = commandName.toLowerCase();

  if (command === 'todolist') {
    const sub = args.shift();
    if (!sub || !['add', 'list', 'edit', 'remove', 'clear'].includes(sub)) {
      await message.reply({ embeds: [embed('Usage', 'Usage: !todolist add <text> | list | edit <id> <text> | remove <id> | clear')] });
      return;
    }
    if (sub === 'add') {
      await todolistCmd.addFlow(message, message.guild, message.author);
    } else if (sub === 'list') {
      const items = getTodos(message.guild.id);
      if (items.length === 0) {
        await message.reply({ embeds: [embed('Todo List', 'The todo list is empty.')] });
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
      await message.reply({ embeds: [embed('Todo List Cleared', 'Cleared the server todo list.')] });
    }
  } else if (command === 'tickets') {
    const sub = args.shift();
    if (sub === 'list') {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await message.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')] });
        return;
      }
      const tickets = getTickets(message.guild.id);
      if (tickets.length === 0) {
        await message.reply({ embeds: [embed('No Tickets', 'No tickets found.')] });
        return;
      }
      const description = tickets.map((t) => `#${t.id} - ${t.status} - ${t.subject || 'No subject'}`).join('\n');
      await message.reply({ embeds: [embed('Tickets', description)] });
    }
  } else if (command === 'ticket') {
    const ticketCmdModule = commandMap.get('ticket');
    if (ticketCmdModule?.ticketMessageFlow) {
      await ticketCmdModule.ticketMessageFlow(message, message.guild, message.author);
    }
  } else if (command === 'modchannel') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')] });
      return;
    }
    const channelArg = args.shift();
    if (!channelArg) {
      await message.reply({ embeds: [embed('Usage', 'Usage: !modchannel #channel [messages:on|off] [reactions:on|off]')] });
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
    await message.reply({ embeds: [embed('Modchannel Set', `Moderator channel set to <#${chId}>${logText}`)] });
  } else if (command === 'logmessages' || command === 'logreactions') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')] });
      return;
    }
    const value = args.shift();
    if (!value || !['on', 'off', 'true', 'false'].includes(value.toLowerCase())) {
      await message.reply({ embeds: [embed('Usage', `Usage: !${command} on|off`)] });
      return;
    }
    const enabled = ['on', 'true'].includes(value.toLowerCase());
    if (command === 'logmessages') setMessageLoggingEnabled(message.guild.id, enabled);
    else setReactionLoggingEnabled(message.guild.id, enabled);
    await message.reply({ embeds: [embed('Logging Updated', `${command} set to ${enabled ? 'on' : 'off'}`)] });
  } else if (command === 'stop') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')] });
      return;
    }
    await message.reply({ embeds: [embed('Shutting Down', 'Shutting down the bot now.')] });
    process.exit(0);
  } else if (command === 'slowmode') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')] });
      return;
    }

    const enabledArg = args.shift();
    if (!enabledArg) {
      await message.reply({ embeds: [embed('Usage', 'Usage: !slowmode on|off')] });
      return;
    }

    const enabled = enabledArg.toLowerCase() === 'on' || enabledArg.toLowerCase() === 'true';
    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased() || channel.isThread()) {
      await message.reply({ embeds: [embed('Invalid Channel', 'This command only works in text channels.')] });
      return;
    }

    if (enabled) {
      enableSlowmodeChannel(channel.id);
      autoSlowmode.enableChannel(channel.id);
      await message.reply({ embeds: [embed('Auto Slowmode', 'Auto slowmode enabled for this channel.')] });
    } else {
      disableSlowmodeChannel(channel.id);
      await autoSlowmode.disableChannel(channel as TextChannel | NewsChannel);
      await message.reply({ embeds: [embed('Auto Slowmode', 'Auto slowmode disabled for this channel.')] });
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
  } catch (e) {
    console.error('messageCreate error:', e);
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

// ── New: Welcome message + Auto-role on join ──
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;
  const guild = member.guild;

  // Auto-role
  const roleIds = getAutoRoles(guild.id);
  for (const roleId of roleIds) {
    try {
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      if (role) await member.roles.add(role).catch(() => {});
    } catch {}
  }

  // Welcome message
  const welcomeConfig = getWelcomeConfig(guild.id);
  if (welcomeConfig.enabled && welcomeConfig.channel_id) {
    try {
      const channel = guild.channels.cache.get(welcomeConfig.channel_id) || await guild.channels.fetch(welcomeConfig.channel_id).catch(() => null);
      if (channel?.isTextBased()) {
        const msg = welcomeConfig.message
          .replace(/\{user\}/g, member.toString())
          .replace(/\{server\}/g, guild.name);
        const e = new EmbedBuilder().setColor(0x2B3A67).setDescription(msg);
        await (channel as any).send({ embeds: [e] });
      }
    } catch {}
  }
});

// ── New: Goodbye message on leave ──
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;
  const goodbyeConfig = getGoodbyeConfig(member.guild.id);
  if (goodbyeConfig.enabled && goodbyeConfig.channel_id) {
    try {
      const channel = member.guild.channels.cache.get(goodbyeConfig.channel_id) || await member.guild.channels.fetch(goodbyeConfig.channel_id).catch(() => null);
      if (channel?.isTextBased()) {
        const msg = goodbyeConfig.message
          .replace(/\{user\}/g, member.user.tag)
          .replace(/\{server\}/g, member.guild.name);
        const e = new EmbedBuilder().setColor(0x9B2226).setDescription(msg);
        await (channel as any).send({ embeds: [e] });
      }
    } catch {}
  }
});

// Track temp voice channels
const tempVoiceChannels = new Map<string, Set<string>>();

// ── New: Join-to-Create + Server Stats update on voice state change ──
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  // Join-to-Create
  const jtcConfig = getJtcConfig(guild.id);
  if (jtcConfig.channel_id) {
    // User joined the trigger channel
    if (newState.channelId === jtcConfig.channel_id && !oldState.channelId) {
      try {
        const name = jtcConfig.voice_format.replace(/\{user\}/g, newState.member?.displayName || 'User');
        const newChannel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: jtcConfig.category_id || undefined,
        });
        await newState.setChannel(newChannel).catch(() => {});
        // Track temp channels for cleanup
        const tempChannels = tempVoiceChannels.get(guild.id) || new Set<string>();
        tempChannels.add(newChannel.id);
        tempVoiceChannels.set(guild.id, tempChannels);
      } catch {}
    }
    // User left a temp channel — clean up if empty
    if (oldState.channelId && oldState.channelId !== jtcConfig.channel_id && !newState.channelId) {
      const tempChannels = tempVoiceChannels.get(guild.id);
      if (tempChannels?.has(oldState.channelId)) {
        const ch = guild.channels.cache.get(oldState.channelId);
        if (ch && (ch as any).members?.size === 0) {
          tempChannels.delete(oldState.channelId);
          await ch.delete().catch(() => {});
        }
      }
    }
  }

  // Server Stats — update voice counter
  const statsConfig = getServerStatsConfig(guild.id);
  if (statsConfig.voice_channel_id) {
    const voiceMembers = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildVoice)
      .reduce((sum, c) => sum + (c as any).members.size, 0);
    const ch = guild.channels.cache.get(statsConfig.voice_channel_id);
    if (ch) {
      const prefix = ch.name.replace(/:\s*\d+/, '').trim();
      await ch.setName(`${prefix}: ${voiceMembers}`).catch(() => {});
    }
  }
});



runMigrations();
client.login(token);
