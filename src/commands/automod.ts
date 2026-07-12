import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { createAutoModRule, getAutoModRules, getAutoModRule, updateAutoModRule, deleteAutoModRule, AutoModRule, AutoModCondition, AutoModAction } from '../utils/db';
import { RULE_TEMPLATES } from '../utils/automod';

const CONDITION_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  regex: 'Regex',
  mentions: 'Mentions',
  emotes: 'Custom/Unicode Emotes',
  links: 'Links',
  caps: 'Excessive Caps',
  spoilers: 'Spoilers',
  attachments: 'Attachments',
};

const ACTION_LABELS: Record<string, string> = {
  delete: 'Delete Message',
  warn: 'Send Warning DM',
  timeout: 'Timeout User',
  log: 'Log to Channel',
};

function formatConditions(conditions: AutoModCondition[]): string {
  if (conditions.length === 0) return '(none)';
  return conditions.map(c => {
    const label = CONDITION_LABELS[c.type] || c.type;
    if (c.min !== undefined && c.max !== undefined) return `${label} (${c.min}-${c.max})`;
    if (c.min !== undefined) return `${label} >= ${c.min}`;
    if (c.max !== undefined) return `${label} <= ${c.max}`;
    if (c.value) return `${label}: \`${c.value.length > 30 ? c.value.slice(0, 30) + '...' : c.value}\``;
    return label;
  }).join(', ');
}

function formatActions(actions: AutoModAction[]): string {
  if (actions.length === 0) return '(none)';
  return actions.map(a => {
    const label = ACTION_LABELS[a.type] || a.type;
    if (a.reason) return `${label} (${a.reason})`;
    if (a.duration) return `${label} (${Math.round(a.duration / 60000)}m)`;
    return label;
  }).join(', ');
}

function buildRuleEmbed(guildId: string, rule: AutoModRule): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(rule.enabled ? 0x4FC3F7 : 0x666666)
    .setTitle(`Rule: ${rule.name}`)
    .addFields(
      { name: 'Status', value: rule.enabled ? '✅ Enabled' : '⛔ Disabled', inline: true },
      { name: 'Conditions', value: formatConditions(rule.conditions) || '*(none)*' },
      { name: 'Actions', value: formatActions(rule.actions) || '*(none)*' },
    )
    .setFooter({ text: `Created <t:${Math.floor(rule.created_at / 1000)}:R>` });
}

export async function handleAutoMod(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    await showRules(interaction);
  } else if (sub === 'create') {
    await createRule(interaction);
  } else if (sub === 'toggle') {
    await toggleRule(interaction);
  } else if (sub === 'remove') {
    await removeRule(interaction);
  } else if (sub === 'view') {
    await viewRule(interaction);
  }
}

async function showRules(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const rules = getAutoModRules(guildId);

  if (rules.length === 0) {
    await interaction.reply({ embeds: [embed('No Rules', 'No auto-mod rules configured. Use `/automod create` to add one.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const embeds = rules.map(r => buildRuleEmbed(guildId, r));
  await interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
}

async function viewRule(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);
  const rule = getAutoModRule(interaction.guild!.id, name);
  if (!rule) {
    await interaction.reply({ embeds: [embed('Not Found', `Rule \`${name}\` not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ embeds: [buildRuleEmbed(interaction.guild!.id, rule)], flags: MessageFlags.Ephemeral });
}

async function createRule(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const existing = getAutoModRules(guildId);

  const templateOptions = RULE_TEMPLATES.map(t =>
    new StringSelectMenuOptionBuilder()
      .setLabel(t.name)
      .setDescription(t.description)
      .setValue(t.name)
  );

  const allTypes = Object.keys(CONDITION_LABELS).map(t =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Custom: ${CONDITION_LABELS[t]}`)
      .setDescription(`Add a ${CONDITION_LABELS[t].toLowerCase()} condition`)
      .setValue(`cond_${t}`)
  );

  const allActions = Object.keys(ACTION_LABELS).map(t =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Action: ${ACTION_LABELS[t]}`)
      .setDescription(`Add ${ACTION_LABELS[t].toLowerCase()} action`)
      .setValue(`act_${t}`)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('am_template')
    .setPlaceholder('Select a template or start custom...')
    .addOptions([...templateOptions, ...allTypes, ...allActions].slice(0, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({
    embeds: [embed('Create Auto-Mod Rule', 'Select a template to start from, or pick individual conditions/actions to build a custom rule.')],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  const reply = await interaction.fetchReply();
  const col = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, max: 1 });

  col.on('collect', async (sel) => {
    const value = sel.values[0];
    let conditions: AutoModCondition[] = [];
    let actions: AutoModAction[] = [];
    let ruleName = '';

    const template = RULE_TEMPLATES.find(t => t.name === value);
    if (template) {
      conditions = template.conditions;
      actions = template.actions;
      ruleName = template.name;
    } else if (value.startsWith('cond_')) {
      conditions = [{ type: value.slice(5) as any }];
      ruleName = `rule-${existing.length + 1}`;
    } else if (value.startsWith('act_')) {
      actions = [{ type: value.slice(4) as any }];
      ruleName = `rule-${existing.length + 1}`;
    }

    let baseName = ruleName;
    let counter = 1;
    while (getAutoModRule(guildId, ruleName)) {
      ruleName = `${baseName}-${counter}`;
      counter++;
    }

    createAutoModRule(guildId, ruleName, conditions, actions);

    const rule = getAutoModRule(guildId, ruleName)!;
    await sel.update({
      embeds: [embed('Rule Created', `Rule **${ruleName}** created.`), buildRuleEmbed(guildId, rule)],
      components: [],
    });
  });

  col.on('end', async (collected) => {
    if (collected.size === 0) {
      try { await interaction.editReply({ embeds: [embed('Timed Out', 'Timed out.')], components: [] }); } catch {}
    }
  });
}

async function toggleRule(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);
  const guildId = interaction.guild!.id;
  const rule = getAutoModRule(guildId, name);
  if (!rule) {
    await interaction.reply({ embeds: [embed('Not Found', `Rule \`${name}\` not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  updateAutoModRule(guildId, name, { enabled: !rule.enabled });
  await interaction.reply({ embeds: [embed('Rule Toggled', `Rule **${name}** is now ${rule.enabled ? 'disabled' : 'enabled'}.`)], flags: MessageFlags.Ephemeral });
}

async function removeRule(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true);
  const guildId = interaction.guild!.id;
  const deleted = deleteAutoModRule(guildId, name);
  if (!deleted) {
    await interaction.reply({ embeds: [embed('Not Found', `Rule \`${name}\` not found.`)], flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({ embeds: [embed('Rule Deleted', `Rule **${name}** deleted.`)], flags: MessageFlags.Ephemeral });
}

export function registerCommand() {
  return new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Manage auto-moderation rules')
    .addSubcommand((sub) => sub.setName('list').setDescription('List all auto-mod rules'))
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new auto-mod rule'))
    .addSubcommand((sub) => sub.setName('view').setDescription('View a rule\'s details').addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('toggle').setDescription('Enable or disable a rule').addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('remove').setDescription('Delete a rule').addStringOption((o) => o.setName('name').setDescription('Rule name').setRequired(true)));
}

export default handleAutoMod;
