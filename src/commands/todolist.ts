import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  Message,
  ModalSubmitInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  Guild,
  User
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { addTodo, getTodos, removeTodo, editTodo, clearTodos, TodoItem } from '../utils/todos';

function listDesc(items: TodoItem[]) {
  if (items.length === 0) return 'The todo list is empty.';
  return items.map(t => {
    const edited = t.editedAt ? ` (edited <t:${Math.floor(t.editedAt / 1000)}:R>)` : '';
    return `**#${t.id}** — ${t.text}  *(${t.authorTag})*${edited}`;
  }).join('\n');
}

async function addFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const modal = new ModalBuilder()
    .setCustomId('todo_add_modal')
    .setTitle('Add Todo Item')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('text').setLabel('Todo text').setStyle(TextInputStyle.Paragraph)
          .setRequired(true).setMaxLength(256).setPlaceholder('What needs to be done?...')
      )
    );

  if (interaction instanceof ChatInputCommandInteraction) {
    await interaction.showModal(modal);
    const modalSub = await interaction.awaitModalSubmit({
      filter: (i: ModalSubmitInteraction) => i.customId === 'todo_add_modal' && i.user.id === user.id,
      time: 120000
    }).catch(() => null);
    if (!modalSub) return;
    const text = modalSub.fields.getTextInputValue('text');
    const item = addTodo(guild.id, text, user.id, user.tag);
    await modalSub.reply({ embeds: [embed('Todo Added', `**#${item.id}** — ${item.text}`)], flags: MessageFlags.Ephemeral });
  } else {
    const prefixMsg = interaction;
    const dm = await user.createDM().catch(() => null);
    if (!dm) {
      await prefixMsg.reply({ embeds: [embed('DM Failed', 'Could not send a DM. Enable DMs from server members and try again.')] });
      return;
    }
    await prefixMsg.reply({ embeds: [embed('DM Sent', 'Check your DMs to add a todo item.')] });
    const trigger = await dm.send({
      embeds: [embed('Add Todo', 'Press the button below to open the todo form.')],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('todo_prefix_add').setLabel('Open Todo Form').setStyle(ButtonStyle.Primary)
        )
      ]
    });
    const btn = await trigger.awaitMessageComponent<ComponentType.Button>({
      componentType: ComponentType.Button, time: 120000
    }).catch(() => null);
    if (!btn || btn.user.id !== user.id) return;
    await btn.showModal(modal);
    const modalSub = await btn.awaitModalSubmit({
      filter: (i: ModalSubmitInteraction) => i.customId === 'todo_add_modal' && i.user.id === user.id,
      time: 120000
    }).catch(() => null);
    if (!modalSub) return;
    const text = modalSub.fields.getTextInputValue('text');
    const item = addTodo(guild.id, text, user.id, user.tag);
    await modalSub.reply({ embeds: [embed('Todo Added', `**#${item.id}** — ${item.text}`)], flags: MessageFlags.Ephemeral });
  }
}

function todoSelectOptions(items: TodoItem[]) {
  return items.slice(-25).map(t => ({
    label: `#${t.id} — ${t.text.slice(0, 50)}`,
    value: t.id.toString(),
    description: `by ${t.authorTag}`
  }));
}

async function listFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const items = getTodos(guild.id);
  if (interaction instanceof ChatInputCommandInteraction) {
    await interaction.reply({ embeds: [embed('Server Todo List', listDesc(items)).setFooter({ text: `${items.length} item(s)` })], flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ embeds: [embed('Server Todo List', listDesc(items)).setFooter({ text: `${items.length} item(s)` })] });
  }
}

async function editFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const items = getTodos(guild.id);
  if (items.length === 0) {
    const reply = { embeds: [embed('No Items', 'The todo list is empty -- nothing to edit.')], flags: MessageFlags.Ephemeral } as any;
    if (interaction instanceof ChatInputCommandInteraction) {
      await interaction.reply(reply);
    } else {
      await interaction.reply({ embeds: [embed('No Items', 'The todo list is empty -- nothing to edit.')] });
    }
    return;
  }
  const isSlash = interaction instanceof ChatInputCommandInteraction;
  const select = new StringSelectMenuBuilder()
    .setCustomId('todo_edit_select').setPlaceholder('Select an item to edit...')
    .addOptions(todoSelectOptions(items));

  let msg: Message;
  if (isSlash) {
    if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const container = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Edit Todo'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Choose which item to edit from the dropdown below.'))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    msg = await (interaction.channel as any).send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    }) as Message;
  } else {
    const prompt = embed('Edit Todo', 'Choose which item to edit from the dropdown below.');
    msg = await interaction.reply({ embeds: [prompt], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }) as Message;
  }
  const sel = await msg.awaitMessageComponent<ComponentType.StringSelect>({
    componentType: ComponentType.StringSelect, time: 60000
  }).catch(() => null);
  if (!sel || sel.user.id !== user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }
  const id = parseInt(sel.values[0], 10);
  const existing = items.find(i => i.id === id);
  const editModal = new ModalBuilder()
    .setCustomId('todo_edit_modal')
    .setTitle(`Edit Todo #${id}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('text').setLabel('New text').setStyle(TextInputStyle.Paragraph)
          .setRequired(true).setMaxLength(256).setValue(existing?.text ?? '')
      )
    );
  await sel.showModal(editModal);
  const modalSub = await sel.awaitModalSubmit({
    filter: (i: ModalSubmitInteraction) => i.customId === 'todo_edit_modal' && i.user.id === user.id,
    time: 120000
  }).catch(() => null);
  if (!modalSub) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }
  const text = modalSub.fields.getTextInputValue('text');
  const item = editTodo(guild.id, id, text);
  if (!item) {
    await modalSub.reply({ embeds: [embed('Not Found', `Todo #${id} could not be found.`)], flags: MessageFlags.Ephemeral });
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }

  if (isSlash) {
    const result = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Todo Edited'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**#${item.id}** updated to — ${item.text}`));
    try { await msg.edit({ components: [result] }); } catch {}
    await modalSub.reply({ embeds: [embed('Done', 'Todo edited successfully.')], flags: MessageFlags.Ephemeral });
  } else {
    await modalSub.reply({ embeds: [embed('Todo Edited', `**#${item.id}** updated to — ${item.text}`)], flags: MessageFlags.Ephemeral });
    try { await msg.edit({ components: [] }); } catch {}
  }
}

