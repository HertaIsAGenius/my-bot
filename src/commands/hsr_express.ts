import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, AttachmentBuilder } from 'discord.js';
import { embed, embedColored, COLORS } from '../utils/embed';
import {
  getSaveSlots, getPlayer, getPlayerExpress, getInventory,
  addItem, addCredits, removeItem,
  getExpressRoom, upgradeExpressRoom,
} from '../hsr/db';
import { incrementDailyObjective } from './hsr_dailies';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOADBAR = '<:LoadBarEmpty1:1523289923799482409><:LoadBarEmpty2:1523290039872917574><:LoadBarEmpty2:1523290039872917574><:LoadBarEmpty2:1523290039872917574><:LoadBarEmpty2:1523290039872917574><:LoadBarEmpty3:1523290155622862889>';
const EXPRESS_IMAGE = join(process.cwd(), 'LanBot Sprites', 'Plain Room HSR.png');

function getSlotData(userId: string): { slot: number; expressName: string } | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  const s = slots.sort((a: any, b: any) => b.last_played.localeCompare(a.last_played))[0];
  return { slot: s.slot_number, expressName: s.express_name };
}

function buildExpressContainer(rooms: any[], username: string, expressName: string, includeImage: boolean): { container: ContainerBuilder; attachment?: AttachmentBuilder } {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${username}'s ${expressName}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Astral Express Rooms'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Each room offers a different utility for your Trailblazer journey.'));

  let attachment: AttachmentBuilder | undefined;

  if (includeImage) {
    try {
      const imgBuf = readFileSync(EXPRESS_IMAGE);
      attachment = new AttachmentBuilder(imgBuf, { name: 'express.png' });
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL('attachment://express.png'),
        ),
      );
    } catch {
      includeImage = false;
    }
  }

  const roomSummary = rooms.map((r: any) => `• ${r.name} — Lv.${r.level}/${r.max_level}`).join('\n');
  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Room Overview'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(roomSummary || 'No rooms available yet.'));

  const roomButtons = rooms.map((r: any) => new ButtonBuilder()
    .setCustomId(`hsr_express_room_${r.room_id}`)
    .setLabel(r.name)
    .setStyle(ButtonStyle.Secondary));

  const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < roomButtons.length; i += 5) {
    buttonRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...roomButtons.slice(i, i + 5)));
  }

  if (buttonRows.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(...buttonRows);
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('hsr_profile')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return { container, attachment };
}

export async function handleHsrExpress(interaction: any) {
  const userId = interaction.user.id;
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot, expressName } = data;

  await interaction.deferUpdate();

  const rooms = getPlayerExpress(userId, slot);
  const username = interaction.user.username;

  const { container, attachment } = buildExpressContainer(rooms, username, expressName, true);

  await interaction.followUp({
    components: [container],
    files: attachment ? [attachment] : [],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    withComponents: true,
  });
}

