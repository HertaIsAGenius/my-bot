import { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { embed, embedColored, COLORS } from '../utils/embed';
import { db, getSaveSlots, getPlayer, spendJade, addCharacterToPlayer, addItem, removeItem, getActiveBanners, getWarpBanner, getPity, updatePity, addWarpHistory, getWarpHistory, getCharacter } from '../hsr/db';

const LIGHT_CONES_3 = [
  { id: 'arrow', name: 'Arrow' },
  { id: 'meditation', name: 'Meditation' },
  { id: 'mutare', name: 'Mutare' },
  { id: 'shattered_home', name: 'Shattered Home' },
  { id: 'amber', name: 'Amber' },
  { id: 'void', name: 'Void' },
  { id: 'chorus', name: 'Chorus' },
  { id: 'collapsing_sky', name: 'Collapsing Sky' },
  { id: 'cornucopia', name: 'Cornucopia' },
  { id: 'hidden_shadow', name: 'Hidden Shadow' },
  { id: 'adversarial', name: 'Adversarial' },
  { id: 'meshing_cogs', name: 'Meshing Cogs' },
];

const FOUR_STAR_CHARS = [
  'herta', 'natasha', 'sampo', 'serval', 'sushang', 'hook', 'yukong',
  'march_7th', 'dan_heng', 'asta', 'bronya', 'tingyun', 'pela', 'arlan', 'gepard', 'bailu', 'qingque', 'misha', 'hanya', 'clara'
];

const FIVE_STAR_CHARS = [
  'trailblazer_physical', 'stelle', 'caelus', 'kafka', 'blade', 'jing_yuan', 'silver_wolf', 'luocha', 'topaz', 'fu_xuan', 'yanqing'
];

const RARITY_COLORS: Record<number, number> = { 5: 0xF1C40F, 4: 0x9B59B6, 3: 0x3498DB };
const RARITY_STARS: Record<number, string> = { 5: '★★★★★', 4: '★★★★', 3: '★★★' };

function calcFiveStarRate(pity5: number): number {
  if (pity5 >= 89) return 1;
  if (pity5 >= 74) return 0.006 + (pity5 - 73) * 0.06;
  return 0.006;
}

function calcFourStarRate(pity4: number): number {
  if (pity4 >= 9) return 1;
  return 0.051;
}

function rollRarity(pity5: number, pity4: number): number {
  if (Math.random() < calcFiveStarRate(pity5)) return 5;
  if (Math.random() < calcFourStarRate(pity4)) return 4;
  return 3;
}

function getCharacterName(id: string): string {
  const char = getCharacter(id);
  return char?.name ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function selectPoolCharacter(ids: string[]): { id: string; name: string } {
  const id = ids[Math.floor(Math.random() * ids.length)];
  return { id, name: getCharacterName(id) };
}

function selectFiveStar(banner: any, pity: any): { id: string; name: string; featured: boolean } {
  const featuredIds: string[] = JSON.parse(banner.rate_up_5star || '[]');
  const standardPool = FIVE_STAR_CHARS.filter((id) => !featuredIds.includes(id));

  if (banner.banner_type === 'limited' && featuredIds.length > 0) {
    if (pity.guaranteed_5 === 1) {
      const picked = selectPoolCharacter(featuredIds);
      return { ...picked, featured: true };
    }

    if (Math.random() < 0.5) {
      const picked = selectPoolCharacter(featuredIds);
      return { ...picked, featured: true };
    }

    const picked = selectPoolCharacter(standardPool.length > 0 ? standardPool : FIVE_STAR_CHARS);
    return { ...picked, featured: false };
  }

  const picked = selectPoolCharacter(FIVE_STAR_CHARS);
  return { ...picked, featured: false };
}

function selectFourStar(banner: any): { id: string; name: string } {
  const rateUp4: string[] = JSON.parse(banner.rate_up_4star || '[]');
  let pool: string[];
  if (rateUp4.length > 0 && Math.random() < 0.5) {
    pool = rateUp4;
  } else {
    pool = FOUR_STAR_CHARS;
  }
  return selectPoolCharacter(pool);
}

function selectLightCone3(): { id: string; name: string } {
  return LIGHT_CONES_3[Math.floor(Math.random() * LIGHT_CONES_3.length)];
}

function doSinglePull(userId: string, slot: number, banner: any): { rarity: number; itemId: string; itemName: string; featured: boolean } {
  const pity = getPity(userId, slot, banner.id);
  const rarity = rollRarity(pity.pity_5, pity.pity_4);
  const pullNum = pity.total_pulls + 1;

  if (rarity === 5) {
    const result = selectFiveStar(banner, pity);
    if (banner.banner_type === 'limited' && result.featured) {
      updatePity(userId, slot, banner.id, { pity_5: 0, pity_4: 0, guaranteed_5: 0, guaranteed_4: 0 });
    } else if (banner.banner_type === 'limited') {
      updatePity(userId, slot, banner.id, { pity_5: 0, pity_4: 0, guaranteed_5: 1, guaranteed_4: 0 });
    } else {
      updatePity(userId, slot, banner.id, { pity_5: 0, pity_4: 0, guaranteed_5: 0, guaranteed_4: 0 });
    }
    addCharacterToPlayer(userId, slot, result.id);
    addWarpHistory(userId, slot, banner.id, result.id, 5, pullNum);
    return { rarity: 5, itemId: result.id, itemName: result.name, featured: result.featured };
  }

  if (rarity === 4) {
    const result = selectFourStar(banner);
    updatePity(userId, slot, banner.id, { pity_5: pity.pity_5 + 1, pity_4: 0, guaranteed_5: pity.guaranteed_5, guaranteed_4: pity.guaranteed_4 });
    addCharacterToPlayer(userId, slot, result.id);
    addWarpHistory(userId, slot, banner.id, result.id, 4, pullNum);
    return { rarity: 4, itemId: result.id, itemName: result.name, featured: false };
  }

  const lc = selectLightCone3();
  updatePity(userId, slot, banner.id, { pity_5: pity.pity_5 + 1, pity_4: pity.pity_4 + 1, guaranteed_5: pity.guaranteed_5, guaranteed_4: pity.guaranteed_4 });
  return { rarity: 3, itemId: lc.id, itemName: lc.name, featured: false };
}

function getActiveSlot(userId: string): number | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  return slots.sort((a: any, b: any) => b.last_played.localeCompare(a.last_played))[0].slot_number;
}

function buildWarpMenu(player: any): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Warp'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You have **${player.stellar_jade.toLocaleString()}** Jades`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Standard Wishes'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_pull_standard_1').setLabel('Standard Wish (x1)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_pull_standard_10').setLabel('Standard Wishes (x10)').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Limited Wishes'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_pull_limited_1').setLabel('Limited Wish (x1)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_pull_limited_10').setLabel('Limited Wishes (x10)').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_shop').setLabel('Open Shop').setStyle(ButtonStyle.Secondary),
      ),
    );
}

