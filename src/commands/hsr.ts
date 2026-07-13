import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { embed, embedColored } from '../utils/embed';
import { db, getSaveSlots, createSaveSlot, createPlayer, addCharacterToPlayer, createDefaultExpress, discoverLocation, getPlayer, getPlayerCharacters, addItem, deleteSaveSlot, getPlayerQuestEntries, getAchievementsByCategory, getActiveQuests } from '../hsr/db';
import { handleHsrExplore } from './hsr_explore';
import { handleHsrWarp } from './hsr_warp';
import { handleHsrDailies } from './hsr_dailies';

const SLOT_EMOJIS = [
  { name: '1stSlotSprite', id: '1525094704000008242' },
  { name: '2ndSlotSprite', id: '1525093211725627513' },
  { name: '3rdSlotSprite', id: '1525101815518068827' },
  { name: '4thSlotSprite', id: '1525099532898271252' },
  { name: '5thSlotSprite', id: '1525096844659785858' },
];
const PRONOUNS = [
  { label: 'they/them', value: 'they/them' },
  { label: 'she/her', value: 'she/her' },
  { label: 'he/him', value: 'he/him' },
  { label: 'any/all', value: 'any/all' },
  { label: 'Custom…', value: '_custom' },
];

const PATHS = [
  { id: 'hunt', label: 'The Hunt', emoji: '🎯', desc: '+15% SPD first round.' },
  { id: 'erudition', label: 'Erudition', emoji: '💡', desc: '+3 Energy per enemy kill.' },
  { id: 'harmony', label: 'Harmony', emoji: '🎵', desc: '+1 Skill Point per wave.' },
  { id: 'nihility', label: 'Nihility', emoji: '💜', desc: 'Debuffs last +1 turn.' },
  { id: 'preservation', label: 'Preservation', emoji: '🛡️', desc: '+15% DEF, 25% taunt on hit.' },
  { id: 'abundance', label: 'Abundance', emoji: '🌿', desc: 'Heal 5% HP per turn.' },
];

// ── Builders ──

