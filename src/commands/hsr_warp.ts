import { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { db, getSaveSlots, getPlayer, spendJade, addCharacterToPlayer, addItem, removeItem, getActiveBanners, getWarpBanner, getPity, updatePity, addWarpHistory, getWarpSessions, getWarpSessionItems, getCharacter } from '../hsr/db';

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

function getWishCount(userId: string, slot: number, itemId: string): number {
  const inv = db.prepare('SELECT quantity FROM hsr_inventory WHERE user_id = ? AND slot_number = ? AND item_id = ?').get(userId, slot, itemId) as any;
  return inv?.quantity ?? 0;
}

function noSaveContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# No Save Found'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Use `/hsr begin` to create your Trailblazer first.'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
    ));
}

function errorContainer(msg: string): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Error'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(msg))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
    ));
}

function buildWarpMenu(player: any, userId: string, slot: number): ContainerBuilder {
  const stdWishes = getWishCount(userId, slot, 'standard_wish');
  const limWishes = getWishCount(userId, slot, 'limited_wish');
  const pity = getPity(userId, slot, 'stellar_warp');
  const pityDisplay = pity.total_pulls > 0 ? `Since last 5★: **${pity.pity_5}** pulls` : 'No pulls yet';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Warp'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${player.stellar_jade.toLocaleString()}** Stellar Jade`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${pityDisplay}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Standard Wishes'));
  if (stdWishes > 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You have **${stdWishes}** Standard Wishes`))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp_pull_standard_1').setLabel('Pull x1').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('hsr_warp_pull_standard_10').setLabel('Pull x10').setStyle(ButtonStyle.Primary),
        ),
      );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No Standard Wishes — spend Jades directly'))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp_usejades_standard_1').setLabel('Use Jades (x1)').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('hsr_warp_usejades_standard_10').setLabel('Use Jades (x10)').setStyle(ButtonStyle.Secondary),
        ),
      );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Limited Wishes'));
  if (limWishes > 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You have **${limWishes}** Limited Wishes`))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp_pull_limited_1').setLabel('Pull x1').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('hsr_warp_pull_limited_10').setLabel('Pull x10').setStyle(ButtonStyle.Primary),
        ),
      );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No Limited Wishes — spend Jades directly'))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp_usejades_limited_1').setLabel('Use Jades (x1)').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('hsr_warp_usejades_limited_10').setLabel('Use Jades (x10)').setStyle(ButtonStyle.Secondary),
        ),
      );
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_shop').setLabel('Shop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_warp_history_stellar_warp').setLabel('History').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

function buildShopMenu(player: any): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Star Rail Shop'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${player.stellar_jade.toLocaleString()}** Stellar Jade available`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Standard Wishes'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('160 Jades per wish'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_shop_modal_standard').setLabel('Buy Standard Wishes').setStyle(ButtonStyle.Primary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Limited Wishes'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('160 Jades per wish'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp_shop_modal_limited').setLabel('Buy Limited Wishes').setStyle(ButtonStyle.Primary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );
}

function buildPurchaseResultContainer(kind: 'limited' | 'standard', quantity: number, cost: number): ContainerBuilder {
  const label = kind === 'limited' ? 'Limited Wish' : 'Standard Wish';
  const plural = quantity === 1 ? '' : 'es';
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Purchase Complete'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Purchased **${quantity}x ${label}${plural}** for **${cost.toLocaleString()}** Jades.`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Warp Menu').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hsr_profile').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );
}

function buildPullResultContainer(results: Array<{ rarity: number; itemName: string; featured?: boolean }>, count: number, kind: 'standard' | 'limited'): ContainerBuilder {
  const lines = results.map((r) => `${RARITY_STARS[r.rarity]} ${r.itemName}${r.featured ? ' ⭐' : ''}`);
  const label = kind === 'limited' ? 'Limited Wish' : 'Standard Wish';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${count === 1 ? `${label} Result` : `${label} Results`}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const hasWishesLeft = false;
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`hsr_warp_pull_${kind}_1`).setLabel('Pull x1').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`hsr_warp_pull_${kind}_10`).setLabel('Pull x10').setStyle(ButtonStyle.Primary),
    ),
  ).addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Warp Menu').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

