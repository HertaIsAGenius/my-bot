import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import {
  getSaveSlots, getPlayer, getPlayerRoster, getParty,
  setPartySlot, unequipCharacter, getCharacterLightCone,
} from '../hsr/db';

const RARITY_STARS: Record<number, string> = { 5: '★★★★★', 4: '★★★★' };

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

const CHARS_PER_PAGE = 4;

function getLatestSlot(userId: string): number | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  slots.sort((a, b) => b.last_played.localeCompare(a.last_played));
  return slots[0].slot_number;
}

function errContainer(msg: string): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Error'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(msg))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
    ));
}

// ── Party Setup ──

export async function handleHsrTeam(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.update({ components: [errContainer('Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const container = buildPartySetup(userId, slot);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

function buildPartySetup(userId: string, slot: number): ContainerBuilder {
  const party = getParty(userId, slot);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Party Setup'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (let s = 1; s <= 4; s++) {
    const char = party.find((c: any) => c.party_slot === s);
    if (char) {
      const stars = RARITY_STARS[char.rarity] ?? '';
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Character ${s}:** ${char.name} ${stars}`),
      );
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`hsr_team_char_${char.character_id}`)
            .setLabel('View Character')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`hsr_team_remove_${char.character_id}`)
            .setLabel('Remove Character')
            .setStyle(ButtonStyle.Danger),
        ),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Character ${s}:** Empty`),
      );
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`hsr_team_roster_${s}`)
            .setLabel('Add Character')
            .setStyle(ButtonStyle.Primary),
        ),
      );
    }
    if (s < 4) {
      container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

// ── Roster View (ephemeral, paginated select menu) ──

function getSortedRoster(userId: string, slot: number): any[] {
  const roster = getPlayerRoster(userId, slot);
  return [...roster].sort((a: any, b: any) => a.name.localeCompare(b.name));
}

function buildRosterPage(userId: string, slot: number, targetSlot: number, page: number): ContainerBuilder {
  const sorted = getSortedRoster(userId, slot);
  const totalPages = Math.max(1, Math.ceil(sorted.length / CHARS_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * CHARS_PER_PAGE;
  const chars = sorted.slice(start, start + CHARS_PER_PAGE);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Unlocked Character Menu (page ${safePage + 1} of ${totalPages})`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const options = chars.map((char: any) => {
    const stars = RARITY_STARS[char.rarity] ?? '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${stars} ${char.name}`)
      .setDescription(`${char.path} · ${char.element}`)
      .setValue(char.character_id);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`hsr_team_roster_menu_${targetSlot}_${safePage}`)
        .setPlaceholder('Select a character...')
        .addOptions(options),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const navButtons: ButtonBuilder[] = [];
  if (safePage > 0) {
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`hsr_team_roster_page_${targetSlot}_${safePage - 1}`)
        .setLabel('← Previous')
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (safePage < totalPages - 1) {
    navButtons.push(
      new ButtonBuilder()
        .setCustomId(`hsr_team_roster_page_${targetSlot}_${safePage + 1}`)
        .setLabel('Next →')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  if (navButtons.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...navButtons),
    );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_team_roster_close').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

export async function handleHsrTeamRoster(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      components: [errContainer('Use `/hsr begin` to create your Trailblazer first.')],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const parts = interaction.customId.split('_');
  const targetSlot = parseInt(parts[parts.length - 1], 10);
  const container = buildRosterPage(userId, slot, targetSlot, 0);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrTeamRosterPage(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.update({ components: [errContainer('No save found.')], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const targetSlot = parseInt(parts[parts.length - 2], 10);
  const page = parseInt(parts[parts.length - 1], 10);

  const container = buildRosterPage(userId, slot, targetSlot, page);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

export async function handleHsrTeamRosterSelect(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.update({ components: [errContainer('No save found.')], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const parts = interaction.customId.split('_');
  const targetSlot = parseInt(parts[parts.length - 2], 10);
  const charId = interaction.values[0];

  setPartySlot(userId, slot, charId, targetSlot);

  const container = buildCharacterInfo(userId, slot, charId);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

export async function handleHsrTeamRosterClose(interaction: any) {
  await interaction.message.delete().catch(() => {
    interaction.update({ content: 'Roster closed.', components: [] }).catch(() => {});
  });
}

// ── Character Info ──

export async function handleHsrTeamCharInfo(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.update({ components: [errContainer('Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const charId = interaction.customId.replace('hsr_team_char_', '');
  const container = buildCharacterInfo(userId, slot, charId);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

function buildCharacterInfo(userId: string, slot: number, charId: string): ContainerBuilder {
  const roster = getPlayerRoster(userId, slot);
  const char = roster.find((c: any) => c.character_id === charId);
  if (!char) {
    return errContainer('Character not found.');
  }

  const stars = RARITY_STARS[char.rarity] ?? '';
  const lightCone = getCharacterLightCone(userId, slot, charId);
  const lcName = lightCone?.name ?? 'None';

  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Character Information'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${char.name} ${stars}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('**Character Level**'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${char.xp ?? 0}/${(char.level ?? 1) * 50} | ${Math.round(((char.xp ?? 0) / ((char.level ?? 1) * 50)) * 100)}% XP`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(getLoadBar(char.xp ?? 0, (char.level ?? 1) * 50)))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('**Character Light Cone:**'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lcName))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`hsr_team_lc_info_${charId}`)
          .setLabel('Information')
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Eidolon(s)'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('E1 -\nE2 -\nE3 -\nE4 -\nE5 -\nE6 -'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_team').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );
}

// ── Remove Character ──

export async function handleHsrTeamRemove(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.update({ components: [errContainer('Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const charId = interaction.customId.replace('hsr_team_remove_', '');
  unequipCharacter(userId, slot, charId);

  const container = buildPartySetup(userId, slot);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

// ── Light Cone Info (placeholder, ephemeral) ──

export async function handleHsrTeamLcInfo(interaction: any) {
  await interaction.reply({
    components: [new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Light Cone Information'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Detailed Light Cone information coming soon.'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_team').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ))
    ],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}
