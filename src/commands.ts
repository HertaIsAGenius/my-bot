import { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all bot commands, organised by category'),
  new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Manage message and reaction logging')
    .addSubcommand((sub) => sub.setName('messages').setDescription('Toggle message logging'))
    .addSubcommand((sub) => sub.setName('reactions').setDescription('Toggle reaction logging')),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Advanced ticket system')
    .addSubcommandGroup((group) =>
      group.setName('config').setDescription('Configure ticket settings')
        .addSubcommand((sub) => sub.setName('view').setDescription('View current ticket configuration'))
        .addSubcommand((sub) => sub.setName('category').setDescription('Set the category for ticket channels').addChannelOption((o) => o.setName('channel').setDescription('Category channel').setRequired(true).addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand((sub) => sub.setName('logchannel').setDescription('Set the ticket log channel').addChannelOption((o) => o.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand((sub) => sub.setName('supportrole').setDescription('Toggle a support role').addRoleOption((o) => o.setName('role').setDescription('Role to add/remove').setRequired(true)))
        .addSubcommand((sub) => sub.setName('pingrole').setDescription('Set the role pinged when a thread ticket is created').addStringOption((o) => o.setName('category').setDescription('Ticket category').setRequired(true).addChoices({ name: 'Server Inquiries', value: 'inquiry' }, { name: 'Server Reports', value: 'report' }, { name: 'Staff Reports', value: 'staffreport' }, { name: 'HSR Questions', value: 'hsr' })).addRoleOption((o) => o.setName('role').setDescription('Role to ping (omit to clear)').setRequired(false)))
    )
    .addSubcommand((sub) => sub.setName('claim').setDescription('Claim the current ticket'))
    .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket').addStringOption((o) => o.setName('reason').setDescription('Reason for closing').setRequired(false)))
    .addSubcommand((sub) => sub.setName('reopen').setDescription('Reopen a closed ticket').addIntegerOption((o) => o.setName('id').setDescription('Ticket ID').setRequired(true)))
    .addSubcommand((sub) => sub.setName('priority').setDescription('Set ticket priority').addIntegerOption((o) => o.setName('id').setDescription('Ticket ID').setRequired(true)).addStringOption((o) => o.setName('level').setDescription('Priority level').setRequired(true).addChoices({ name: 'Low', value: 'low' }, { name: 'Medium', value: 'medium' }, { name: 'High', value: 'high' }, { name: 'Urgent', value: 'urgent' })))
    .addSubcommand((sub) => sub.setName('note').setDescription('Add an internal note to the current ticket').addStringOption((o) => o.setName('content').setDescription('Note content').setRequired(true)))
    .addSubcommand((sub) => sub.setName('rename').setDescription('Rename the current ticket channel').addStringOption((o) => o.setName('name').setDescription('New channel name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('search').setDescription('Search tickets').addStringOption((o) => o.setName('user').setDescription('Filter by user ID').setRequired(false)).addStringOption((o) => o.setName('status').setDescription('Filter by status').setRequired(false).addChoices({ name: 'Open', value: 'open' }, { name: 'Claimed', value: 'claimed' }, { name: 'Closed', value: 'closed' })).addStringOption((o) => o.setName('category').setDescription('Filter by category').setRequired(false).addChoices({ name: 'Support', value: 'support' }, { name: 'Bug', value: 'bug' }, { name: 'Purchase', value: 'purchase' }, { name: 'Staff', value: 'staff' }, { name: 'Other', value: 'other' })))
    .addSubcommand((sub) => sub.setName('stats').setDescription('Show ticket analytics')),
  new SlashCommandBuilder()
    .setName('ticketmessagecreate')
    .setDescription('Send a ticket creation panel in this channel'),
  new SlashCommandBuilder()
    .setName('todolist')
    .setDescription('Server-wide shared todo list')
    .addSubcommand((sub) => sub.setName('add').setDescription('Add a new item'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List all items'))
    .addSubcommand((sub) => sub.setName('edit').setDescription('Edit an item'))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Remove an item'))
    .addSubcommand((sub) => sub.setName('clear').setDescription('Clear all items')),
  new SlashCommandBuilder()
    .setName('modchannel')
    .setDescription('Set moderator notification channel'),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the bot process gracefully.'),
  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Manage auto slowmode for the current channel.'),
  new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Staff tag management and usage')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new staff tag'))
    .addSubcommand((sub) => sub.setName('edit').setDescription('Edit an existing staff tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Delete a staff tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List all staff tags'))
    .addSubcommand((sub) => sub.setName('show').setDescription('Preview a staff tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('use').setDescription('Send a staff tag to this channel').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('info').setDescription('Show tag info/stats').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('export').setDescription('Export all tags as JSON'))
    .addSubcommand((sub) => sub.setName('import').setDescription('Import tags from JSON')),
  new SlashCommandBuilder()
    .setName('stickers')
    .setDescription('Enable or disable forwarded sticker detection (Sticker Sentinel)'),
  new SlashCommandBuilder()
    .setName('rankcard')
    .setDescription('Customise your rank card appearance')
    .addSubcommand((sub) => sub.setName('view').setDescription('View your current rank card customisation'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('Reset rank card to defaults'))
    .addSubcommandGroup((group) =>
      group.setName('set').setDescription('Set a rank card style option')
        .addSubcommand((sub) => sub.setName('background').setDescription('Set background colour').addStringOption((o) => o.setName('value').setDescription('Hex colour (#ff8844)').setRequired(true)))
        .addSubcommand((sub) => sub.setName('accent').setDescription('Set accent colour').addStringOption((o) => o.setName('value').setDescription('Hex colour (#ff8844)').setRequired(true)))
        .addSubcommand((sub) => sub.setName('bar').setDescription('Set XP bar colour').addStringOption((o) => o.setName('value').setDescription('Hex colour (#ff8844)').setRequired(true)))
        .addSubcommand((sub) => sub.setName('avatar').setDescription('Set avatar border style').addStringOption((o) => o.setName('value').setDescription('hexagon / circle / square').setRequired(true)))
        .addSubcommand((sub) => sub.setName('font').setDescription('Set font family name').addStringOption((o) => o.setName('value').setDescription('Font family').setRequired(true)))
        .addSubcommand((sub) => sub.setName('bgimage').setDescription('Set background image URL ("none" to clear)').addStringOption((o) => o.setName('value').setDescription('Image URL or "none"').setRequired(true)))
    ),
  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your or another user\'s level and XP')
    .addUserOption((o) => o.setName('user').setDescription('The user to check (defaults to you)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 users by XP'),
  new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Manually add XP to a user (Manage Server)')
    .addUserOption((o) => o.setName('user').setDescription('The user to grant XP').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount of XP to add').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('verifypanel')
    .setDescription('Create a verification panel with webhook and role-grant button'),
  new SlashCommandBuilder()
    .setName('top3')
    .setDescription('Generate a leaderboard image of the top 3 users'),
  new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('Show the top 10 users by weekly XP'),
  new SlashCommandBuilder()
    .setName('weeklyreset')
    .setDescription('Reset all weekly XP counters (Manage Server)'),
  new SlashCommandBuilder()
    .setName('botperms')
    .setDescription('Manage which roles can use each slash command')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all command permissions'))
    .addSubcommand((sub) => sub.setName('change').setDescription('Change which roles can use a command')),
  new SlashCommandBuilder()
    .setName('levelupnotification')
    .setDescription('Configure level-up notification channel')
    .addSubcommand((sub) =>
      sub.setName('channel').setDescription('Set or remove the level-up notification channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Text channel (leave empty to remove)').setRequired(false).addChannelTypes(ChannelType.GuildText))
    ),
  new SlashCommandBuilder()
    .setName('trialapp')
    .setDescription('Configure trial application settings')
    .addSubcommandGroup((group) =>
      group.setName('channel').setDescription('Set the application thread channel')
        .addSubcommand((sub) => sub.setName('set').setDescription('Set the channel for application threads').addChannelOption((o) => o.setName('channel').setDescription('Text channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand((sub) => sub.setName('remove').setDescription('Remove the application channel'))
    )
    .addSubcommandGroup((group) =>
      group.setName('form').setDescription('Manage application forms')
        .addSubcommand((sub) => sub.setName('list').setDescription('List all application forms'))
        .addSubcommand((sub) => sub.setName('remove').setDescription('Remove an application form').addStringOption((o) => o.setName('name').setDescription('Exact name of the form to remove').setRequired(true)))
    ),
  new SlashCommandBuilder()
    .setName('makeapp')
    .setDescription('Create a custom application form'),
  new SlashCommandBuilder()
    .setName('applicationforms')
    .setDescription('Start a trial application (run in bot DMs)'),
  new SlashCommandBuilder()
    .setName('levelrole')
    .setDescription('Auto-assign a role when a member reaches a level')
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Set a role reward for reaching a level')
        .addIntegerOption((o) => o.setName('level').setDescription('Level required').setRequired(true).setMinValue(1))
        .addRoleOption((o) => o.setName('role').setDescription('Role to assign').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove a level role reward')
        .addIntegerOption((o) => o.setName('level').setDescription('Level to remove').setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all level role rewards')
    ),
  new SlashCommandBuilder()
    .setName('xpclear')
    .setDescription('Clear all XP and level data for this server (Manage Server)'),
  new SlashCommandBuilder()
    .setName('styledembed')
    .setDescription('Send a styled embed that visually wraps around a dropdown')
    .addStringOption((o) => o.setName('title').setDescription('Embed title').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('Embed description').setRequired(false)),
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage auto-moderation rules')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all auto-mod rules'))
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new auto-mod rule'))
    .addSubcommand((sub) => sub.setName('view').setDescription("View a rule's details").addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('toggle').setDescription('Enable or disable a rule').addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Delete a rule').addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true))),

  // ─── NEW ECONOMY COMMANDS ─────────────────────────
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s wallet and bank balance')
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(false)),
  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),
  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn some cash'),
  new SlashCommandBuilder()
    .setName('beg')
    .setDescription('Beg for some coins'),
  new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gamble your cash for a chance to win more')
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount to gamble').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Pay another user')
    .addUserOption((o) => o.setName('user').setDescription('User to pay').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount to pay').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user (very risky)')
    .addUserOption((o) => o.setName('user').setDescription('User to rob').setRequired(true)),
  new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Deposit cash into your bank')
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount to deposit').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw cash from your bank')
    .addIntegerOption((o) => o.setName('amount').setDescription('Amount to withdraw').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse the server shop'),
  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the shop')
    .addIntegerOption((o) => o.setName('item').setDescription('Item ID to buy').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory')
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(false)),
  new SlashCommandBuilder()
    .setName('ecoleaderboard')
    .setDescription('Show the richest users'),
  new SlashCommandBuilder()
    .setName('shopadmin')
    .setDescription('Manage the server shop (Manage Server)')
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Add an item to the shop')
        .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true))
        .addIntegerOption((o) => o.setName('price').setDescription('Price').setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('description').setDescription('Item description').setRequired(false))
        .addRoleOption((o) => o.setName('role').setDescription('Role to grant on purchase').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove an item from the shop')
        .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true))
    ),

  // ─── NEW WELCOME / GOODBYE / AUTO-ROLE ─────────────
  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome messages')
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Set welcome message configuration')
        .addChannelOption((o) => o.setName('channel').setDescription('Welcome channel').setRequired(false).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message').setDescription('Message ({user}, {server})').setRequired(false))
        .addStringOption((o) => o.setName('toggle').setDescription('Enable or disable').setRequired(false).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
    )
    .addSubcommand((sub) => sub.setName('test').setDescription('Test the welcome message')),
  new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('Configure goodbye messages')
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Set goodbye message configuration')
        .addChannelOption((o) => o.setName('channel').setDescription('Goodbye channel').setRequired(false).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message').setDescription('Message ({user}, {server})').setRequired(false))
        .addStringOption((o) => o.setName('toggle').setDescription('Enable or disable').setRequired(false).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
    )
    .addSubcommand((sub) => sub.setName('test').setDescription('Test the goodbye message')),
  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Manage auto-role on join')
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Add a role to auto-assign')
        .addRoleOption((o) => o.setName('role').setDescription('Role to assign').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove a role from auto-assign')
        .addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all auto-assigned roles')),

  // ─── NEW REACTION ROLES ──────────────────────────
  new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Manage reaction role panels')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Create a new reaction role panel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for the panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('title').setDescription('Panel title').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('Panel description').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('add').setDescription('Add a role to an existing panel')
        .addChannelOption((o) => o.setName('channel').setDescription('Panel channel').setRequired(true))
        .addStringOption((o) => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji for the option').setRequired(false))
        .addStringOption((o) => o.setName('label').setDescription('Display label').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('Option description').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove a role from a panel')
        .addStringOption((o) => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji to remove (omit to clear all)').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all reaction role panels')),

  // ─── NEW GIVEAWAYS ──────────────────────────────
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Create a new giveaway')
        .addStringOption((o) => o.setName('prize').setDescription('Prize to give away').setRequired(true))
        .addIntegerOption((o) => o.setName('duration').setDescription('Duration in seconds').setRequired(true).setMinValue(10))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setRequired(false).setMinValue(1))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to post in').setRequired(false).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('description').setDescription('Giveaway description').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName('end').setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('reroll').setDescription('Reroll a giveaway')
        .addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('delete').setDescription('Delete a giveaway')
        .addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all giveaways')),

  // ─── NEW SERVER STATS ────────────────────────────
  new SlashCommandBuilder()
    .setName('serverstats')
    .setDescription('Manage live server stats counters')
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Create or update counter channels')
        .addChannelOption((o) => o.setName('category').setDescription('Category for counter channels').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
        .addStringOption((o) => o.setName('prefix').setDescription('Channel name prefix').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('remove').setDescription('Remove counter channels'))
    .addSubcommand((sub) => sub.setName('view').setDescription('View current config')),

  // ─── NEW JOIN-TO-CREATE ──────────────────────────
  new SlashCommandBuilder()
    .setName('jointocreate')
    .setDescription('Manage Join-to-Create voice channels')
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Set the join-to-create voice channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Voice channel to trigger on').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
        .addChannelOption((o) => o.setName('category').setDescription('Category for created channels').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
        .addStringOption((o) => o.setName('format').setDescription('Channel name format ({user})').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('remove').setDescription('Disable join-to-create'))
    .addSubcommand((sub) => sub.setName('view').setDescription('View current config')),

  // ─── NEW BIRTHDAY ────────────────────────────────
  new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Set your birthday')
        .addStringOption((o) => o.setName('date').setDescription('MM/DD format (e.g., 12/25)').setRequired(true))
        .addStringOption((o) => o.setName('timezone').setDescription('Timezone (e.g., America/New_York)').setRequired(false))
    )
    .addSubcommand((sub) => sub.setName('remove').setDescription('Remove your birthday'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List all birthdays')),

  // ─── NEW MODERATION ─────────────────────────────
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete (0-7)').setRequired(false).setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addUserOption((o) => o.setName('user').setDescription('User to unban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .addUserOption((o) => o.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption((o) => o.setName('duration').setDescription('Duration in seconds').setRequired(true).setMinValue(1))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a member')
    .addUserOption((o) => o.setName('user').setDescription('User to untimeout').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to lock').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to unlock').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('cases')
    .setDescription('View moderation cases')
    .addUserOption((o) => o.setName('user').setDescription('Filter by user').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('case')
    .setDescription('View a specific moderation case')
    .addIntegerOption((o) => o.setName('id').setDescription('Case ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // ─── SLUMBER GUARD ─────────────────────────────
  new SlashCommandBuilder()
    .setName('slumberguard')
    .setDescription('Automatic anti-raid slowmode (Slumber Guard)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('help').setDescription('List all presets with descriptions')
    )
    .addSubcommand((sub) =>
      sub.setName('set').setDescription('Set Slumber Guard on a channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Text channel').setRequired(true))
        .addStringOption((o) => o.setName('preset').setDescription('Preset name').setRequired(true))
        .addStringOption((o) => o.setName('toggle').setDescription('Enable or disable').setRequired(false).addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all configured channels')
    )
    .addSubcommand((sub) =>
      sub.setName('preset').setDescription('Manage custom presets')
        .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'View', value: 'view' }, { name: 'Custom', value: 'custom' }, { name: 'Delete', value: 'delete' }))
        .addStringOption((o) => o.setName('name').setDescription('Preset name').setRequired(true))
        .addIntegerOption((o) => o.setName('threshold_users').setDescription('Unique users to trigger').setRequired(false).setMinValue(1))
        .addIntegerOption((o) => o.setName('threshold_time').setDescription('Time window in seconds').setRequired(false).setMinValue(1))
        .addIntegerOption((o) => o.setName('slowmode_time').setDescription('Slowmode seconds to set').setRequired(false).setMinValue(0))
        .addIntegerOption((o) => o.setName('slowmode_length').setDescription('How long slowmode stays active (seconds)').setRequired(false).setMinValue(1))
        .addIntegerOption((o) => o.setName('min_messages').setDescription('Minimum total messages').setRequired(false).setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Reset all presets to defaults')
    ),

  // ─── HSR (Astral Express) ────────────────────────────
  new SlashCommandBuilder()
    .setName('hsr')
    .setDescription('Astral Express — Honkai Star Rail')
    .addSubcommand((sub) =>
      sub.setName('profile').setDescription('View your Trailblazer profile'),
    )
    .addSubcommand((sub) =>
      sub.setName('begin').setDescription('Begin your Trailblazer journey'),
    )
    .addSubcommand((sub) =>
      sub.setName('explore').setDescription('Explore your current location'),
    )
    .addSubcommand((sub) =>
      sub.setName('warp').setDescription('Warp for new characters and light cones'),
    )
    .addSubcommand((sub) =>
      sub.setName('dailies').setDescription('View and claim daily commissions'),
    ),

  // ─── MOD DASHBOARD ──────────────────────────────
  new SlashCommandBuilder()
    .setName('moddashboard')
    .setDescription('Manage the in-discord moderation dashboard panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Create the mod dashboard panel in this channel')
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Remove the mod dashboard panel')
    ),

  // ─── LLM (AI Chat) ──────────────────────────────
  new SlashCommandBuilder()
    .setName('llm')
    .setDescription('Manage AI chat replies in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group.setName('channel').setDescription('Configure AI chat for a channel')
        .addSubcommand((sub) => sub.setName('set').setDescription('Enable AI replies in a channel').addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to current)').setRequired(false)).addStringOption((o) => o.setName('prompt').setDescription('Custom system prompt').setRequired(false)))
        .addSubcommand((sub) => sub.setName('disable').setDescription('Disable AI replies in a channel').addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to current)').setRequired(false)))
    )
    .addSubcommand((sub) => sub.setName('config').setDescription('Show AI config for a channel').addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to current)').setRequired(false)))
    .addSubcommand((sub) => sub.setName('clear').setDescription('Clear chat memory for a channel').addChannelOption((o) => o.setName('channel').setDescription('Channel (defaults to current)').setRequired(false))),

  // ─── Invite ──────────────────────────────────────
  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite link to add this bot to your server'),

  // ─── Topic AI ────────────────────────────────────
  new SlashCommandBuilder()
    .setName('topic-ai')
    .setDescription('Generate a discussion topic using AI')
    .addStringOption((o) => o.setName('topic').setDescription('Describe the kind of topic you want (up to 300 characters)').setRequired(true).setMaxLength(300)),

  // ─── ModMail ──────────────────────────────────────
  new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Configure ModMail settings')
    .addSubcommandGroup((group) =>
      group.setName('channel').setDescription('Manage the ModMail channel')
        .addSubcommand((sub) => sub.setName('set').setDescription('Set the channel for ModMail threads').addChannelOption((o) => o.setName('channel').setDescription('Text channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand((sub) => sub.setName('remove').setDescription('Remove the ModMail channel'))
    ),

  // ─── Ask (NL Command Router) ────────────────────
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the bot something in natural language — I\'ll route it to the right feature')
    .addStringOption((o) => o.setName('query').setDescription('What do you want to know or do?').setRequired(true).setMaxLength(500)),

  // ─── Chess ───────────────────────────────────────
  new SlashCommandBuilder()
    .setName('chess')
    .setDescription('Play a game of chess')
    .addSubcommand((sub) =>
      sub.setName('challenge').setDescription('Challenge a user to a chess game')
        .addUserOption((o) => o.setName('opponent').setDescription('The user to challenge').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName('accept').setDescription('Accept a pending challenge'),
    )
    .addSubcommand((sub) =>
      sub.setName('decline').setDescription('Decline a pending challenge'),
    )
    .addSubcommand((sub) =>
      sub.setName('move').setDescription('Make a move in algebraic notation')
        .addStringOption((o) => o.setName('move').setDescription('Your move (e.g., e4, Nf3, O-O, exd5)').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub.setName('resign').setDescription('Resign the current game'),
    )
    .addSubcommand((sub) =>
      sub.setName('board').setDescription('Show the current board'),
    )
    .addSubcommand((sub) =>
      sub.setName('draw').setDescription('Offer or accept a draw'),
    )
    .addSubcommand((sub) =>
      sub.setName('ai').setDescription('Start a game against the AI'),
    )
    .addSubcommand((sub) =>
      sub.setName('lichess').setDescription('Play vs Stockfish via Lichess')
        .addIntegerOption((o) => o.setName('level').setDescription('Stockfish level (1-8)').setRequired(false).setMinValue(1).setMaxValue(8))
        .addStringOption((o) => o.setName('color').setDescription('Your color').setRequired(false).addChoices({ name: 'Random', value: 'random' }, { name: 'White', value: 'white' }, { name: 'Black', value: 'black' })),
    ),

].map((command) => command.toJSON());

export async function registerCommands(clientId: string, guildId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering global slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Global slash commands registered (propagation may take up to an hour).');
  } catch (error) {
    console.error('Failed to register commands', error);
  }
}

export { commands };