function buildInsufficientWishesContainer(kind: 'standard' | 'limited', count: number, jades: number): ContainerBuilder {
  const label = kind === 'limited' ? 'Limited' : 'Standard';
  const cost = count * 160;
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Insufficient Wishes'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You need **${count}** ${label} Wish${count > 1 ? 'es' : ''} to make that pull.`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  if (jades >= cost) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You have **${jades.toLocaleString()}** Jades — enough to spend **${cost.toLocaleString()}** Jades directly.`))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hsr_warp_usejades_${kind}_${count}`).setLabel(`Use Jades (${cost.toLocaleString()})`).setStyle(ButtonStyle.Primary),
        ),
      );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You have **${jades.toLocaleString()}** Jades — not enough for **${cost.toLocaleString()}** Jades.`));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

export function handleShopModalStandard(interaction: any) {
  const modal = new ModalBuilder()
    .setCustomId('hsr_warp_shop_submit_standard')
    .setTitle('Buy Standard Wishes');
  const input = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel('How many Standard Wishes?')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter a number (e.g. 1, 10, 50)')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(5);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

export function handleShopModalLimited(interaction: any) {
  const modal = new ModalBuilder()
    .setCustomId('hsr_warp_shop_submit_limited')
    .setTitle('Buy Limited Wishes');
  const input = new TextInputBuilder()
    .setCustomId('quantity')
    .setLabel('How many Limited Wishes?')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter a number (e.g. 1, 10, 50)')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(5);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  return modal;
}

export async function handleShopSubmit(interaction: any) {
  const userId = interaction.user.id;
  const kind = interaction.customId.includes('standard') ? 'standard' : 'limited';
  const quantityStr = interaction.fields.getTextInputValue('quantity');
  const quantity = parseInt(quantityStr, 10);

  if (isNaN(quantity) || quantity < 1 || quantity > 999) {
    await interaction.reply({
      components: [errorContainer('Please enter a valid number between 1 and 999.')],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    });
    return;
  }

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.reply({
      components: [noSaveContainer()],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({
      components: [errorContainer('Save data is corrupted.')],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    });
    return;
  }

  const cost = quantity * 160;
  if (!spendJade(userId, slot, cost)) {
    await interaction.reply({
      components: [new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Insufficient Jades'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You need **${cost.toLocaleString()}** Jades to purchase **${quantity}x ${kind === 'limited' ? 'Limited' : 'Standard'} Wish${quantity > 1 ? 'es' : ''}**, but you only have **${player.stellar_jade.toLocaleString()}** Jades.`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp_shop').setLabel('Back to Shop').setStyle(ButtonStyle.Secondary),
        ))
      ],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    });
    return;
  }

  const itemId = kind === 'limited' ? 'limited_wish' : 'standard_wish';
  addItem(userId, slot, itemId, quantity);

  await interaction.reply({
    components: [buildPurchaseResultContainer(kind, quantity, cost)],
    flags: MessageFlags.IsComponentsV2,
    ephemeral: true,
  });
}

export async function handleHsrWarp(interaction: any) {
  const isSlash = interaction.isChatInputCommand();
  const userId = interaction.user.id;
  const slot = getActiveSlot(userId);
  if (slot === null) {
    const payload = { components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 };
    if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    const payload = { components: [errorContainer('Save data is corrupted.')], flags: MessageFlags.IsComponentsV2 };
    if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
    return;
  }

  const container = buildWarpMenu(player, userId, slot);
  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
  if (isSlash) await interaction.reply(payload); else await interaction.update(payload);
}

