import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { embed, embedColored, COLORS } from '../utils/embed';
import {
  getSaveSlots, getPlayer, getPlayerRoster, getParty,
  setPartySlot, unequipCharacter,
  getPlayerRelics, getCharacterRelics, equipRelic, unequipRelic, getRelicById,
} from '../hsr/db';

const ELEMENT_EMOJI: Record<string, string> = {
  physical: '⚔️', fire: '🔥', ice: '❄️', lightning: '⚡',
  wind: '🌪️', quantum: '🕳️', imaginary: '✨',
};

const RARITY_STARS: Record<number, string> = { 5: '★★★★★', 4: '★★★★' };

const PIECE_LABELS: Record<string, string> = {
  head: 'Head', hands: 'Hands', body: 'Body', feet: 'Feet',
  planar_sphere: 'Planar Sphere', link_rope: 'Link Rope',
};

function getLatestSlot(userId: string): number | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  slots.sort((a, b) => b.last_played.localeCompare(a.last_played));
  return slots[0].slot_number;
}

// ── Team View ──

export async function handleHsrTeam(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const container = buildTeamContainer(userId, slot);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

function buildTeamContainer(userId: string, slot: number): ContainerBuilder {
  const party = getParty(userId, slot);
  const roster = getPlayerRoster(userId, slot);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Party Setup'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Party slots
  const slots = [1, 2, 3, 4];
  for (const s of slots) {
    const char = party.find((c: any) => c.party_slot === s);
    if (char) {
      const ele = ELEMENT_EMOJI[char.element] ?? '❓';
      const stars = RARITY_STARS[char.rarity] ?? '';
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Slot ${s}:** ${ele} ${stars} **${char.name}** — Lv.${char.level} · ${char.path}`),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Slot ${s}:** *Empty*`),
      );
    }
  }

  // Roster select menu
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Roster'));

  const rosterOptions = roster.map((c: any) => {
    const ele = ELEMENT_EMOJI[c.element] ?? '❓';
    const stars = RARITY_STARS[c.rarity] ?? '';
    const equippedLabel = c.equipped ? ` [Slot ${c.party_slot}]` : '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${c.name}${equippedLabel}`)
      .setDescription(`${ele} Lv.${c.level} · ${c.path}`)
      .setValue(c.character_id);
  }).slice(0, 25);

  if (rosterOptions.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('hsr_team_select')
          .setPlaceholder('Select a character to manage...')
          .addOptions(rosterOptions),
      ),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

// ── Character Detail View ──

export async function handleHsrTeamSelect(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const charId = interaction.values[0];
  const container = buildCharacterDetail(userId, slot, charId);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

function buildCharacterDetail(userId: string, slot: number, charId: string): ContainerBuilder {
  const roster = getPlayerRoster(userId, slot);
  const char = roster.find((c: any) => c.character_id === charId);
  if (!char) {
    return new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Character Not Found'));
  }

  const ele = ELEMENT_EMOJI[char.element] ?? '❓';
  const stars = RARITY_STARS[char.rarity] ?? '';
  const equippedLabel = char.equipped ? ` — **Party Slot ${char.party_slot}**` : ' — *Not in party*';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${char.name}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${ele} ${stars} · ${char.path}${equippedLabel}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Lv.${char.level} · HP ${char.base_hp} · ATK ${char.base_atk} · DEF ${char.base_def} · SPD ${char.base_speed}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Relics on this character
  const relics = getCharacterRelics(userId, slot, charId);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Relics'));

  const equippedRelics = new Map(relics.map((r: any) => [r.piece_type, r]));
  for (const pieceType of ['head', 'hands', 'body', 'feet', 'planar_sphere', 'link_rope']) {
    const relic = equippedRelics.get(pieceType);
    const label = PIECE_LABELS[pieceType] ?? pieceType;
    if (relic) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`• **${label}:** ${relic.set_name} (Lv.${relic.level})`),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`• **${label}:** *Empty*`),
      );
    }
  }

  // Party assignment buttons
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Party Assignment'));

  const buttons: ButtonBuilder[] = [];
  if (!char.equipped) {
    // Find first empty slot
    const party = getParty(userId, slot);
    const usedSlots = party.map((c: any) => c.party_slot);
    for (let s = 1; s <= 4; s++) {
      if (!usedSlots.includes(s)) {
        buttons.push(new ButtonBuilder()
          .setCustomId(`hsr_team_assign_${charId}_${s}`)
          .setLabel(`Assign to Slot ${s}`)
          .setStyle(ButtonStyle.Success));
        break;
      }
    }
    if (party.length < 4 && buttons.length === 0) {
      buttons.push(new ButtonBuilder()
        .setCustomId(`hsr_team_assign_${charId}_auto`)
        .setLabel('Add to Party')
        .setStyle(ButtonStyle.Success));
    }
  } else {
    buttons.push(new ButtonBuilder()
      .setCustomId(`hsr_team_remove_${charId}`)
      .setLabel('Remove from Party')
      .setStyle(ButtonStyle.Danger));
  }

  if (buttons.length > 0) {
    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
  }

  // Relic equip button
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`hsr_relic_view_${charId}`).setLabel('Manage Relics').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_team').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

