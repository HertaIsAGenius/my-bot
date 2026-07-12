import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { embed } from '../utils/embed';

interface CmdEntry {
  name: string;
  detail: string;
  long: string;
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: number;
  commands: CmdEntry[];
}

const CATEGORIES: Category[] = [
  {
    id: 'general', label: 'General / Utility', emoji: '🔧', description: 'Help, invite, ask, stop', color: 0x5865F2,
    commands: [
      { name: '/help', detail: 'Show assistance for all commands', long: 'Opens this category-based help menu. Use the dropdown to explore individual commands and Prev/Next to browse categories.' },
      { name: '/invite', detail: 'Get an invite link to add this bot to your server', long: 'Returns a Discord OAuth2 link you can share to invite the bot to other servers you manage.' },
      { name: '/ask <query>', detail: 'Ask the bot something in natural language', long: 'Describe what you want in plain English. The bot routes your request to the right feature — rank lookups, server info, and more. Two-round LLM tool-calling flow.' },
      { name: '/stop', detail: 'Gracefully shut down the bot process', long: '🔒 **Manage Server** — Terminates the bot process. The bot will stay offline until restarted manually by the host.' },
    ],
  },
  {
    id: 'leveling', label: 'Leveling / XP', emoji: '⭐', description: 'Rank, leaderboard, level roles', color: 0xFEE75C,
    commands: [
      { name: '/rank [user]', detail: "Check your or another user's level and XP", long: 'Renders a full rank card showing level, XP bar, all-time rank, weekly rank, nickname, highest role, and join date. Defaults to yourself.' },
      { name: '/rankcard', detail: 'Customise your rank card appearance', long: 'Subcommands: `view` — see current settings, `reset` — restore defaults, `set background <hex>` / `set accent <hex>` / `set bar <hex>` / `set avatar <style>` / `set font <family>` / `set bgimage <url|none>`.' },
      { name: '/leaderboard', detail: 'Top 10 users by lifetime XP', long: 'Paginated leaderboard (◀ Page X/Y ▶) showing up to 50 entries. Each entry shows rank, avatar, nickname, XP, and level. Pre-fetches all avatars for fast navigation.' },
      { name: '/weekly', detail: 'Top 10 users by weekly XP', long: 'Paginated leaderboard for XP earned this week. Same layout as `/leaderboard` but sorted by weekly XP. Weekly XP resets via `/weeklyreset`.' },
      { name: '/weeklyreset', detail: '🔒 Manage Server — reset all weekly XP', long: 'Resets weekly XP counters for all users. This is the **only** way to reset — there is no automatic 7-day timer.' },
      { name: '/addxp <user> <amount>', detail: '🔒 Manually add XP to a user', long: 'Grants a specified amount of XP to a user. Useful for event rewards or corrections. The user\'s level recalculates automatically.' },
      { name: '/top3', detail: 'Generate a leaderboard PNG', long: 'Renders a high-quality PNG showing the top 3 users with circular avatars, rank badges, gradient progress bars, and a dark gradient background.' },
      { name: '/levelrole', detail: 'Auto-assign a role on reaching a level', long: '`add <level> <role>` — reward a role when a user reaches that level. `remove <level>` — delete the reward. `list` — show all configured rewards.' },
      { name: '/levelupnotification channel', detail: 'Set or remove level-up channel', long: 'Redirects level-up announcement messages to a specific channel. Leave the channel field empty to remove the override (messages go to the user\'s current channel).' },
      { name: '/xpclear', detail: '🔒 Manage Server — clear all XP data', long: 'Deletes **all** XP and level data for this server. This action cannot be undone.' },
    ],
  },
  {
    id: 'economy', label: 'Economy', emoji: '💰', description: 'Balance, work, shop, gamble', color: 0x57F287,
    commands: [
      { name: '/balance [user]', detail: "Check wallet and bank balance", long: 'Shows your or another user\'s cash (wallet) and bank balance. Defaults to yourself.' },
      { name: '/daily', detail: 'Claim your daily reward', long: 'Collect your daily bonus coins. Resets every 24 hours per user.' },
      { name: '/work', detail: 'Work to earn some cash', long: 'Perform a random job and earn coins. Has a cooldown before you can work again.' },
      { name: '/beg', detail: 'Beg for some coins', long: 'Try your luck begging for a few coins from passers-by. Low reward but no risk.' },
      { name: '/gamble <amount>', detail: 'Gamble your cash', long: 'Bet an amount of cash for a chance to win more. High risk, high reward — you could lose it all.' },
      { name: '/pay <user> <amount>', detail: 'Pay another user', long: 'Transfer coins from your wallet to another user\'s wallet.' },
      { name: '/rob <user>', detail: 'Attempt to rob another user', long: 'Try to steal coins from another user. Very risky — if you fail you pay a fine.' },
      { name: '/deposit <amount>', detail: 'Deposit cash into your bank', long: 'Move coins from your wallet to your bank. Banked coins are safe from being robbed.' },
      { name: '/withdraw <amount>', detail: 'Withdraw cash from your bank', long: 'Move coins from your bank back to your wallet so you can spend them.' },
      { name: '/shop', detail: 'Browse the server shop', long: 'View all items available for purchase in the server shop.' },
      { name: '/buy <item-id>', detail: 'Buy an item from the shop', long: 'Purchase an item by its ID number. If the item grants a role, it will be assigned automatically.' },
      { name: '/inventory [user]', detail: 'View your inventory', long: 'See all items you or another user own. Defaults to yourself.' },
      { name: '/ecoleaderboard', detail: 'Show the richest users', long: 'Leaderboard sorted by total net worth (wallet + bank).' },
      { name: '/shopadmin', detail: 'Manage the server shop', long: '🔒 **Manage Server** — `add <name> <price>` to create an item (optional description/role). `remove <name>` to delete an item.' },
    ],
  },
  {
    id: 'tickets', label: 'Tickets', emoji: '🎫', description: 'Support ticket system', color: 0xEB459E,
    commands: [
      { name: '/ticket config', detail: 'Configure ticket settings', long: '`view` — current config. `category` — set the category for ticket channels. `logchannel` — set the log channel. `supportrole` — toggle a support role. `pingrole` — set role pinged per category.' },
      { name: '/ticket claim', detail: 'Claim the current ticket', long: 'Assign yourself as the handler of the current ticket thread. Other staff see who is handling it.' },
      { name: '/ticket close [reason]', detail: 'Close the current ticket', long: 'Closes the ticket with an optional reason. A modal opens for notes. The thread is archived and logged.' },
      { name: '/ticket reopen <id>', detail: 'Reopen a closed ticket', long: 'Restores a previously closed ticket by its ID. The thread is unarchived and moved back to the category.' },
      { name: '/ticket priority <id> <level>', detail: 'Set ticket priority', long: 'Sets the priority level: Low, Medium, High, or Urgent. Priority is shown in the ticket embed.' },
      { name: '/ticket note <content>', detail: 'Add an internal staff note', long: 'Adds a private note visible only to staff with access to the ticket channel.' },
      { name: '/ticket rename <name>', detail: 'Rename the ticket channel', long: 'Changes the name of the current ticket thread.' },
      { name: '/ticket search', detail: 'Search tickets', long: 'Filter tickets by user ID, status (Open/Claimed/Closed), and/or category (Support/Bug/Purchase/Staff/Other).' },
      { name: '/ticket stats', detail: 'Show ticket analytics', long: 'Displays ticket statistics including total tickets, open/closed counts, and average response time.' },
      { name: '/ticketmessagecreate', detail: 'Send a ticket panel', long: 'Opens a modal where you paste embed JSON. The bot bulk-deletes the channel, then sends the panel via webhook with a category dropdown. 🔒 **Manage Channels**.' },
    ],
  },
  {
    id: 'moderation', label: 'Moderation', emoji: '🛡️', description: 'Ban, kick, timeout, automod', color: 0xED4245,
    commands: [
      { name: '/ban <user> [reason] [delete_days]', detail: 'Ban a user from the server', long: '🔒 **Ban Members** — Permanently removes the user. Optionally delete their recent messages (0-7 days).' },
      { name: '/unban <user> [reason]', detail: 'Unban a user', long: '🔒 **Ban Members** — Removes a ban, allowing the user to rejoin.' },
      { name: '/kick <user> [reason]', detail: 'Kick a member', long: '🔒 **Kick Members** — Removes the user from the server. They can rejoin with a new invite.' },
      { name: '/timeout <user> <duration> [reason]', detail: 'Timeout a member', long: '🔒 **Moderate Members** — Restricts the user from chatting for the specified duration (in seconds).' },
      { name: '/untimeout <user> [reason]', detail: 'Remove timeout', long: '🔒 **Moderate Members** — Lifts an active timeout from a user.' },
      { name: '/warn <user> <reason>', detail: 'Warn a member', long: '🔒 **Moderate Members** — Issues a formal warning. Warnings are logged in the moderation case system.' },
      { name: '/purge <amount>', detail: 'Bulk delete messages', long: '🔒 **Manage Messages** — Deletes the specified number of recent messages (1-100) from the current channel.' },
      { name: '/lock /unlock [channel]', detail: 'Lock or unlock a channel', long: '🔒 **Manage Channels** — Prevents or allows @everyone from sending messages in the specified channel (defaults to current).' },
      { name: '/cases [user] /case <id>', detail: 'View moderation cases', long: '🔒 **Moderate Members** — `cases` lists all cases (optionally filtered by user). `case <id>` shows a specific case in detail.' },
      { name: '/automod', detail: 'Manage auto-moderation rules', long: '`list` — all rules. `create` — new rule. `view <name>` — rule details. `toggle <name>` — enable/disable. `remove <name>` — delete a rule.' },
      { name: '/slumberguard', detail: 'Anti-raid auto-slowmode', long: '🔒 **Manage Guild** — `help` — preset list. `set <channel> <preset>` — apply to a channel. `list` — all configured channels. `preset custom <name>` — create a custom preset. `reset` — restore defaults.' },
    ],
  },
  {
    id: 'logging', label: 'Logging & Channels', emoji: '📝', description: 'Message/reaction logs, slowmode', color: 0x99AAB5,
    commands: [
      { name: '/logging messages', detail: 'Toggle message logging', long: 'Enables or disables logging of message edits and deletions to the mod channel. 🔒 **Manage Channels**.' },
      { name: '/logging reactions', detail: 'Toggle reaction logging', long: 'Enables or disables logging of reaction additions and removals to the mod channel. 🔒 **Manage Channels**.' },
      { name: '/modchannel', detail: 'Set moderator notification channel', long: 'Select the text channel where moderation alerts, reports, and logs are sent. 🔒 **Manage Channels**.' },
      { name: '/slowmode', detail: 'Manage auto slowmode', long: 'Enables or disables automatic slowmode for the current channel. The bot dynamically applies slowmode during high-traffic periods. 🔒 **Manage Channels**.' },
    ],
  },
  {
    id: 'server', label: 'Server Management', emoji: '🏰', description: 'Welcome, autorole, dashboards', color: 0x5865F2,
    commands: [
      { name: '/welcome /goodbye', detail: 'Welcome / goodbye messages', long: '`set [channel] [message] [toggle]` — configure. Use `{user}` for mention and `{server}` for server name. `test` — preview the message. 🔒 **Manage Channels**.' },
      { name: '/autorole', detail: 'Auto-assign roles on join', long: '`add <role>` — assign this role to all new members. `remove <role>` — stop assigning it. `list` — all auto-assigned roles. 🔒 **Manage Channels**.' },
      { name: '/serverstats', detail: 'Live server stats counters', long: '`set [category] [prefix]` — creates voice channels showing member/online/boost counts. `remove` — deletes counter channels. `view` — current config.' },
      { name: '/jointocreate', detail: 'Join-to-Create voice channels', long: '`set <trigger>` — users who join this VC get a personal voice channel. `remove` — disable. `view` — current config.' },
      { name: '/moddashboard', detail: 'In-discord moderation dashboard', long: '🔒 **Manage Guild** — `setup` — creates the dashboard panel in the current channel. `remove` — deletes it.' },
      { name: '/botperms', detail: 'Restrict commands to roles', long: '🔒 **Administrator** — `list` — all restricted commands. `change` — pick a command then select which roles can use it.' },
    ],
  },
  {
    id: 'tags', label: 'Tags / Stickers / Embeds / Todo', emoji: '🏷️', description: 'Staff tags, styled embeds, todo', color: 0xEB459E,
    commands: [
      { name: '/tag', detail: 'Rich embed staff tag system', long: '`create` — modal with title/description/footer/image. `edit` / `delete` — pick a tag. `list` — all tags. `show <name>` — preview. `use <name>` — send to channel. `info <name>` — stats. `export` / `import` — JSON. 🔒 **Manage Messages**.' },
      { name: '/stickers', detail: 'Toggle Sticker Sentinel', long: 'Detects forwarded external stickers and flags them in the mod channel. 🔒 **Manage Channels**.' },
      { name: '/styledembed [title] [description]', detail: 'Send a styled embed', long: 'Creates an embed with a styled wrapper that includes a dropdown for additional options.' },
      { name: '/todolist', detail: 'Shared server todo list', long: '`add` — modal to add a task. `list` — view all. `edit` / `remove` — pick a task. `clear` — confirm to delete all. Available to all members.' },
    ],
  },
  {
    id: 'community', label: 'Reaction Roles / Giveaways / Birthday', emoji: '🎉', description: 'Panels, giveaways, birthdays', color: 0x57F287,
    commands: [
      { name: '/reactionroles', detail: 'Reaction role panels', long: '`create <channel>` — drop a role-select panel. `add <msg> <role>` — add an option. `remove <msg>` — remove an option. `list` — all panels.' },
      { name: '/giveaway', detail: 'Manage giveaways', long: '`create <prize> <duration>` — start a giveaway. `end <msg>` — end early. `reroll <msg>` — pick new winners. `delete <msg>`. `list` — all active.' },
      { name: '/birthday', detail: 'Manage your birthday', long: '`set <MM/DD> [timezone]` — register your birthday. `remove` — unregister. `list` — see all registered birthdays.' },
    ],
  },
  {
    id: 'applications', label: 'Applications', emoji: '📋', description: 'Trial apps, verification panel', color: 0xFEE75C,
    commands: [
      { name: '/makeapp', detail: 'Create an application form', long: '🔒 **Manage Channels** — Starts an interactive builder. Name your form, then type questions one at a time. Type `!stopapplication` when finished.' },
      { name: '/applicationforms', detail: 'Submit a trial application', long: 'Run this in DMs with the bot. Pick a form, answer the questions, review your answers, and confirm. Staff are notified in the configured channel.' },
      { name: '/trialapp channel', detail: 'Configure app thread channel', long: '🔒 **Manage Channels** — `set <channel>` where accepted application threads are created. `remove` to clear.' },
      { name: '/trialapp form', detail: 'Manage application forms', long: '`list` — all forms. `remove <name>` — delete a form by exact name.' },
      { name: '/verifypanel', detail: 'Create a verification panel', long: '🔒 **Manage Channels** — Opens a modal for webhook name, avatar URL, button text, message text, and role ID. The button grants the role on click.' },
    ],
  },
  {
    id: 'ai', label: 'AI / LLM Features', emoji: '🤖', description: 'AI replies, modmail, topics', color: 0x5865F2,
    commands: [
      { name: '/llm channel', detail: 'Enable / disable AI chat replies', long: '🔒 **Manage Guild** — `set [channel] [prompt]` — enable AI in a channel with an optional system prompt. `disable [channel]` — turn it off.' },
      { name: '/llm config [channel]', detail: 'Show AI chat config', long: 'Displays the current system prompt and enabled status for a channel (defaults to current).' },
      { name: '/llm clear [channel]', detail: 'Clear AI chat memory', long: 'Deletes the conversation history for a channel, giving the AI a fresh start.' },
      { name: '/topic-ai <topic>', detail: 'Generate an AI discussion topic', long: 'Describe the kind of topic you want (up to 300 characters). The LLM generates a discussion prompt for your server.' },
      { name: '/modmail channel', detail: 'Configure ModMail channel', long: '🔒 **Manage Channels** — `set <channel>` — where ModMail relay threads are created. `remove` — disable ModMail.' },
    ],
  },
  {
    id: 'games', label: 'Games & Fun', emoji: '♟️', description: 'Chess, HSR profile', color: 0xED4245,
    commands: [
      { name: '/chess', detail: 'Play chess', long: '`challenge <user>` — send a game request. `accept` / `decline`. `move <e4>` — play a move. `resign` — forfeit. `board` — show the position. `draw` — offer/accept. `ai` — play the bot. `lichess [level]` — play Stockfish (1-8) via Lichess.' },
      { name: '/hsr profile', detail: 'Astral Express main room', long: 'Renders a 960×1080 pixel-art card of the Astral Express main room from Honkai: Star Rail, composited with your Discord avatar and jade count.' },
    ],
  },
];

