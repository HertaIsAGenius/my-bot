import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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
  AutocompleteInteraction,
  MessageFlags
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { StaffTag, createTag, getTags, getTag, findTag, editTag, deleteTag, incrementTagUses, exportTags, importTags, TagExportEntry } from '../utils/tags';

const PER_PAGE = 8;

function cleanEmbed(tag: StaffTag) {
  const e = new EmbedBuilder()
    .setColor(COLORS.accent)
    .setTitle(tag.title || tag.name);
  if (tag.content) e.setDescription(tag.content);
  if (tag.footer) e.setFooter({ text: tag.footer });
  if (tag.imageUrl) e.setImage(tag.imageUrl);
  return e;
}

function infoEmbed(tag: StaffTag) {
  const lines = [
    `**Name:** ${tag.name}`,
    tag.aliases.length > 0 ? `**Aliases:** ${tag.aliases.join(', ')}` : null,
    `**Uses:** ${tag.uses}`,
    `**Created by:** <@${tag.createdBy}>`,
    `**Created:** <t:${Math.floor(tag.createdAt / 1000)}:R>`,
    tag.updatedBy ? `**Last edited by:** <@${tag.updatedBy}>` : null,
    tag.updatedAt ? `**Last edited:** <t:${Math.floor(tag.updatedAt / 1000)}:R>` : null
  ].filter(Boolean).join('\n');
  return embed(`Tag Info — ${tag.name}`, lines);
}

function createModal() {
  return new ModalBuilder()
    .setCustomId('tag_create_modal')
    .setTitle('Create Staff Tag')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('Tag name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64).setPlaceholder('e.g. welcome')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Embed title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setPlaceholder('Helpful Tag Title')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000).setPlaceholder('Tag content... leave empty for image-only tags')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('aliases').setLabel('Aliases (optional, comma-separated)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setPlaceholder('e.g. greet, hello')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('imageUrl').setLabel('Image URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(1024).setPlaceholder('https://i.imgur.com/...')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setPlaceholder('Tag footer text')
      )
    );
}