// ── Party Assignment ──

export async function handleHsrTeamAssign(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const charId = parts[3];
  const slotNum = parts[4];

  if (slotNum === 'auto') {
    const party = getParty(userId, slot);
    const usedSlots = party.map((c: any) => c.party_slot);
    let nextSlot = 1;
    for (let s = 1; s <= 4; s++) {
      if (!usedSlots.includes(s)) { nextSlot = s; break; }
    }
    setPartySlot(userId, slot, charId, nextSlot);
  } else {
    setPartySlot(userId, slot, charId, parseInt(slotNum));
  }

  const container = buildTeamContainer(userId, slot);
  await interaction.update({
    components: [container],
  });
}

export async function handleHsrTeamRemove(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const charId = parts[3];
  unequipCharacter(userId, slot, charId);

  const container = buildTeamContainer(userId, slot);
  await interaction.update({ components: [container] });
}

// ── Relic Management ──

export async function handleHsrRelicView(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const charId = parts[3];
  const container = buildRelicView(userId, slot, charId);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

function buildRelicView(userId: string, slot: number, charId: string): ContainerBuilder {
  const roster = getPlayerRoster(userId, slot);
  const char = roster.find((c: any) => c.character_id === charId);
  const charName = char?.name ?? charId;
  const equippedRelics = getCharacterRelics(userId, slot, charId);
  const allRelics = getPlayerRelics(userId, slot);
  const unequipped = allRelics.filter((r: any) => !r.character_id);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Relics — ${charName}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Show equipped relics
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Equipped'));
  const equippedMap = new Map(equippedRelics.map((r: any) => [r.piece_type, r]));
  for (const pieceType of ['head', 'hands', 'body', 'feet', 'planar_sphere', 'link_rope']) {
    const relic = equippedMap.get(pieceType);
    const label = PIECE_LABELS[pieceType] ?? pieceType;
    if (relic) {
      const stars = RARITY_STARS[relic.rarity] ?? '';
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`• **${label}:** ${stars} ${relic.set_name} Lv.${relic.level}`),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`• **${label}:** *Empty*`),
      );
    }
  }

  // Show unequipped relics
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Available Relics'));

  if (unequipped.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No unequipped relics available.'));
  } else {
    const relicOptions = unequipped.slice(0, 25).map((r: any) => {
      const stars = RARITY_STARS[r.rarity] ?? '';
      const pieceLabel = PIECE_LABELS[r.piece_type] ?? r.piece_type;
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${stars} ${r.set_name}`)
        .setDescription(`${pieceLabel} · Lv.${r.level}`)
        .setValue(String(r.id));
    });

    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`hsr_relic_equip_${charId}`)
          .setPlaceholder('Select a relic to equip...')
          .addOptions(relicOptions),
      ),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`hsr_team_select_${charId}`).setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

export async function handleHsrRelicEquip(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const charId = parts[3];
  const relicId = parseInt(interaction.values[0]);

  equipRelic(userId, slot, relicId, charId);

  const container = buildRelicView(userId, slot, charId);
  await interaction.update({ components: [container] });
}
