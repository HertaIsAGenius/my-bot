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
  MessageFlags
} from 'discord.js';

interface HelpEntry {
  name: string;
  short: string;
  detail: string;
}

const allCommands: HelpEntry[] = [
  {
    name: 'Ticket',
    short: 'Advanced ticket system',
    detail: '**Slash:** `/ticket` • **Prefix:** `!tickets`\n\nSubcommands:\n`panel` — Open a new ticket\n`claim` / `unclaim` — Assign yourself to a ticket\n`close` — Close with optional note (modal)\n`reopen` — Reopen a closed ticket\n`priority` — Set low/medium/high priority\n`note` — Add an internal staff note\n`rename` — Rename the ticket thread\n`search` — Search ticket transcripts\n`stats` — View ticket analytics\n`config` — Configure categories, pings, and limits\n\nTickets are private threads. Only the creator and staff with `Manage Threads` can see them.'
  },
  {
    name: 'TicketMessageCreate',
    short: 'Send the ticket creation panel',
    detail: '**Slash:** `/ticketmessagecreate`\n\nOpens a modal where you paste embed JSON. The bot bulk-deletes the channel, then sends the panel via webhook with a category dropdown. The bot\'s name never appears on the panel.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Help',
    short: 'Show this paginated command menu',
    detail: '**Slash:** `/help` • **Prefix:** `!help`\n\nOpens this menu. Use the dropdown to see detailed help for any command. Navigate pages with the Prev / Next buttons.\n\n**Available to:** All members'
  },
  {
    name: 'Todo List',
    short: 'Shared server todo list',
    detail: '**Slash:** `/todolist` • **Prefix:** `!todolist`\n\nFully ephemeral. Opens a menu with options:\n`add` — Modal to add a task\n`list` — View all tasks\n`edit` — Select a task then modal to edit\n`remove` — Select a task to delete\n`clear` — Confirm button to clear all\n\n**Available to:** All members'
  },
  {
    name: 'Mod Channel',
    short: 'Set the moderator notification channel',
    detail: '**Slash:** `/modchannel` • **Prefix:** `!modchannel`\n\nOpens a ChannelSelect menu — pick the text channel where moderation alerts, reports, and logs are sent.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Slowmode',
    short: 'Toggle auto slowmode per channel',
    detail: '**Slash:** `/slowmode` • **Prefix:** `!slowmode on|off`\n\nOpens a StringSelect to enable/disable/configure auto slowmode for the current channel. When enabled, the bot automatically applies slowmode during high traffic.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Logging',
    short: 'Toggle message and reaction logging',
    detail: '**Slash:** `/logging` • **Prefix:** `!logmessages` or `!logreactions`\n\nOpens a StringSelect to enable/disable:\n- **Message Log** — Logs message edits and deletions\n- **Reaction Log** — Logs reaction additions and removals\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Sticker Sentinel',
    short: 'Detect forwarded external stickers',
    detail: '**Slash:** `/stickers`\n\nOpens a StringSelect to enable/disable sticker detection. When enabled, any message containing a forwarded sticker from another server is flagged and logged to the mod channel.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Staff Tags',
    short: 'Rich embed tag system',
    detail: '**Slash:** `/tag create basic|image|edit|delete|list|show|use` • **Prefix:** `!tagname`\n\nSubcommands:\n`create basic` — Modal with title, description, footer, and an optional "Set Image" button\n`create image` — Modal with title, description, and direct image URL\n`edit` — Select a tag, then modal to update fields\n`delete` — Select a tag to remove\n`list` — View all tags for the server\n`show` — Display a tag without using it\n`use` — Increment use counter without showing\n\nPrefix: just type `!tagname` in any channel to send the tag embed.\n\n**Required Permission:** `Manage Messages`'
  },
  {
    name: 'Rank',
    short: 'Check your XP and level',
    detail: '**Slash:** `/rank [user]`\n\nShows the user\'s current level, XP (current / needed for next level), a progress bar, total messages, weekly XP, weekly rank, and days until weekly reset.\n\n**Available to:** All members'
  },
  {
    name: 'Leaderboard',
    short: 'Top 10 by lifetime XP',
    detail: '**Slash:** `/leaderboard`\n\nDisplays the top 10 users ranked by lifetime XP. Each entry shows mention, level in backticks, XP, and a progress bar. Top 3 have detailed formatting.\n\n**Available to:** All members'
  },
  {
    name: 'Add XP',
    short: 'Manually add XP to a user',
    detail: '**Slash:** `/addxp <user> <amount>`\n\nSelect the user and enter a positive number of XP to add. Useful for events or corrections. The change is saved immediately and the user\'s level is recalculated if needed.\n\n**Required Permission:** `Manage Server`'
  },
  {
    name: 'Top 3',
    short: 'Generate a leaderboard PNG image',
    detail: '**Slash:** `/top3`\n\nGenerates a high-quality PNG showing the top 3 users by lifetime XP. The image includes: banner space at the top, circular avatar crops with coloured rings, rank badges, gradient progress bars, and a dark gradient background.\n\n**Available to:** All members'
  },
  {
    name: 'Weekly',
    short: 'Top 10 by weekly XP',
    detail: '**Slash:** `/weekly`\n\nDisplays the top 10 users ranked by XP earned this week. Weekly XP resets manually via `/weeklyreset`.\n\n**Available to:** All members'
  },
  {
    name: 'Weekly Reset',
    short: 'Reset all weekly XP counters',
    detail: '**Slash:** `/weeklyreset`\n\nResets the weekly XP for all users in this server. This is the **only** way to reset weekly XP — there is no automatic 7-day reset.\n\n**Required Permission:** `Manage Server`'
  },
  {
    name: 'Verify Panel',
    short: 'Create a verification button panel',
    detail: '**Slash:** `/verifypanel`\n\nOpens a modal with fields:\n- **Webhook Name** — Name shown on the panel message\n- **Avatar URL** — Avatar for the webhook\n- **Button Text** — Text on the role-grant button\n- **Message Text** — The message above the button\n- **Role ID** — The role granted when the button is clicked\n\nThe bot creates a webhook, sends the message, and clicking the button grants the role.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Bot Perms',
    short: 'Restrict commands to specific roles',
    detail: '**Slash:** `/botperms` • **Subcommand:** `list`\n\nSelect a command from the dropdown, then pick roles from the RoleSelect. Only members with at least one of the selected roles can use that command. If no roles are set for a command, everyone can use it.\n\n`/botperms list` — Shows all restricted commands, paginated 5 per page.\n\n**Required Permission:** `Administrator`'
  },
  {
    name: 'Level-Up Notifications',
    short: 'Redirect level-up messages to a channel',
    detail: '**Slash:** `/levelupnotification channel set #channel` or `remove`\n\n`set` — Select a text channel. All level-up messages will be sent there.\n`remove` — Clears the channel. Level-up messages go to the user\'s current channel.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Trial App',
    short: 'Configure trial application destination',
    detail: '**Slash:** `/trialapp channel set #channel` or `remove`\n\n`set` — Select the text channel where accepted application threads are created.\n`remove` — Clears the configuration.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Make App',
    short: 'Create a custom application form',
    detail: '**Slash:** `/makeapp`\n\nStarts an interactive form builder. The bot asks for a form name, then you type questions one at a time. Type `!stopapplication` in chat when finished. The form is saved to `data/trialapps.json`.\n\n**Required Permission:** `Manage Channels`'
  },
  {
    name: 'Trial App Start',
    short: 'Submit a trial application',
    detail: '**Slash:** `/applicationforms` (DMs only)\n\nRun this command in DMs with the bot. You\'ll see a dropdown of available forms, then answer each question one at a time. When done, review your answers and click Accept or Cancel. Accepted applications are posted in the configured trial channel as a private thread.\n\n**Available to:** All members'
  },
  {
    name: 'Stop',
    short: 'Gracefully shut down the bot',
    detail: '**Slash:** `/stop` • **Prefix:** `!stop`\n\nShuts down the bot process gracefully. The bot will be offline until restarted manually.\n\n**Required Permission:** `Manage Server`'
  }
];