export async function handleHsrWarpShop(interaction: any) {
  const userId = interaction.user.id;
  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.update({ components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.update({ components: [errorContainer('Save data is corrupted.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  await interaction.update({ components: [buildShopMenu(player)], flags: MessageFlags.IsComponentsV2 });
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
    await interaction.update({ components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.update({ components: [errorContainer('Save data is corrupted.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const banner = getActiveBanners().find((entry: any) => entry.banner_type === bannerType) ?? getActiveBanners()[0];
  if (!banner) {
    await interaction.update({ components: [errorContainer('Banner not found.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (!removeItem(userId, slot, itemId, count)) {
    const jades = player.stellar_jade;
    await interaction.update({ components: [buildInsufficientWishesContainer(kind, count, jades)], flags: MessageFlags.IsComponentsV2 });
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
    await interaction.update({ components: [errorContainer('An error occurred during the warp. Please try again.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const container = buildPullResultContainer(results.map((r) => ({ rarity: r.rarity, itemName: r.itemName, featured: r.featured })), count, kind);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleHsrWarpUseJades(interaction: any) {
  const userId = interaction.user.id;
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const kind = parts.includes('limited') ? 'limited' : 'standard';
  const count = parts[parts.length - 1] === '10' ? 10 : 1;
  const bannerType = kind === 'limited' ? 'limited' : 'standard';

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.update({ components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.update({ components: [errorContainer('Save data is corrupted.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const banner = getActiveBanners().find((entry: any) => entry.banner_type === bannerType) ?? getActiveBanners()[0];
  if (!banner) {
    await interaction.update({ components: [errorContainer('Banner not found.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const cost = count * 160;
  if (!spendJade(userId, slot, cost)) {
    await interaction.update({ components: [new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Insufficient Jades'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You need **${cost.toLocaleString()}** Jades to pull **${count}x**, but you only have **${player.stellar_jade.toLocaleString()}** Jades.`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ))
    ], flags: MessageFlags.IsComponentsV2 });
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
    console.error('[HSR Warp] UseJades transaction error:', err);
    await interaction.update({ components: [errorContainer('An error occurred during the warp. Please try again.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const container = buildPullResultContainer(results.map((r) => ({ rarity: r.rarity, itemName: r.itemName, featured: r.featured })), count, kind);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleHsrWarpHistory(interaction: any) {
  const userId = interaction.user.id;
  const parts = interaction.customId.split('_');
  const histIdx = parts.indexOf('history');
  if (histIdx === -1) {
    await interaction.update({ components: [errorContainer('Invalid interaction.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const bannerId = parts.slice(histIdx + 1).join('_');
  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.update({ components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const banner = getWarpBanner(bannerId);
  if (!banner) {
    await interaction.update({ components: [errorContainer('Banner not found.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const sessions = getWarpSessions(userId, slot, bannerId, 6);

  if (sessions.length === 0) {
    await interaction.update({
      components: [new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# No Warp History'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('You haven\'t pulled on this banner yet.'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
        ))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📜 ${banner.name} — Warp History`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  sessions.forEach((session: any, idx: number) => {
    const sessionNumber = sessions.length - idx;
    const date = session.timestamp.slice(0, 10);
    const time = session.timestamp.slice(11, 16);
    const parts: string[] = [];
    if (session.five_star_count > 0) parts.push(`${session.five_star_count}x ★★★★★`);
    if (session.four_star_count > 0) parts.push(`${session.four_star_count}x ★★★★`);
    const summary = parts.length > 0 ? parts.join(', ') : `${session.count} pulls`;
    const tsCompact = session.timestamp.replace(/[-: ]/g, '').slice(0, 14);

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Warp #${sessionNumber}** — ${date} ${time} — ${session.count} items (${summary})`))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`hsr_warp_info_${bannerId}_${tsCompact}`).setLabel(`Warp #${sessionNumber} Information`).setStyle(ButtonStyle.Secondary),
        ),
      );

    if (idx < sessions.length - 1) {
      container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }
  });

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleHsrWarpInfo(interaction: any) {
  const userId = interaction.user.id;
  const customId = interaction.customId || '';
  const parts = customId.split('_');
  const infoIdx = parts.indexOf('info');
  if (infoIdx === -1) {
    await interaction.update({ components: [errorContainer('Invalid interaction.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const afterInfo = parts.slice(infoIdx + 1);
  const tsCompact = afterInfo[afterInfo.length - 1];
  const bannerId = afterInfo.slice(0, afterInfo.length - 1).join('_');

  const tsParts = tsCompact.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!tsParts) {
    await interaction.update({ components: [errorContainer('Invalid session reference.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }
  const timestamp = `${tsParts[1]}-${tsParts[2]}-${tsParts[3]} ${tsParts[4]}:${tsParts[5]}:${tsParts[6]}`;

  const slot = getActiveSlot(userId);
  if (slot === null) {
    await interaction.update({ components: [noSaveContainer()], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const banner = getWarpBanner(bannerId);
  if (!banner) {
    await interaction.update({ components: [errorContainer('Banner not found.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const items = getWarpSessionItems(userId, slot, bannerId, timestamp);

  if (items.length === 0) {
    await interaction.update({ components: [errorContainer('No items found for this session.')], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const sessions = getWarpSessions(userId, slot, bannerId, 100);
  let sessionNumber = 0;
  for (let i = 0; i < sessions.length; i++) {
    const sTsCompact = sessions[i].timestamp.replace(/[-: ]/g, '').slice(0, 14);
    if (sTsCompact === tsCompact) {
      sessionNumber = sessions.length - i;
      break;
    }
  }

  const lines = items.map((item: any) => {
    const stars = RARITY_STARS[item.rarity] ?? '★★★';
    const name = item.char_name ?? getCharacterName(item.character_id);
    return `${stars} ${name}`;
  });

  const date = timestamp.slice(0, 10);
  const time = timestamp.slice(11, 16);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Warp #${sessionNumber}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${banner.name} — ${date} ${time}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${items.length} item${items.length > 1 ? 's' : ''} received:`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_warp').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}
