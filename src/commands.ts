import { REST, Routes, SlashCommandBuilder, ChannelType } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show assistance for all commands.'),
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
    .addSubcommand((sub) => sub.setName('list').setDescription('List all command permissions')),
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
    .addStringOption((o) => o.setName('description').setDescription('Embed description').setRequired(false))
].map((command) => command.toJSON());

export async function registerCommands(clientId: string, guildId: string, token: string) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Slash commands registered successfully.');

    // Register /applicationforms globally so it works in DMs
    const appFormsJson = commands.find((c: any) => c.name === 'applicationforms');
    if (appFormsJson) {
      await rest.put(Routes.applicationCommands(clientId), { body: [appFormsJson] });
      console.log('Global command /applicationforms registered for DM support.');
    }
  } catch (error) {
    console.error('Failed to register commands', error);
  }
}