export async function handleHsrExpressRoom(interaction: any) {
  const userId = interaction.user.id;
  const roomId = interaction.customId.replace('hsr_express_room_', '');
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  const rooms = getPlayerExpress(userId, slot);
  const room = rooms.find((r: any) => r.room_id === roomId);
  if (!room) {
    await interaction.reply({ embeds: [embed('Room Not Found', 'This room does not exist on your Express.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const roomRef = getExpressRoom(roomId);
  const costs = roomRef?.upgrade_costs ? JSON.parse(roomRef.upgrade_costs) : [];
  const nextCost = costs.find((c: any) => c.level === room.level + 1);

  const starterItems: Array<{ itemId: string; label: string; quantity: number }> = [];
  if (roomId === 'workshop') {
    starterItems.push({ itemId: 'adventure_log', label: 'Adventure Log', quantity: 1 }, { itemId: 'travel_guide', label: 'Travel Guide', quantity: 1 });
  } else if (roomId === 'forge') {
    starterItems.push({ itemId: 'relic_fragment', label: 'Relic Fragment', quantity: 1 });
  } else if (roomId === 'storage_room') {
    starterItems.push({ itemId: 'hertas_coupon', label: "Herta's Coupon", quantity: 1 });
  } else if (roomId === 'relic_vault') {
    starterItems.push({ itemId: 'relic_fragment', label: 'Relic Fragment', quantity: 1 });
  }

  const inventory = getInventory(userId, slot);
  const inventoryMap = new Map(inventory.map((item: any) => [item.item_id, item.quantity]));
  const starterLines: string[] = [];
  for (const item of starterItems) {
    const has = inventoryMap.get(item.itemId) ?? 0;
    if (has <= 0) {
      addItem(userId, slot, item.itemId, item.quantity);
      starterLines.push(`${item.quantity}× ${item.label}`);
    } else {
      starterLines.push(`${has}× ${item.label}`);
    }
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${room.name} — Lv.${room.level}/${room.max_level}`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(room.description))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Starter Supplies'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(starterLines.length > 0 ? starterLines.join('\n') : 'No starter supplies needed.'));

  // Production display
  let prodStr = '';
  if (roomRef?.base_production) {
    try {
      const prod = JSON.parse(roomRef.base_production);
      const lines = Object.entries(prod).map(([k, v]) =>
        `${k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${v}`
      );
      if (lines.length) prodStr = '\n' + lines.join('\n');
    } catch {}
  }
  if (prodStr) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Room Output'))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(prodStr));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Upgrade info
  if (nextCost) {
    const costLines: string[] = [`Upgrade to Lv.${room.level + 1}: ${nextCost.credits.toLocaleString()} Credits`];
    if (nextCost.materials) {
      for (const [id, qty] of Object.entries(nextCost.materials)) {
        costLines.push(`• ${id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} x${qty}`);
      }
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(costLines.join('\n')));
  } else if (room.level >= room.max_level) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('This room has reached its maximum level!'));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  // Action buttons
  const buttons: ButtonBuilder[] = [];

  if (roomId === 'workshop') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('hsr_express_workshop_craft_adventure_log')
        .setLabel("Craft Adventure's Log (10 Credits)")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hsr_express_workshop_craft_travel_guide')
        .setLabel('Craft Travel Guide (12 Credits)')
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (roomId === 'forge') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('hsr_express_forge_enhance')
        .setLabel('Enhance Relic (1 Relic Fragment)')
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (roomId === 'storage_room') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('hsr_express_storage_view')
        .setLabel('View Items')
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (roomId === 'relic_vault') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('hsr_express_vault_view')
        .setLabel('View Relics')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  if (nextCost && room.level < room.max_level) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`hsr_express_upgrade_${roomId}`)
        .setLabel(`Upgrade (${nextCost.credits.toLocaleString()} Credits)`)
        .setStyle(ButtonStyle.Secondary),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('hsr_express')
      .setLabel('Back')
      .setStyle(ButtonStyle.Danger),
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)));
  }
  container.addActionRowComponents(...rows);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrExpressCraft(interaction: any) {
  const userId = interaction.user.id;
  const itemId = interaction.customId.replace('hsr_express_workshop_craft_', '');
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Save data not found.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const costs: Record<string, number> = { adventure_log: 10, travel_guide: 12 };
  const cost = costs[itemId] ?? 10;
  const label = itemId === 'travel_guide' ? 'Travel Guide' : 'Adventure\'s Log';
  if (player.credits < cost) {
    await interaction.reply({
      embeds: [embed('Insufficient Credits', `You need **${cost}** credits to craft **${label}**. You have **${player.credits}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  addCredits(userId, slot, -cost);
  addItem(userId, slot, itemId, 1);
  incrementDailyObjective(userId, slot, 'craft_items');
  const { advanceQuest } = require('../hsr/db');
  advanceQuest(userId, slot, 'craft_items');

  await interaction.reply({
    embeds: [embedColored(COLORS.success, 'Item Crafted', `Successfully crafted **1 × ${label}** for **${cost}** credits.`)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleHsrExpressForgeEnhance(interaction: any) {
  const userId = interaction.user.id;
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  if (!removeItem(userId, slot, 'relic_fragment', 1)) {
    await interaction.reply({ embeds: [embed('Missing Material', 'You need 1 Relic Fragment to enhance a relic.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({
    embeds: [embedColored(COLORS.success, 'Relic Enhanced', 'Your starter relic was polished with 1 Relic Fragment.')],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleHsrExpressStorageView(interaction: any) {
  const userId = interaction.user.id;
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  const inventory = getInventory(userId, slot);
  const lines = inventory.length > 0
    ? inventory.map((item: any) => `• ${item.name} ×${item.quantity}`).join('\n')
    : ['No items yet.'];

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Storage Room'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Items Stored'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(typeof lines === 'string' ? lines : lines.join('\n')));

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_express').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

export async function handleHsrExpressVaultView(interaction: any) {
  const userId = interaction.user.id;
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  const inventory = getInventory(userId, slot);
  const relicItems = inventory.filter((item: any) => item.item_id === 'relic_fragment' || item.item_id === 'adventure_log');
  const lines = relicItems.length > 0
    ? relicItems.map((item: any) => `• ${item.name} ×${item.quantity}`).join('\n')
    : ['No relics or materials stored yet.'];

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Relic Vault'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Vault Contents'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(typeof lines === 'string' ? lines : lines.join('\n')));

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hsr_express').setLabel('Back').setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}


export async function handleHsrExpressUpgrade(interaction: any) {
  const userId = interaction.user.id;
  const roomId = interaction.customId.replace('hsr_express_upgrade_', '');
  const data = getSlotData(userId);
  if (!data) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` first.')], flags: MessageFlags.Ephemeral });
    return;
  }
  const { slot } = data;

  const rooms = getPlayerExpress(userId, slot);
  const room = rooms.find((r: any) => r.room_id === roomId);
  if (!room) {
    await interaction.reply({ embeds: [embed('Room Not Found', 'This room does not exist on your Express.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (room.level >= room.max_level) {
    await interaction.reply({
      embeds: [embed('Max Level', `${room.name} is already at maximum level (Lv.${room.max_level}).`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const roomRef = getExpressRoom(roomId);
  const costs = roomRef?.upgrade_costs ? JSON.parse(roomRef.upgrade_costs) : [];
  const nextCost = costs.find((c: any) => c.level === room.level + 1);
  if (!nextCost) {
    await interaction.reply({ embeds: [embed('Error', 'No upgrade data found for this level.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('Error', 'Player data not found.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (player.credits < nextCost.credits) {
    await interaction.reply({
      embeds: [embed('Insufficient Credits', `You need **${nextCost.credits.toLocaleString()}** credits. You have **${player.credits.toLocaleString()}**.`)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (nextCost.materials) {
    const inventory = getInventory(userId, slot);
    for (const [matId, qty] of Object.entries(nextCost.materials)) {
      const invItem = inventory.find((i: any) => i.item_id === matId);
      if (!invItem || invItem.quantity < (qty as number)) {
        const matName = matId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        await interaction.reply({
          embeds: [embed('Missing Materials', `You need **${qty}x ${matName}** to upgrade.`)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  }

  addCredits(userId, slot, -nextCost.credits);

  if (nextCost.materials) {
    for (const [matId, qty] of Object.entries(nextCost.materials)) {
      removeItem(userId, slot, matId, qty as number);
    }
  }

  const success = upgradeExpressRoom(userId, slot, roomId);
  if (!success) {
    addCredits(userId, slot, nextCost.credits);
    if (nextCost.materials) {
      for (const [matId, qty] of Object.entries(nextCost.materials)) {
        addItem(userId, slot, matId, qty as number);
      }
    }
    await interaction.reply({
      embeds: [embed('Upgrade Failed', 'Could not upgrade the room. It may already be at max level.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const newLevel = room.level + 1;
  const nextNextCost = costs.find((c: any) => c.level === newLevel + 1);
  const successDesc: string[] = [
    `**${room.name}** upgraded to **Lv.${newLevel}**!`,
    '',
  ];
  if (nextNextCost) {
    successDesc.push(`Next upgrade (Lv.${newLevel + 1}): **${nextNextCost.credits.toLocaleString()}** Credits`);
  } else {
    successDesc.push('This room has reached its maximum level!');
  }

  await interaction.reply({
    embeds: [embedColored(COLORS.success, 'Room Upgraded!', successDesc.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
}