function buildSlotPicker(userId: string) {
  const existing = getSaveSlots(userId);
  const options = [];
  for (let i = 1; i <= 5; i++) {
    const slot = existing.find(s => s.slot_number === i);
    if (slot) {
      const p = getPlayer(userId, i);
      if (p) {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`Slot ${i} — ${slot.traveler_name}`)
            .setDescription(`Lv.${p.trailblaze_level} · ${slot.starting_path} · ${slot.last_played.slice(0, 10)}`)
            .setValue(`load_${i}`)
            .setEmoji(SLOT_EMOJIS[i - 1]),
        );
      } else {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`Slot ${i} — Corrupted`)
            .setDescription('Save data is damaged — recreate this slot.')
            .setValue(`create_${i}`)
            .setEmoji({ name: '🔴' }),
        );
      }
    } else {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Slot ${i} — Empty`)
          .setDescription('Create a new Trailblazer here.')
          .setValue(`create_${i}`)
          .setEmoji({ name: '⬜' }),
      );
    }
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('hsr_slot_pick').setPlaceholder('Choose a save slot…').addOptions(options),
  );
}

function buildBeginModal(slot: number) {
  const modal = new ModalBuilder().setCustomId(`hsr_begin_${slot}`).setTitle('Create Your Trailblazer');
  const travelerInput = new TextInputBuilder()
    .setCustomId('traveler_name').setLabel('Trailblazer name (2-20 chars)')
    .setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(20).setPlaceholder('Enter your name…').setRequired(true);
  const expressInput = new TextInputBuilder()
    .setCustomId('express_name').setLabel('Astral Express name (2-30 chars)')
    .setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(30).setPlaceholder('Enter a name for your Express…').setRequired(true);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(travelerInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(expressInput),
  );
  return modal;
}

function buildPronounPicker() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('hsr_pronouns').setPlaceholder('Select your pronouns…').addOptions(
      PRONOUNS.map(p => {
        const opt = new StringSelectMenuOptionBuilder().setLabel(p.label).setValue(p.value);
        if (p.value === '_custom') opt.setDescription('Type your own');
        return opt;
      }),
    ),
  );
}

function buildPathPicker() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId('hsr_path').setPlaceholder('Choose your starting Path…').addOptions(
      PATHS.map(p => new StringSelectMenuOptionBuilder()
        .setLabel(`${p.emoji} ${p.label}`).setValue(p.id).setDescription(p.desc)),
    ),
  );
}

function buildCustomPronounModal() {
  const modal = new ModalBuilder().setCustomId('hsr_pronouns_custom').setTitle('Your Pronouns');
  const input = new TextInputBuilder()
    .setCustomId('pronoun_input').setLabel('Enter your pronouns (e.g. ze/zir)')
    .setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(30).setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

// ── In-memory creation state ──

const creationState = new Map<string, { slot: number; travelerName?: string; expressName?: string; pronouns?: string }>();

// ── Command handler ──

export default async function hsrCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'begin') {
    const userId = interaction.user.id;
    const slots = getSaveSlots(userId);
    if (slots.length >= 5) {
      await interaction.reply({
        embeds: [embed('Slots Full', 'You already have 5 saves. Delete one to create a new character.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    creationState.delete(userId);
    await interaction.reply({
      embeds: [embed('Create Your Trailblazer', 'Choose a save slot to begin your journey.')],
      components: [buildSlotPicker(userId)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'profile') {
    await handleHsrProfile(interaction);
    return;
  }

  if (sub === 'explore') {
    await handleHsrExplore(interaction);
    return;
  }

  if (sub === 'warp') {
    await handleHsrWarp(interaction);
    return;
  }

  if (sub === 'dailies') {
    await handleHsrDailies(interaction);
    return;
  }

  await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
}

const BAR_EMPTY_START = '<:LoadBarEmpty1:1523289923799482409>';
const BAR_FILLED_START = '<:LoadBar1:1523277881164435506>';
const BAR_EMPTY_MID = '<:LoadBarEmpty2:1523290039872917574>';
const BAR_FILLED_MID = '<:LoadBar2:1523278877533929593>';
const BAR_EMPTY_END = '<:LoadBarEmpty3:1523290155622862889>';
const BAR_ALMOST_END = '<:LoadBar4:1523278813176397944>';
const BAR_FULL_END = '<:loadbarfull4:1525944079219691581>';

function getLoadBar(current: number, max: number): string {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const start = pct > 5 ? BAR_FILLED_START : BAR_EMPTY_START;
  let filledMids: number;
  let end: string;
  if (pct <= 5)       { filledMids = 0; end = BAR_EMPTY_END; }
  else if (pct <= 19) { filledMids = 0; end = BAR_EMPTY_END; }
  else if (pct <= 30) { filledMids = 1; end = BAR_EMPTY_END; }
  else if (pct <= 49) { filledMids = 2; end = BAR_EMPTY_END; }
  else if (pct <= 65) { filledMids = 3; end = BAR_EMPTY_END; }
  else if (pct <= 84) { filledMids = 4; end = BAR_ALMOST_END; }
  else                { filledMids = 4; end = BAR_FULL_END; }
  return start + BAR_FILLED_MID.repeat(filledMids) + BAR_EMPTY_MID.repeat(4 - filledMids) + end;
}

export async function handleHsrProfile(interaction: any) {
  const isSlash = interaction.isChatInputCommand();
  const userId = interaction.user.id;
  const slots = getSaveSlots(userId);
  if (slots.length === 0) {
    const payload = { embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral };
    if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
    return;
  }
  const slot = slots.sort((a, b) => b.last_played.localeCompare(a.last_played))[0];
  const player = getPlayer(userId, slot.slot_number);
  if (!player) {
    const payload = { embeds: [embed('Corrupted Save', 'Use `/hsr begin` and choose **Corrupted** to recreate this slot.')], flags: MessageFlags.Ephemeral };
    if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
    return;
  }
  const party = getPlayerCharacters(userId, slot.slot_number).filter((c: any) => c.equipped);
  const pathLabel = PATHS.find(p => p.id === slot.starting_path)?.label ?? slot.starting_path;
  const mc = party.length > 0 ? party[0] : null;
  const quests = getPlayerQuestEntries(userId, slot.slot_number).slice(0, 3);
  const achievements = getAchievementsByCategory(userId, slot.slot_number, 'story').slice(0, 2);
  const activeQuests = getActiveQuests(userId, slot.slot_number);
  const questSummary = quests.length > 0 ? quests.map((q: any) => `${q.status === 'completed' ? '✓' : '•'} ${q.title}`).join('\n') : 'No quests yet.';
  const achievementSummary = achievements.length > 0 ? achievements.map((a: any) => `${a.unlocked ? '✓' : '•'} ${a.title}`).join('\n') : 'No story achievements yet.';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Trailblazer Profile'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${slot.traveler_name} · Lv.${player.trailblaze_level} Trailblazer`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${player.trailblaze_xp}/${player.trailblaze_level * 100} | ${Math.round(player.trailblaze_xp / (player.trailblaze_level * 100) * 100)}% XP`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(getLoadBar(player.trailblaze_xp, player.trailblaze_level * 100)))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Character Information'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${slot.pronouns}\` · Path of ${pathLabel}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(mc ? `${mc.name} \`(Lv.${mc.level})\`` : 'No character equipped'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(mc ? `${mc.xp ?? 0}/${(mc.level ?? 1) * 50} | ${Math.round(((mc.xp ?? 0) / ((mc.level ?? 1) * 50)) * 100)}% XP` : ''))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(mc ? getLoadBar(mc.xp ?? 0, (mc.level ?? 1) * 50) : BAR_EMPTY_START + BAR_EMPTY_MID.repeat(4) + BAR_EMPTY_END))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Currency Information'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${player.credits.toLocaleString()} Credits`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${player.stellar_jade.toLocaleString()} Stellar Jade`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Trailblaze Power Reserve'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Adventure Progress'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Active Quests: ${activeQuests.length}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(questSummary))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Achievements'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(achievementSummary))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${player.trailblaze_power}/240 | ${Math.round((player.trailblaze_power / 240) * 100)}%`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(getLoadBar(player.trailblaze_power, 240)))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`${player.trailblaze_power}/${player.trailblaze_power_max}\` in Reserve`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_dailies').setLabel('Dailies').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_express').setLabel('Astral Express').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_quests').setLabel('Quest Board').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_team').setLabel('Party').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_explore').setLabel('Explore').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Warp').setStyle(ButtonStyle.Secondary),
      ),
    );
  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
}