function buildShopMenu(player: any): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Star Rail Shop'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Standard Wishes'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('1x Standard Wish -160 Jades'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('10x Standard Wish -1600 Jades'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_buy_standard_1').setLabel('1x Standard Wish').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_buy_standard_10').setLabel('10x Standard Wish').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Limited Wishes'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('1x Limited Wish -160 Jades'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('10x Limited Wish -1600 Jades'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_buy_limited_1').setLabel('1x Limited Wish').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_buy_limited_10').setLabel('10x Limited Wish').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );
}

function buildPurchaseResultContainer(kind: 'limited' | 'standard', quantity: number, cost: number): ContainerBuilder {
  const label = kind === 'limited' ? 'Limited Wish' : 'Standard Wish';
  const plural = quantity === 1 ? '' : 's';
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Purchase Complete'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Purchased **${quantity}x ${label}${plural}** for **${cost.toLocaleString()}** Jades.`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('hsr_warp_shop')
          .setLabel('Open Shop')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

function buildPullResultContainer(results: Array<{ rarity: number; itemName: string; featured?: boolean }>, count: number, kind: 'standard' | 'limited'): ContainerBuilder {
  const lines = results.map((r) => `${RARITY_STARS[r.rarity]} ${r.itemName}${r.featured ? ' ⭐' : ''}`);
  const label = kind === 'limited' ? 'Limited Wish' : 'Standard Wish';
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${count === 1 ? `${label} Result` : `${label} Results`}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('hsr_warp')
          .setLabel('Warp')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

export async function handleHsrWarp(interaction: any) {
  const userId = interaction.user.id;
  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Save data is corrupted.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const container = buildWarpMenu(player);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrWarpShop(interaction: any) {
  const userId = interaction.user.id;
  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Save data is corrupted.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const container = buildShopMenu(player);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrWarpBuy(interaction: any) {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const kind = parts[3] as 'limited' | 'standard';
  const quantity = parseInt(parts[4], 10);

  if (!kind || !['limited', 'standard'].includes(kind) || (quantity !== 1 && quantity !== 10)) {
    await interaction.reply({ embeds: [embed('Error', 'Invalid wish purchase.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Save data is corrupted.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const cost = quantity * 160;
  if (!spendJade(userId, slot, cost)) {
    await interaction.reply({
      embeds: [embedColored(COLORS.danger, 'Insufficient Jades', `You need **${cost.toLocaleString()}** Jades to purchase **${quantity}x ${kind === 'limited' ? 'Limited' : 'Standard'} Wish${quantity > 1 ? 'es' : ''}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const itemId = kind === 'limited' ? 'limited_wish' : 'standard_wish';
  addItem(userId, slot, itemId, quantity);

  const container = buildPurchaseResultContainer(kind, quantity, cost);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrWarpPull(interaction: any) {
  const userId = interaction.user.id;
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const kind = parts.includes('limited') ? 'limited' : 'standard';
  const count = parts[parts.length - 1] === '10' ? 10 : 1;
  const itemId = kind === 'limited' ? 'limited_wish' : 'standard_wish';
  const bannerType = kind === 'limited' ? 'limited' : 'standard';

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Save data is corrupted.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const banner = getActiveBanners().find((entry: any) => entry.banner_type === bannerType) ?? getActiveBanners()[0];
  if (!banner) {
    await interaction.reply({ embeds: [embed('Error', 'Banner not found.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (!removeItem(userId, slot, itemId, count)) {
    await interaction.reply({
      embeds: [embedColored(COLORS.danger, 'Insufficient Wishes', `You need **${count}** ${kind === 'limited' ? 'Limited' : 'Standard'} Wish${count > 1 ? 'es' : ''} to make that pull.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let results: Array<{ rarity: number; itemId: string; itemName: string; featured?: boolean }> = [];
  try {
    db.transaction(() => {
      for (let i = 0; i < count; i++) {
        results.push(doSinglePull(userId, slot, banner));
      }
    })();
  } catch (err) {
    console.error('[HSR Warp] Transaction error:', err);
    await interaction.reply({ embeds: [embed('Error', 'An error occurred during the warp. Please try again.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const container = buildPullResultContainer(results.map((r) => ({ rarity: r.rarity, itemName: r.itemName, featured: r.featured })), count, kind);
  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrWarpHistory(interaction: any) {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const histIdx = parts.indexOf('history');
  if (histIdx === -1) {
    await interaction.reply({ embeds: [embed('Error', 'Invalid interaction.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const bannerId = parts.slice(histIdx + 1).join('_');

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer first.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const banner = getWarpBanner(bannerId);
  if (!banner) {
    await interaction.reply({ embeds: [embed('Error', 'Banner not found.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const history = getWarpHistory(userId, slot, bannerId, 10);

  if (history.length === 0) {
    await interaction.reply({
      embeds: [embed('No Warp History', 'You haven\'t pulled on this banner yet. Start warping with the buttons above!')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = history.map((h: any) => {
    const stars = RARITY_STARS[h.rarity];
    const name = getCharacter(h.character_id)?.name ?? h.character_id;
    return `**#${h.pull_number}** ${stars} ${name} — ${h.timestamp.slice(0, 10)}`;
  });

  await interaction.reply({
    embeds: [embedColored(0x2B3A67, `📜 ${banner.name} — Last ${history.length} Warps`, lines.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
}
