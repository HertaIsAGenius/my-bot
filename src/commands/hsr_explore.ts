import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { embed, embedColored } from '../utils/embed';
import { db, getSaveSlots, getPlayer, getLocation, getWorld, movePlayer, addColdMeter, addItem, addCredits, getResourceNodesForLocation, getMaterialName, getTodaysDailies, autoAssignDailies, completeDaily, getHertaStationItems, generateEnemyFormations, rollTagRewards, rollOldSearchReward, getParty } from '../hsr/db';
import { startCombat, buildCombatEmbed, buildActionRows } from './hsr_combat';
import { incrementDailyObjective } from './hsr_dailies';

const exploreRoomNodes = new Map<string, Array<{ id: string; name: string; tag: string }>>();

function getRoomKey(userId: string, slot: number, locationId: string): string {
  return `${userId}|${slot}|${locationId}`;
}

function initRoomNodes(userId: string, slot: number, locationId: string): void {
  const key = getRoomKey(userId, slot, locationId);
  if (exploreRoomNodes.has(key)) return;

  const pool = getHertaStationItems(locationId);
  if (pool && pool.length > 0) {
    const count = Math.min(Math.floor(Math.random() * 9) + 2, pool.length);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const nodes = shuffled.slice(0, count).map(item => ({
      id: item.name,
      name: item.name,
      tag: item.tag,
    }));
    exploreRoomNodes.set(key, nodes);
    return;
  }

  const dbNodes = getResourceNodesForLocation(locationId);
  if (dbNodes.length > 0) {
    const count = Math.min(Math.floor(Math.random() * 9) + 2, dbNodes.length);
    const shuffled = [...dbNodes].sort(() => Math.random() - 0.5);
    const nodes = shuffled.slice(0, count).map((n: any) => ({
      id: `db_${n.node_id}`,
      name: n.node_id.replace(/^[a-z]+_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      tag: getMaterialName(n.resource_item_id),
    }));
    exploreRoomNodes.set(key, nodes);
  }
}

function getRemainingNodes(userId: string, slot: number, locationId: string): Array<{ id: string; name: string; tag: string }> {
  return exploreRoomNodes.get(getRoomKey(userId, slot, locationId)) || [];
}

function removeRandomNode(userId: string, slot: number, locationId: string): { id: string; name: string; tag: string } | null {
  const key = getRoomKey(userId, slot, locationId);
  const nodes = exploreRoomNodes.get(key);
  if (!nodes || nodes.length === 0) return null;
  const idx = Math.floor(Math.random() * nodes.length);
  const removed = nodes.splice(idx, 1)[0];
  if (nodes.length === 0) exploreRoomNodes.delete(key);
  return removed;
}

function getLatestSlot(userId: string): number | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  slots.sort((a, b) => b.last_played.localeCompare(a.last_played));
  return slots[0].slot_number;
}

function buildExploreContainer(userId: string, slot: number): { container: ContainerBuilder } | null {
  const player = getPlayer(userId, slot);
  if (!player) return null;

  const location = getLocation(player.current_location);
  if (!location) return null;

  const world = getWorld(player.current_world);
  const connectedLocIds: string[] = JSON.parse(location.connected_locations || '[]');
  const connectedLocs = connectedLocIds.map((id: string) => getLocation(id)).filter(Boolean);
  const remainingNodes = getRemainingNodes(userId, slot, location.id);
  const formations = generateEnemyFormations(location.id);

  let hasDeliveryHere = false;
  try {
    const todaysDailies = getTodaysDailies(userId, slot);
    const deliveryDaily = todaysDailies.find((d: any) => d.commission_type === 'deliver' && d.completed === 0);
    if (deliveryDaily) {
      const prog = JSON.parse(deliveryDaily.progress || '[]');
      const targetLoc = prog.find((p: any) => p.deliver_to_location)?.deliver_to_location;
      hasDeliveryHere = targetLoc === player.current_location;
    }
  } catch {}

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Exploring The Area!'))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**${location.name}**\n${location.description}${world?.has_cold_meter ? `\n❄️ **Cold Meter:** ${player.cold_meter}/${player.cold_meter_max}` : ''}`
    ));

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Connected Zones'));

  for (let i = 0; i < connectedLocs.length; i += 10) {
    const chunk = connectedLocs.slice(i, i + 10).map(l => `• ${l.name}`).join('\n');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Available Resources in Current Room'));

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('hsr_explore_available_resources')
        .setLabel('Available Resources')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Enemies Possible In Room'));

  if (formations.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## No Enemies can be Seen in this room!'));
  } else {
    const lines = formations.map(f => `• ${f.label}`).join('\n');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hsr_explore_search')
      .setLabel('Search')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('hsr_explore_gather')
      .setLabel('Gather')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(remainingNodes.length === 0),
    ...(hasDeliveryHere
      ? [new ButtonBuilder()
          .setCustomId('hsr_explore_deliver')
          .setLabel('Deliver')
          .setStyle(ButtonStyle.Secondary)]
      : []),
  );
  container.addActionRowComponents(actionRow);

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  let moveRow = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;
  for (const loc of connectedLocs) {
    if (count === 5) {
      container.addActionRowComponents(moveRow);
      moveRow = new ActionRowBuilder<ButtonBuilder>();
      count = 0;
    }
    moveRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`hsr_explore_move_${loc.id}`)
        .setLabel(`Move to: ${loc.name}`)
        .setStyle(ButtonStyle.Secondary),
    );
    count++;
  }
  if (count > 0) {
    container.addActionRowComponents(moveRow);
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hsr_profile')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary),
  );

  if (hasDeliveryHere) {
    backRow.addComponents(
      new ButtonBuilder()
        .setCustomId('hsr_explore_deliver')
        .setLabel('📦 Deliver')
        .setStyle(ButtonStyle.Secondary),
    );
  }

  container.addActionRowComponents(backRow);

  return { container };
}