// ── Interaction handlers (registered in index.ts registry) ──

export async function handleHsrQuestBoard(interaction: any) {
  const userId = interaction.user.id;
  const slots = getSaveSlots(userId);
  if (slots.length === 0) {
    await interaction.update({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], components: [] });
    return;
  }
  const slot = slots.sort((a, b) => b.last_played.localeCompare(a.last_played))[0].slot_number;
  const quests = getPlayerQuestEntries(userId, slot);
  const storyAchievements = getAchievementsByCategory(userId, slot, 'story');
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Quest Board'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Active & Completed Quests'));

  if (quests.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No quests available yet.'));
  } else {
    for (const q of quests.slice(0, 8)) {
      const icon = q.status === 'completed' ? '✓' : q.status === 'active' ? '•' : '○';
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${icon} **${q.title}** — ${q.description}`));
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Story Achievements'));

  if (storyAchievements.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No story achievements earned yet.'));
  } else {
    for (const a of storyAchievements.slice(0, 6)) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${a.unlocked ? '✓' : '•'} ${a.title}`));
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleHsrSlotPick(interaction: any) {
  const userId = interaction.user.id;
  const [action, slotStr] = interaction.values[0].split('_');
  const slot = parseInt(slotStr);

  if (action === 'load') {
    creationState.delete(userId);
    await interaction.update({
      embeds: [embed('Save Loaded', `Welcome back! Use \`/hsr profile\` to continue.`)],
      components: [],
    });
    return;
  }

  // Create new — show modal (defers the select interaction)
  creationState.set(userId, { slot });
  await interaction.showModal(buildBeginModal(slot));
}