function editModal(tag: StaffTag) {
  return new ModalBuilder()
    .setCustomId(`tag_edit_modal:${tag.name}`)
    .setTitle(`Edit Tag: ${tag.name}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('Tag name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(64).setValue(tag.name)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Embed title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setValue(tag.title || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000).setValue(tag.content || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('aliases').setLabel('Aliases (optional, comma-separated)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(tag.aliases.join(', '))
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('imageUrl').setLabel('Image URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(1024).setValue(tag.imageUrl || '')
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(tag.footer || '')
      )
    );
}

// ── Create ───────────────────────────────────────────────

async function createFlow(interaction: ChatInputCommandInteraction, guild: Guild, user: User) {
  await interaction.showModal(createModal());
  const modal = await interaction.awaitModalSubmit({
    filter: (i) => i.customId === 'tag_create_modal' && i.user.id === user.id,
    time: 120000
  }).catch(() => null);
  if (!modal) return;
  const name = modal.fields.getTextInputValue('name');
  const title = modal.fields.getTextInputValue('title');
  const description = modal.fields.getTextInputValue('description');
  const aliasesStr = modal.fields.getTextInputValue('aliases');
  const imageUrl = modal.fields.getTextInputValue('imageUrl') || undefined;
  const footer = modal.fields.getTextInputValue('footer') || undefined;
  const aliases = aliasesStr ? aliasesStr.split(',').map(a => a.trim()).filter(Boolean) : [];
  try {
    const tag = createTag(guild.id, name, description, user.id, { aliases, title, footer, imageUrl });
    await modal.reply({ embeds: [embed('Tag Created', `Tag **${tag.name}** has been created.`)], flags: MessageFlags.Ephemeral });
  } catch (e: any) {
    await modal.reply({ embeds: [embed('Error', e.message)], flags: MessageFlags.Ephemeral });
  }
}

// ── Edit ─────────────────────────────────────────────────

async function editFlow(interaction: ChatInputCommandInteraction, guild: Guild, user: User) {
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(guild.id, tagName);
  if (!tag) {
    await interaction.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.showModal(editModal(tag));
  const modal = await interaction.awaitModalSubmit({
    filter: (i) => i.customId === `tag_edit_modal:${tag.name}` && i.user.id === user.id,
    time: 120000
  }).catch(() => null);
  if (!modal) return;
  const newName = modal.fields.getTextInputValue('name');
  const title = modal.fields.getTextInputValue('title');
  const description = modal.fields.getTextInputValue('description');
  const aliasesStr = modal.fields.getTextInputValue('aliases');
  const imageUrl = modal.fields.getTextInputValue('imageUrl') || undefined;
  const footer = modal.fields.getTextInputValue('footer') || undefined;
  const aliases = aliasesStr ? aliasesStr.split(',').map(a => a.trim()).filter(Boolean) : [];
  try {
    const updated = editTag(guild.id, tag.name, { name: newName, content: description, aliases, title, footer, imageUrl }, user.id);
    if (!updated) throw new Error('Tag not found.');
    await modal.reply({ embeds: [embed('Tag Updated', `Tag **${updated.name}** has been updated.`)], flags: MessageFlags.Ephemeral });
  } catch (e: any) {
    await modal.reply({ embeds: [embed('Error', e.message)], flags: MessageFlags.Ephemeral });
  }
}

// ── Delete ───────────────────────────────────────────────

async function deleteFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(guild.id, tagName);
  if (!tag) {
    await interaction.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tag_del_confirm').setLabel('Yes, Delete').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tag_del_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
  );
  await interaction.editReply({ embeds: [embed('Confirm Delete', `Delete tag **${tag.name}**? This cannot be undone.`)], components: [row] });
  const msg = await interaction.fetchReply();
  const btn = await msg.awaitMessageComponent<ComponentType.Button>({ componentType: ComponentType.Button, time: 30000 }).catch(() => null);
  if (!btn || btn.user.id !== interaction.user.id) {
    try { await msg.edit({ components: [] }); } catch {}
    return;
  }
  if (btn.customId === 'tag_del_cancel') {
    await btn.update({ embeds: [embed('Cancelled', 'Tag was not deleted.')], components: [] });
    return;
  }
  deleteTag(guild.id, tag.name);
  await btn.update({ embeds: [embed('Tag Deleted', `Tag **${tag.name}** has been deleted.`)], components: [] });
}

// ── List (paginated) ─────────────────────────────────────

function buildListEmbed(tags: StaffTag[], page: number, totalPages: number) {
  const pageTags = tags.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const desc = pageTags.map(t => {
    const aliasStr = t.aliases.length > 0 ? ` (aliases: ${t.aliases.join(', ')})` : '';
    const preview = (t.content || t.title || t.name).slice(0, 80);
    return `**${t.name}**${aliasStr} — ${preview} *(used ${t.uses}x)*`;
  }).join('\n');
  return embed('Staff Tags', desc || 'No tags on this page.')
    .setFooter({ text: `Page ${page + 1} of ${totalPages}  •  ${tags.length} tag(s)` });
}

function buildListNav(page: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('tag_list_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('tag_list_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
  );
}

async function listFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const tags = getTags(guild.id);
  if (tags.length === 0) {
    await interaction.reply({ embeds: [embed('Staff Tags', 'No tags exist yet — create one with `/tag create`.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const totalPages = Math.ceil(tags.length / PER_PAGE);
  let page = 0;
  if (!interaction.deferred) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply({ embeds: [buildListEmbed(tags, page, totalPages)], components: [buildListNav(page, totalPages)] });
  const msg = await interaction.fetchReply() as Message;
  const col = msg.createMessageComponentCollector<ComponentType.Button>({ componentType: ComponentType.Button, time: 120000 });
  col.on('collect', async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      await btn.reply({ embeds: [embed('Not for You', 'This button is not for you.')], flags: MessageFlags.Ephemeral });
      return;
    }
    if (btn.customId === 'tag_list_prev') page = Math.max(0, page - 1);
    else if (btn.customId === 'tag_list_next') page = Math.min(totalPages - 1, page + 1);
    await btn.update({ embeds: [buildListEmbed(tags, page, totalPages)], components: [buildListNav(page, totalPages)] });
  });
  col.on('end', async () => { try { await msg.edit({ components: [] }); } catch {} });
}

// ── Show ─────────────────────────────────────────────────

async function showFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(guild.id, tagName);
  if (!tag) {
    await interaction.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ embeds: [cleanEmbed(tag)], flags: MessageFlags.Ephemeral });
}

// ── Use ──────────────────────────────────────────────────

async function useFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(guild.id, tagName);
  if (!tag) {
    await interaction.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  incrementTagUses(guild.id, tag.name);
  await interaction.reply({ embeds: [cleanEmbed(tag)] });
}

// ── Info ─────────────────────────────────────────────────

async function infoFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const tagName = interaction.options.getString('name', true);
  const tag = getTag(guild.id, tagName);
  if (!tag) {
    await interaction.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ embeds: [infoEmbed(tag)], flags: MessageFlags.Ephemeral });
}

// ── Export ───────────────────────────────────────────────

async function exportFlow(interaction: ChatInputCommandInteraction, guild: Guild) {
  const entries = exportTags(guild.id);
  if (entries.length === 0) {
    await interaction.reply({ embeds: [embed('No Tags', 'No tags to export.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const json = JSON.stringify(entries, null, 2);
  const fs = require('node:fs');
  const path = require('node:path');
  const os = require('node:os');
  const filePath = path.join(os.tmpdir(), `tags-${guild.id}.json`);
  fs.writeFileSync(filePath, json, 'utf-8');
  await interaction.reply({ embeds: [embed('Tags Exported', `Exported **${entries.length}** tag(s).`)], files: [filePath], flags: MessageFlags.Ephemeral });
  fs.unlink(filePath, () => {});
}

// ── Import ───────────────────────────────────────────────

async function importFlow(interaction: ChatInputCommandInteraction) {
  const importModal = new ModalBuilder()
    .setCustomId('tag_import_modal')
    .setTitle('Import Tags')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('json_data').setLabel('Paste tag JSON data').setStyle(TextInputStyle.Paragraph)
          .setRequired(true).setMaxLength(4000).setPlaceholder('[{"name":"example","title":"My Tag","description":"...","footer":"...","imageUrl":"...","aliases":[]}]')
      )
    );
  await interaction.showModal(importModal);
}

async function handleImportSubmit(interaction: any, guild: Guild, user: User) {
  const json = interaction.fields.getTextInputValue('json_data');
  let entries: TagExportEntry[];
  try {
    entries = JSON.parse(json);
    if (!Array.isArray(entries)) throw new Error('Root must be an array.');
  } catch (e: any) {
    await interaction.reply({ embeds: [embed('Invalid JSON', `Invalid JSON: ${e.message}`)], flags: MessageFlags.Ephemeral });
    return;
  }
  const result = importTags(guild.id, entries, user.id);
  const msg = `Imported **${result.imported}** tag(s).${result.skipped.length > 0 ? ` Skipped ${result.skipped.length} invalid entry(s).` : ''}`;
  await interaction.reply({ embeds: [embed('Import Complete', msg)], flags: MessageFlags.Ephemeral });
}

// ── Autocomplete ─────────────────────────────────────────

async function tagAutocomplete(interaction: AutocompleteInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) { await interaction.respond([]); return; }
  const focused = interaction.options.getFocused().toLowerCase();
  const tags = getTags(guildId);
  const matches = tags.filter(t => t.name.includes(focused) || t.aliases.some(a => a.includes(focused)));
  await interaction.respond(matches.slice(0, 25).map(t => ({ name: `${t.name} — ${t.title || t.name}`, value: t.name })));
}

// ── Router ───────────────────────────────────────────────

async function tagCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const user = interaction.user;

  const needsManage = ['create', 'edit', 'delete', 'import'];
  if (needsManage.includes(sub) && !interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need **Manage Server** permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  switch (sub) {
    case 'create': await createFlow(interaction, guild, user); break;
    case 'edit': await editFlow(interaction, guild, user); break;
    case 'delete': await deleteFlow(interaction, guild); break;
    case 'list': await listFlow(interaction, guild); break;
    case 'show': await showFlow(interaction, guild); break;
    case 'use': await useFlow(interaction, guild); break;
    case 'info': await infoFlow(interaction, guild); break;
    case 'export': await exportFlow(interaction, guild); break;
    case 'import': await importFlow(interaction); break;
  }
}

async function tagMessageFlow(message: Message, guild: Guild, user: User) {
  const parts = message.content.slice(1).trim().split(/\s+/);
  const sub = parts[1]?.toLowerCase();
  if (sub === 'create' || sub === 'edit' || sub === 'delete' || sub === 'import') {
    await message.reply({ embeds: [embed('Slash Command', `Use the slash command \`/tag ${sub}\` to manage tags.`)] });
    return;
  }
  const tagName = sub;
  if (!tagName) {
    await message.reply({ embeds: [embed('Usage', 'Usage: `!tag <name>` — send a tag. See `/tag list` for available tags.')] });
    return;
  }
  const tag = findTag(guild.id, tagName);
  if (!tag) {
    await message.reply({ embeds: [embed('Not Found', `Tag **${tagName}** not found. Use \`/tag list\` to see available tags.`)] });
    return;
  }
  incrementTagUses(guild.id, tag.name);
  const e = new EmbedBuilder().setColor(COLORS.accent).setTitle(tag.title || tag.name);
  if (tag.content) e.setDescription(tag.content);
  if (tag.footer) e.setFooter({ text: tag.footer });
  if (tag.imageUrl) e.setImage(tag.imageUrl);
  if (message.channel.isTextBased() && !message.channel.isDMBased()) {
    await (message.channel as any).send({ embeds: [e] });
  }
}

module.exports = { default: tagCommand, tagMessageFlow, tagAutocomplete, handleImportSubmit };