export async function handleHsrExplore(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  autoAssignDailies(userId, slot);

  const player = getPlayer(userId, slot);
  if (player) initRoomNodes(userId, slot, player.current_location);

  const view = buildExploreContainer(userId, slot);
  if (!view) {
    await interaction.reply({
      embeds: [embed('Error', 'Could not load location data.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    components: [view.container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrExploreMove(interaction: any) {
  const userId = interaction.user.id;
  const locId = interaction.customId.replace('hsr_explore_move_', '');
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const dest = getLocation(locId);
  if (!dest) {
    await interaction.reply({
      embeds: [embed('Error', 'Destination location not found.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  movePlayer(userId, slot, locId);

  const destWorld = getWorld(dest.world_id);
  if (dest.has_cold && destWorld?.has_cold_meter) {
    addColdMeter(userId, slot, -10);
  }

  incrementDailyObjective(userId, slot, 'explore_locations', locId);

  initRoomNodes(userId, slot, locId);

  await interaction.deferUpdate();

  const view = buildExploreContainer(userId, slot);
  await interaction.editReply({
    components: view ? [view.container] : [],
  });
}

export async function handleHsrExploreSearch(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const party = getParty(userId, slot);
  if (!party || party.length === 0) {
    await interaction.reply({
      embeds: [embed('No Party', 'You have no characters in your party.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const formations = generateEnemyFormations(player.current_location);
  if (formations.length === 0 || Math.random() >= 0.667) {
    await interaction.reply({
      embeds: [embedColored(0x3b1f6e, '🔍 Search Results', 'You search the area but find no enemies...')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const formation = formations[Math.floor(Math.random() * formations.length)];
  const enemyData = formation.enemyIds
    .map((id: string) => {
      const row = db.prepare('SELECT * FROM hsr_enemies WHERE id = ?').get(id) as any;
      return row;
    })
    .filter(Boolean);

  if (enemyData.length === 0) {
    await interaction.reply({
      embeds: [embedColored(0x3b1f6e, '🔍 Search Results', 'You search the area but find no enemies...')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const state = startCombat(interaction, userId, slot, enemyData);

  await interaction.reply({
    embeds: [buildCombatEmbed(state)],
    components: buildActionRows(state),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleHsrExploreAvailableResources(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({
      embeds: [embed('Error', 'Could not load player data.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const nodes = getRemainingNodes(userId, slot, player.current_location);
  if (nodes.length === 0) {
    await interaction.reply({
      embeds: [embed('No Resources', 'All resources in this area have been collected.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Available Resources in Current Room'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const node of nodes) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`• **${node.name}** — ${node.tag}`));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrExploreGather(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const node = removeRandomNode(userId, slot, player.current_location);
  if (!node) {
    await interaction.reply({ embeds: [embed('No Resources', 'All resources in this area have been collected.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const itemLines: string[] = [];
  itemLines.push(`Gathered from **${node.name}**`);

  const tagRewards = rollTagRewards(node.tag);
  for (const r of tagRewards) {
    if (r.item_id === 'credit') {
      addCredits(userId, slot, r.quantity);
    } else {
      addItem(userId, slot, r.item_id, r.quantity);
    }
    const name = getMaterialName(r.item_id);
    itemLines.push(`+ **${r.quantity}×** ${name}`);
  }

  const searchBonus = rollOldSearchReward();
  if (searchBonus.items) {
    for (const r of searchBonus.items) {
      if (r.item_id === 'credit') {
        addCredits(userId, slot, r.quantity);
      } else {
        addItem(userId, slot, r.item_id, r.quantity);
      }
    }
  }
  if (!searchBonus.secret || searchBonus.text !== 'nothing of interest') {
    itemLines.push(`+ ${searchBonus.text}`);
  }

  incrementDailyObjective(userId, slot, 'gather_resources');
  const { advanceQuest } = require('../hsr/db');
  advanceQuest(userId, slot, 'gather_resources');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Resources Collected'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const line of itemLines) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrExploreDeliver(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({ embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const todaysDailies = getTodaysDailies(userId, slot);
  const deliveryDaily = todaysDailies.find((d: any) => d.commission_type === 'deliver' && d.completed === 0);
  if (!deliveryDaily) {
    await interaction.reply({ embeds: [embed('No Delivery', 'You have no pending delivery commissions.')], flags: MessageFlags.Ephemeral });
    return;
  }

  completeDaily(userId, slot, deliveryDaily.commission_id);
  const { advanceQuest } = require('../hsr/db');
  advanceQuest(userId, slot, 'complete_dailies');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# 📦 Delivery Complete'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You delivered to **${deliveryDaily.description}**!`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

export async function handleHsrBackToExplore(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const view = buildExploreContainer(userId, slot);
  if (!view) {
    await interaction.reply({
      embeds: [embed('Error', 'Could not load explore view.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({
    components: [view.container],
  });
}