async function removeFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const items = getTodos(guild.id);
  if (items.length === 0) {
    const reply = { embeds: [embed('No Items', 'The todo list is empty -- nothing to remove.')], flags: MessageFlags.Ephemeral } as any;
    if (interaction instanceof ChatInputCommandInteraction) {
      await interaction.reply(reply);
    } else {
      await interaction.reply({ embeds: [embed('No Items', 'The todo list is empty -- nothing to remove.')] });
    }
    return;
  }
  const isSlash = interaction instanceof ChatInputCommandInteraction;
  const select = new StringSelectMenuBuilder()
    .setCustomId('todo_remove_select').setPlaceholder('Select an item to remove...')
    .addOptions(todoSelectOptions(items));

  let msg: Message;
  if (isSlash) {
    if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const container = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Remove Todo'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Choose which item to remove from the dropdown below.'))
      .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    msg = await (interaction.channel as any).send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    }) as Message;
  } else {
    const prompt = embed('Remove Todo', 'Choose which item to remove from the dropdown below.');
    msg = await interaction.reply({ embeds: [prompt], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] }) as Message;
  }
  const sel = await msg.awaitMessageComponent<ComponentType.StringSelect>({
    componentType: ComponentType.StringSelect, time: 60000
  }).catch(() => null);
  if (!sel || sel.user.id !== user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }
  const id = parseInt(sel.values[0], 10);
  const removed = removeTodo(guild.id, id);
  if (!removed) {
    await sel.update({ embeds: [embed('Not Found', `Todo #${id} could not be found.`)], components: [] });
    return;
  }

  if (isSlash) {
    const result = new ContainerBuilder()
      .setAccentColor(COLORS.accent)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Todo Removed'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**#${removed.id}** — ${removed.text} has been removed.`));
    await sel.update({ components: [result] });
  } else {
    await sel.update({ embeds: [embed('Todo Removed', `**#${removed.id}** — ${removed.text} has been removed.`)], components: [] });
  }
}

async function clearFlow(interaction: ChatInputCommandInteraction | Message, guild: Guild, user: User) {
  const items = getTodos(guild.id);
  if (items.length === 0) {
    const reply = { embeds: [embed('No Items', 'The todo list is already empty.')], flags: MessageFlags.Ephemeral } as any;
    if (interaction instanceof ChatInputCommandInteraction) {
      await interaction.reply(reply);
    } else {
      await interaction.reply({ embeds: [embed('No Items', 'The todo list is already empty.')] });
    }
    return;
  }
  const isSlash = interaction instanceof ChatInputCommandInteraction;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('todo_clear_confirm').setLabel('Yes, clear all').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('todo_clear_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
  const prompt = embed('Clear Todo List', `Are you sure you want to remove all **${items.length}** item(s)? This cannot be undone.`);
  let msg: Message;
  if (isSlash) {
    if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({ embeds: [prompt], components: [row] });
    msg = await interaction.fetchReply() as Message;
  } else {
    msg = await interaction.reply({ embeds: [prompt], components: [row] }) as Message;
  }
  const btn = await msg.awaitMessageComponent<ComponentType.Button>({
    componentType: ComponentType.Button, time: 30000
  }).catch(() => null);
  if (!btn || btn.user.id !== user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }
  if (btn.customId === 'todo_clear_confirm') {
    clearTodos(guild.id);
    await btn.update({ embeds: [embed('Todo List Cleared', 'All items have been removed.')], components: [] });
  } else {
    await btn.update({ embeds: [embed('Cancelled', 'The todo list was not modified.')], components: [] });
  }
}

async function todolistCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const sub = interaction.options.getSubcommand();
  const { guild, user } = interaction;
  switch (sub) {
    case 'add': await addFlow(interaction, guild, user); break;
    case 'list': await listFlow(interaction, guild, user); break;
    case 'edit': await editFlow(interaction, guild, user); break;
    case 'remove': await removeFlow(interaction, guild, user); break;
    case 'clear': await clearFlow(interaction, guild, user); break;
  }
}

module.exports = { default: todolistCommand, addFlow, editFlow, removeFlow, listFlow, clearFlow };
