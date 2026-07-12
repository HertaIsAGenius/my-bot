import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  RoleSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  MessageFlags
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getCommandRoles, setCommandRoles, getAllPerms } from '../utils/botperms';

const ALL_COMMANDS = [
  'addxp', 'applicationforms', 'ask', 'automod', 'autorole', 'balance', 'ban', 'beg', 'birthday',
  'buy', 'case', 'cases', 'chess', 'daily', 'deposit', 'ecoleaderboard', 'gamble',
  'giveaway', 'goodbye', 'help', 'hsr', 'invite', 'inventory', 'jointocreate', 'kick',
  'leaderboard', 'levelrole', 'levelupnotification', 'llm', 'lock', 'logging',
  'makeapp', 'modchannel', 'moddashboard', 'modmail', 'pay', 'purge', 'rank',
  'rankcard', 'reactionroles', 'rob', 'serverstats', 'shop', 'shopadmin', 'slowmode',
  'slumberguard', 'stickers', 'stop', 'styledembed', 'tag', 'ticket',
  'ticketmessagecreate', 'timeout', 'todolist', 'top3', 'topic-ai', 'trialapp',
  'unban', 'unlock', 'untimeout', 'verifypanel', 'warn', 'weekly', 'weeklyreset',
  'welcome', 'withdraw', 'work', 'xpclear'
].sort();

const CMD_PER_PAGE = 25;
const commandPages: string[][] = [];
for (let i = 0; i < ALL_COMMANDS.length; i += CMD_PER_PAGE) {
  commandPages.push(ALL_COMMANDS.slice(i, i + CMD_PER_PAGE));
}

function roleNames(guild: any, ids: string[]): string {
  if (ids.length === 0) return 'Everyone';
  return ids.map(id => guild.roles.cache.get(id)?.name ?? `\`${id}\``).join(', ');
}

function roleMentions(guild: any, ids: string[]): string {
  if (ids.length === 0) return 'Everyone';
  return ids.map(id => guild.roles.cache.get(id)?.toString() ?? `\`${id}\``).join(', ');
}

const pendingState = new Map<string, { commandName: string }>();

export default async function botpermsCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand(false);

  if (sub === 'list') {
    await showList(interaction);
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let cmdPage = 0;

  function buildMainContainer(): ContainerBuilder {
    const pageCommands = commandPages[cmdPage];
    const options = pageCommands.map(name => {
      const roles = getCommandRoles(interaction.guild!.id, name);
      const desc = roles.length > 0 ? `${roles.length} role(s)` : 'Everyone';
      return new StringSelectMenuOptionBuilder().setLabel(name).setDescription(desc).setValue(name);
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId('bp_cmd_sel')
      .setPlaceholder('Select a command...')
      .addOptions(options);

    const prevBtn = new ButtonBuilder()
      .setCustomId('bp_cmd_prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cmdPage === 0);

    const pageLabel = new ButtonBuilder()
      .setCustomId('_')
      .setLabel(`Page ${cmdPage + 1}/${commandPages.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const nextBtn = new ButtonBuilder()
      .setCustomId('bp_cmd_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cmdPage >= commandPages.length - 1);

    return new ContainerBuilder()
      .setAccentColor(0x2B3A67)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Bot Permissions'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Select a command to manage which roles can use it.\nRoles not selected will be denied.'))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select))
      .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, pageLabel, nextBtn));
  }

  const msg = await (interaction.channel as any).send({
    components: [buildMainContainer()],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const col = msg.createMessageComponentCollector({ time: 120000 });

  col.on('collect', async (i: any) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (i.componentType === ComponentType.Button) {
      if (i.customId === 'bp_cmd_prev') {
        cmdPage = Math.max(0, cmdPage - 1);
      } else if (i.customId === 'bp_cmd_next') {
        cmdPage = Math.min(commandPages.length - 1, cmdPage + 1);
      } else {
        return;
      }

      await i.update({ components: [buildMainContainer()] });
      return;
    }

    if (i.componentType !== ComponentType.StringSelect || i.customId !== 'bp_cmd_sel') return;

    col.stop();

    const cmdName = i.values[0];
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

    await i.update({ components: [roleContainer] });

    const roleCol = msg.createMessageComponentCollector({
      componentType: ComponentType.RoleSelect,
      time: 60000,
      max: 1
    });

    roleCol.on('collect', async (roleSel: any) => {
      if (roleSel.user.id !== interaction.user.id) {
        await roleSel.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const state = pendingState.get(interaction.user.id);
      if (!state) {
        await roleSel.reply({ embeds: [embed('Session Expired', 'Session expired. Run /botperms again.')], flags: MessageFlags.Ephemeral });
        return;
      }

      const roleIds = roleSel.values;
      setCommandRoles(interaction.guild!.id, state.commandName, roleIds);
      pendingState.delete(interaction.user.id);

      const roleText = roleNames(interaction.guild!, roleIds);

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

  col.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await msg.edit({ components: [] }); } catch {}
    }
  });
}

async function showList(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const perms = getAllPerms(guild.id);
  const LIST_PER_PAGE = 5;
  const listPages: Array<{ command: string; roles: string[] }[]> = [];
  for (let i = 0; i < ALL_COMMANDS.length; i += LIST_PER_PAGE) {
    listPages.push(ALL_COMMANDS.slice(i, i + LIST_PER_PAGE).map(name => ({
      command: name,
      roles: perms.find(p => p.command === name)?.roles ?? []
    })));
  }

  let currentPage = 0;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  function buildListContainer(page: number): ContainerBuilder {
    const entries = listPages[page];
    const container = new ContainerBuilder()
      .setAccentColor(0x2B3A67)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# List of all Bot Perms (Page ${page + 1}/${listPages.length})`));

    for (const e of entries) {
      container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## /${e.command}\nAllowed: ${roleMentions(guild, e.roles)}`));
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    const prevBtn = new ButtonBuilder()
      .setCustomId('bp_list_prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const pageLabel = new ButtonBuilder()
      .setCustomId('_')
      .setLabel(`Page ${page + 1}/${listPages.length}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const nextBtn = new ButtonBuilder()
      .setCustomId('bp_list_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= listPages.length - 1);

    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, pageLabel, nextBtn));
    container.addSeparatorComponents(new SeparatorBuilder());

    const firstBtn = new ButtonBuilder()
      .setCustomId('bp_list_first')
      .setLabel('⏮ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    const lastBtn = new ButtonBuilder()
      .setCustomId('bp_list_last')
      .setLabel('⏭ Last')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= listPages.length - 1);

    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(firstBtn, lastBtn));

    return container;
  }

  const msg = await (interaction.channel as any).send({
    components: [buildListContainer(0)],
    flags: MessageFlags.IsComponentsV2
  }) as Message;

  const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

  col.on('collect', async (i: any) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ embeds: [embed('Not for You', 'These controls are not for you.')], flags: MessageFlags.Ephemeral });
      return;
    }

    switch (i.customId) {
      case 'bp_list_prev':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'bp_list_next':
        currentPage = Math.min(listPages.length - 1, currentPage + 1);
        break;
      case 'bp_list_first':
        currentPage = 0;
        break;
      case 'bp_list_last':
        currentPage = listPages.length - 1;
        break;
      default:
        return;
    }

    await i.update({ components: [buildListContainer(currentPage)] });
  });

  col.on('end', async () => {
    try { await msg.edit({ components: [] }); } catch {}
  });
}

export async function handleCommandSelect(interaction: any) {}
export async function handleRoleSelect(interaction: any) {}
