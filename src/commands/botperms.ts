import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ComponentType,
  Message,
  MessageFlags
} from 'discord.js';
import { getCommandRoles, setCommandRoles, getAllPerms } from '../utils/botperms';

const ALL_COMMANDS = [
  'addxp', 'help', 'leaderboard', 'levelrole', 'logging', 'modchannel',
  'rank', 'slowmode', 'stickers', 'stop', 'tag', 'ticket', 'ticketmessagecreate',
  'todolist', 'top3', 'verifypanel', 'weekly', 'weeklyreset', 'xpclear'
].sort();

const pendingState = new Map<string, { commandName: string }>();

export default async function botpermsCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand(false);

  if (sub === 'list') {
    await showList(interaction);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const options = ALL_COMMANDS.map(name => {
    const roles = getCommandRoles(interaction.guild!.id, name);
    const desc = roles.length > 0 ? `${roles.length} role(s)` : 'Everyone';
    return new StringSelectMenuOptionBuilder().setLabel(name).setDescription(desc).setValue(name);
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('bp_cmd_sel')
    .setPlaceholder('Select a command...')
    .addOptions(options);

  const container = new ContainerBuilder()
    .setAccentColor(0x2B3A67)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Bot Permissions'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a command to manage which roles can use it.\nRoles not selected will be denied.'))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));

  const msg = await (interaction.channel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  // First collector: command selection (StringSelect)
  const cmdCol = msg.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 120000,
    max: 1
  });

  cmdCol.on('collect', async (sel: any) => {
    if (sel.user.id !== interaction.user.id) {
      await sel.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });
      return;
    }

    const cmdName = sel.values[0];
    pendingState.set(interaction.user.id, { commandName: cmdName });

    const currentRoles = getCommandRoles(interaction.guild!.id, cmdName);

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('bp_role_sel')
      .setPlaceholder('Select role(s) to allow...')
      .setMinValues(0)
      .setMaxValues(25);

    if (currentRoles.length > 0) {
      roleSelect.setDefaultRoles(currentRoles);
    }

    const roleContainer = new ContainerBuilder()
      .setAccentColor(0x2B3A67)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Permissions — /${cmdName}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Select which roles can use this command.\nLeave empty to allow everyone.\nRoles not selected will be denied.'))
      .addActionRowComponents(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect));

    await sel.update({ components: [roleContainer] });

    // Second collector: role selection (RoleSelect)
    const roleCol = msg.createMessageComponentCollector({
      componentType: ComponentType.RoleSelect,
      time: 60000,
      max: 1
    });

    roleCol.on('collect', async (roleSel: any) => {
      if (roleSel.user.id !== interaction.user.id) {
        await roleSel.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });
        return;
      }

      const state = pendingState.get(interaction.user.id);
      if (!state) {
        await roleSel.reply({ content: 'Session expired. Run /botperms again.', flags: MessageFlags.Ephemeral });
        return;
      }

      const roleIds = roleSel.values;
      setCommandRoles(interaction.guild!.id, state.commandName, roleIds);
      pendingState.delete(interaction.user.id);

      const roleText = roleIds.length > 0
        ? roleIds.map((id: string) => `<@&${id}>`).join(', ')
        : 'Everyone';

      const result = new ContainerBuilder()
        .setAccentColor(0x2B3A67)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Permissions Updated'))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**/${state.commandName}**\nAllowed: ${roleText}`));

      await roleSel.update({ components: [result] });
    });

    roleCol.on('end', async (collected) => {
      if (collected.size === 0) {
        try { await msg.edit({ components: [] }); } catch {}
      }
    });
  });

  cmdCol.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await msg.edit({ components: [] }); } catch {}
    }
  });
}

async function showList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const perms = getAllPerms(guild.id);
  const PER_PAGE = 5;
  const pages: Array<{ command: string; roles: string[] }[]> = [];
  for (let i = 0; i < ALL_COMMANDS.length; i += PER_PAGE) {
    pages.push(ALL_COMMANDS.slice(i, i + PER_PAGE).map(name => ({
      command: name,
      roles: perms.find(p => p.command === name)?.roles ?? []
    })));
  }

  let currentPage = 0;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pageOptions = pages.map((_, i) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Page ${i + 1}`)
      .setDescription(`Commands ${i * PER_PAGE + 1}-${Math.min((i + 1) * PER_PAGE, ALL_COMMANDS.length)}`)
      .setValue(String(i))
  );

  const navSelect = new StringSelectMenuBuilder()
    .setCustomId('bp_page_sel')
    .setPlaceholder('Select a page...')
    .addOptions(pageOptions);

  const entries = pages[0];
  const desc = entries.map(e => {
    const roleText = e.roles.length > 0
      ? e.roles.map((id: string) => `<@&${id}>`).join(', ')
      : 'Everyone';
    return `**/${e.command}**\nAllowed: ${roleText}`;
  }).join('\n\n');

  const navContainer = new ContainerBuilder()
    .setAccentColor(0x2B3A67)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Bot Permissions — List\n\n${desc}`))
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(navSelect));

  const msg = await (interaction.channel as any).send({
    components: [navContainer],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const col = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120000 });
  col.on('collect', async (sel: any) => {
    if (sel.user.id !== interaction.user.id) {
      await sel.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });
      return;
    }
    currentPage = parseInt(sel.values[0], 10);

    const entries2 = pages[currentPage];
    const desc2 = entries2.map(e => {
      const roleText = e.roles.length > 0
        ? e.roles.map((id: string) => `<@&${id}>`).join(', ')
        : 'Everyone';
      return `**/${e.command}**\nAllowed: ${roleText}`;
    }).join('\n\n');

    const updated = new ContainerBuilder()
      .setAccentColor(0x2B3A67)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Bot Permissions — List\n\n${desc2}`))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(navSelect));

    await sel.update({ components: [updated] });
  });
  col.on('end', async () => {
    try { await msg.edit({ components: [] }); } catch {}
  });
}

// Exports kept for compatibility - no longer used in index.ts
export async function handleCommandSelect(interaction: any) {}
export async function handleRoleSelect(interaction: any) {}

module.exports = { default: botpermsCommand, handleCommandSelect, handleRoleSelect };