function buildCmdSelect(index: number): ActionRowBuilder<StringSelectMenuBuilder> {
  const cat = CATEGORIES[index];
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_cmd')
      .setPlaceholder('Select a command for details...')
      .addOptions(
        cat.commands.map(cmd => new StringSelectMenuOptionBuilder()
          .setLabel(cmd.name)
          .setDescription(cmd.detail)
          .setValue(cmd.name)
          .setEmoji({ name: cat.emoji })
        )
      ),
  );
}

function buildNavRow(index: number): ActionRowBuilder<ButtonBuilder> {
  const atStart = index === 0;
  const atEnd = index === CATEGORIES.length - 1;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(atStart),
    new ButtonBuilder()
      .setCustomId('help_label')
      .setLabel(`${CATEGORIES[index].emoji} ${CATEGORIES[index].label}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(atEnd),
  );
}

function buildContainer(index: number): ContainerBuilder {
  const cat = CATEGORIES[index];
  const cmdLines = cat.commands.map(c => `**${c.name}** — ${c.detail}`).join('\n');

  return new ContainerBuilder()
    .setAccentColor(cat.color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${cat.emoji} ${cat.label}`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(cmdLines),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Page ${index + 1} of ${CATEGORIES.length}  •  ${cat.description}`),
    )
    .addActionRowComponents(buildCmdSelect(index))
    .addActionRowComponents(buildNavRow(index));
}

function getCmdDetail(catIndex: number, cmdName: string): CmdEntry | null {
  return CATEGORIES[catIndex]?.commands.find(c => c.name === cmdName) ?? null;
}

async function runHelpCollector(msg: Message, userId: string) {
  let currentIndex = 0;

  const collector = msg.createMessageComponentCollector<ComponentType.StringSelect | ComponentType.Button>({
    time: 300000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== userId) {
      await i.reply({ embeds: [embed('Not for You', 'Only the person who ran `/help` can use these controls.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (i.isStringSelectMenu()) {
      const entry = getCmdDetail(currentIndex, i.values[0]);
      if (entry) {
        await i.reply({
          embeds: [new EmbedBuilder()
            .setColor(CATEGORIES[currentIndex].color)
            .setTitle(`${CATEGORIES[currentIndex].emoji} ${entry.name}`)
            .setDescription(entry.long)
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (i.isButton()) {
      if (i.customId === 'help_prev') currentIndex = Math.max(0, currentIndex - 1);
      else if (i.customId === 'help_next') currentIndex = Math.min(CATEGORIES.length - 1, currentIndex + 1);

      await i.update({ components: [buildContainer(currentIndex)] });
    }
  });

  collector.on('end', async () => {
    try { await msg.edit({ components: [] }); } catch {}
  });
}

async function helpCommand(interaction: ChatInputCommandInteraction) {
  const container = buildContainer(0);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  const msg = await interaction.fetchReply() as Message;
  await runHelpCollector(msg, interaction.user.id);
}

async function sendHelpToChannel(channel: any, userId: string) {
  const container = buildContainer(0);
  const msg = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  }) as Message;
  await runHelpCollector(msg, userId);
}

module.exports = { default: helpCommand, sendHelpToChannel };