const PER_PAGE = 8;

function getPages<T>(arr: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += PER_PAGE) {
    pages.push(arr.slice(i, i + PER_PAGE));
  }
  return pages;
}

function buildContainer(page: number, totalPages: number): ContainerBuilder {
  const pages = getPages(allCommands);
  const entries = pages[page] || [];
  const desc = entries.map(e => `**${e.name}** — ${e.short}`).join('\n');
  return new ContainerBuilder()
    .setAccentColor(0x2B3A67)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Bot Commands'),
      new TextDisplayBuilder().setContent(
        (desc || 'No commands on this page.') + '\n\n\u200B\nUse the dropdown below to select a command for detailed help.'
      ),
      new TextDisplayBuilder().setContent(`-# Page ${page + 1} of ${totalPages}  •  8 commands per page`)
    )
    .addActionRowComponents(buildSelectRow(page))
    .addActionRowComponents(buildNavRow(page, totalPages));
}

function buildSelectRow(page: number): ActionRowBuilder<StringSelectMenuBuilder> {
  const pages = getPages(allCommands);
  const entries = pages[page] || [];
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_cmd_sel')
      .setPlaceholder('Select a command for details...')
      .addOptions(
        entries.map(e => new StringSelectMenuOptionBuilder()
          .setLabel(e.name)
          .setDescription(e.short)
          .setValue(e.name)
          .setEmoji({ name: '🔧' })
        )
      )
  );
}

function buildNavRow(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1)
  );
}

function getCommandDetail(name: string): string | null {
  return allCommands.find(c => c.name === name)?.detail ?? null;
}

async function runHelpCollector(msg: Message, userId: string) {
  const pages = getPages(allCommands);
  const totalPages = pages.length;
  let currentPage = 0;

  const collector = msg.createMessageComponentCollector<ComponentType.StringSelect | ComponentType.Button>({
    time: 180000
  });

  collector.on('collect', async (sel) => {
    if (sel.user.id !== userId) {
      await sel.reply({ content: 'These controls are not for you.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (sel.isStringSelectMenu()) {
      const detail = getCommandDetail(sel.values[0]);
      if (detail) {
        const embed = new EmbedBuilder()
          .setColor(0x2B3A67)
          .setTitle(`🔧 ${sel.values[0]}`)
          .setDescription(detail);
        await sel.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      return;
    }

    if (sel.isButton()) {
      if (sel.customId === 'help_prev') currentPage = Math.max(0, currentPage - 1);
      else if (sel.customId === 'help_next') currentPage = Math.min(totalPages - 1, currentPage + 1);

      await sel.update({
        components: [buildContainer(currentPage, totalPages)]
      });
    }
  });

  collector.on('end', async () => {
    try { await msg.edit({ components: [] }); } catch {}
  });
}

async function helpCommand(interaction: ChatInputCommandInteraction) {
  const container = buildContainer(0, getPages(allCommands).length);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
  const msg = await interaction.fetchReply() as Message;
  await runHelpCollector(msg, interaction.user.id);
}

async function sendHelpToChannel(channel: any, userId: string) {
  const container = buildContainer(0, getPages(allCommands).length);
  const msg = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }) as Message;
  await runHelpCollector(msg, userId);
}

module.exports = { default: helpCommand, sendHelpToChannel };