export async function handleHsrBeginModal(interaction: any) {
  const userId = interaction.user.id;
  const state = creationState.get(userId);
  if (!state) {
    await interaction.reply({ embeds: [embed('Session Expired', 'Use `/hsr begin` again.')], flags: MessageFlags.Ephemeral });
    return;
  }
  state.travelerName = interaction.fields.getTextInputValue('traveler_name');
  state.expressName = interaction.fields.getTextInputValue('express_name');
  creationState.set(userId, state);

  await interaction.update({
    embeds: [embed('Pronouns', `**${state.travelerName}** of the **${state.expressName}**.\n\nWhat pronouns do you use?`)],
    components: [buildPronounPicker()],
  });
}

export async function handleHsrPronouns(interaction: any) {
  const userId = interaction.user.id;
  const state = creationState.get(userId);
  if (!state) return;

  const value = interaction.values[0];
  if (value === '_custom') {
    await interaction.showModal(buildCustomPronounModal());
    return;
  }

  state.pronouns = value;
  creationState.set(userId, state);
  await interaction.update({
    embeds: [embed('Choose Your Path', `**${state.travelerName}** — ${value}\n\nEvery Trailblazer walks a Path. Your choice grants a permanent passive bonus.`)],
    components: [buildPathPicker()],
  });
}

export async function handleHsrPronounsCustom(interaction: any) {
  const userId = interaction.user.id;
  const state = creationState.get(userId);
  if (!state) return;

  state.pronouns = interaction.fields.getTextInputValue('pronoun_input');
  creationState.set(userId, state);
  await interaction.update({
    embeds: [embed('Choose Your Path', `**${state.travelerName}** — ${state.pronouns}\n\nEvery Trailblazer walks a Path. Your choice grants a permanent passive bonus.`)],
    components: [buildPathPicker()],
  });
}

export async function handleHsrPath(interaction: any) {
  const userId = interaction.user.id;
  const state = creationState.get(userId);
  if (!state) return;

  const pathId = interaction.values[0];
  const pathInfo = PATHS.find(p => p.id === pathId)!;
  creationState.delete(userId);

  try {
    const createTransaction = db.transaction(() => {
      deleteSaveSlot(userId, state.slot);
      createSaveSlot(userId, state.slot, {
        traveler_name: state.travelerName!,
        express_name: state.expressName!,
        pronouns: state.pronouns!,
        starting_path: pathId,
      });
      createPlayer(userId, state.slot, pathId, 'master_control_zone');
      addCharacterToPlayer(userId, state.slot, 'trailblazer_physical');
      createDefaultExpress(userId, state.slot);
      discoverLocation(userId, state.slot, 'master_control_zone');
      addItem(userId, state.slot, 'adventure_log', 3);
    });
    createTransaction();

    await interaction.update({
      embeds: [embedColored(0xf2c866, 'The Trailblaze Begins',
        `**${state.travelerName}** awakens aboard the **${state.expressName}**.\n\n` +
        `**Path of ${pathInfo.label}** — ${pathInfo.desc}\n` +
        `Pronouns: ${state.pronouns}\n\n` +
        `The Stellaron hums. The cosmos waits.\n\n` +
        `Use \`/hsr profile\` to begin your adventure.`,
      )],
      components: [],
    });
  } catch (err) {
    console.error('[HSR] Creation error:', err);
    await interaction.update({
      embeds: [embed('Error', 'Something went wrong creating your save. Try again.')],
      components: [],
    });
  }
}
