import { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { embed } from '../utils/embed';
import { getSaveSlots, getPlayer, getTodaysDailies, autoAssignDailies, addCredits, addJade, addTrailblazeXp, addItem, completeDaily, db } from '../hsr/db';

const MIDDOT = '<:MiddleDot:1525119992549605447>';
const MIDDOT_EATEN = '<:MiddleDotEaten:1525120194018676826>';
const ONEIRIC = '<:Oneiricremovebgpreview:1525121031268864041>';

function aggregateRewards(dailies: any[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const d of dailies) {
    if (!d.rewards) continue;
    try {
      const r = JSON.parse(d.rewards);
      if (r.credits) totals.credits = (totals.credits || 0) + r.credits;
      if (r.stellar_jade) totals.stellar_jade = (totals.stellar_jade || 0) + r.stellar_jade;
      if (r.trailblaze_xp) totals.trailblaze_xp = (totals.trailblaze_xp || 0) + r.trailblaze_xp;
      if (r.relic_fragment) totals.relic_fragment = (totals.relic_fragment || 0) + r.relic_fragment;
      if (r.items) {
        for (const item of r.items) {
          const key = `item_${item.item_id}`;
          totals[key] = (totals[key] || 0) + item.qty;
        }
      }
    } catch {}
  }
  return totals;
}

function formatRewardLines(totals: Record<string, number>): string[] {
  const lines: string[] = [];
  if (totals.credits) lines.push(`${totals.credits.toLocaleString()} Credits`);
  if (totals.stellar_jade) lines.push(`${totals.stellar_jade} Stellar Jade`);
  if (totals.trailblaze_xp) lines.push(`${totals.trailblaze_xp} Trailblaze XP`);
  if (totals.relic_fragment) lines.push(`Relic Fragment x${totals.relic_fragment}`);
  for (const [key, qty] of Object.entries(totals)) {
    if (key.startsWith('item_')) {
      const name = key.slice(5).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      lines.push(`${name} x${qty}`);
    }
  }
  return lines;
}

export async function handleHsrDailies(interaction: any) {
  const userId = interaction.user.id;

  const slots = getSaveSlots(userId);
  if (!slots.length) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create a Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const slot = slots.sort((a, b) => b.last_played.localeCompare(a.last_played))[0].slot_number;

  const player = getPlayer(userId, slot);
  if (!player) {
    await interaction.reply({
      embeds: [embed('Corrupted Save', 'Use `/hsr begin` to recreate this slot.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  autoAssignDailies(userId, slot);

  const dailies = getTodaysDailies(userId, slot);
  const allCompleted = dailies.length > 0 && dailies.every((d: any) => d.completed === 1);
  const totals = aggregateRewards(dailies);
  const rewardLines = formatRewardLines(totals);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Daily Commissions Page'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const d of dailies) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${d.completed ? MIDDOT_EATEN : MIDDOT} ${d.description}`),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Earnable Rewards Today'));

  for (const line of rewardLines) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${ONEIRIC} ${line}`),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_dailies_claim')
          .setLabel('Claim')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!allCompleted),
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

export async function handleHsrClaimDaily(interaction: any) {
  const userId = interaction.user.id;

  const slots = getSaveSlots(userId);
  if (!slots.length) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create a Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const slot = slots.sort((a, b) => b.last_played.localeCompare(a.last_played))[0].slot_number;

  const dailies = getTodaysDailies(userId, slot);
  const unclaimed = dailies.filter((d: any) => {
    if (d.completed !== 1) return false;
    try {
      const prog = JSON.parse(d.progress || '[]');
      return !prog.claimed;
    } catch {
      return true;
    }
  });

  if (!unclaimed.length) {
    await interaction.reply({
      embeds: [embed('Nothing to Claim', 'Complete your daily commissions first!')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let totalCredits = 0;
  let totalXp = 0;
  let totalJade = 0;
  let leveledUp = false;
  let newLevel = 0;
  const items: Record<string, number> = {};

  for (const d of unclaimed) {
    if (!d.rewards) continue;
    try {
      const rewards = JSON.parse(d.rewards);
      totalCredits += rewards.credits || 0;
      totalXp += rewards.trailblaze_xp || 0;
      totalJade += rewards.stellar_jade || 0;
      if (rewards.items) {
        for (const item of rewards.items) {
          items[item.item_id] = (items[item.item_id] || 0) + item.qty;
        }
      }
      if (rewards.relic_fragment) {
        items['relic_fragment'] = (items['relic_fragment'] || 0) + rewards.relic_fragment;
      }
    } catch {}
  }

  if (totalCredits > 0) addCredits(userId, slot, totalCredits);
  if (totalJade > 0) addJade(userId, slot, totalJade);
  if (totalXp > 0) {
    const result = addTrailblazeXp(userId, slot, totalXp);
    leveledUp = result.leveled;
    newLevel = result.newLevel;
  }
  for (const [itemId, qty] of Object.entries(items)) {
    addItem(userId, slot, itemId, qty);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { advanceQuest } = require('../hsr/db');
  advanceQuest(userId, slot, 'complete_dailies');
  const markClaimed = db.prepare('UPDATE hsr_player_dailies SET progress = ? WHERE user_id = ? AND slot_number = ? AND date = ? AND commission_id = ?');
  for (const d of unclaimed) {
    markClaimed.run(JSON.stringify([{ claimed: true }]), userId, slot, today, d.commission_id);
  }

  const rewardLines: string[] = [];
  if (totalCredits > 0) rewardLines.push(`${totalCredits.toLocaleString()} Credits`);
  if (totalJade > 0) rewardLines.push(`${totalJade} Stellar Jade`);
  if (totalXp > 0) rewardLines.push(`${totalXp} Trailblaze XP${leveledUp ? ` — Leveled up to ${newLevel}!` : ''}`);
  for (const [itemId, qty] of Object.entries(items)) {
    const name = itemId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    rewardLines.push(`${name} x${qty}`);
  }

  const claimedContainer = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Rewards Claimed'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Claimed rewards for **${unclaimed.length}** commission${unclaimed.length > 1 ? 's' : ''}!`),
    );

  for (const line of rewardLines) {
    claimedContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${ONEIRIC} ${line}`));
  }

  claimedContainer
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('hsr_profile')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  await interaction.update({
    components: [claimedContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

export function incrementDailyObjective(userId: string, slot: number, objectiveType: string, locationId?: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const dailies = db.prepare(`SELECT pd.*, dc.objectives
    FROM hsr_player_dailies pd JOIN hsr_daily_commissions dc ON pd.commission_id = dc.id
    WHERE pd.user_id = ? AND pd.slot_number = ? AND pd.date = ? AND pd.completed = 0`).all(userId, slot, today) as any[];

  for (const d of dailies) {
    let objectives: any[];
    try { objectives = JSON.parse(d.objectives); } catch { continue; }

    for (const obj of objectives) {
      if (obj.type !== objectiveType) continue;

      let progress: any[];
      try { progress = JSON.parse(d.progress || '[]'); } catch { progress = []; }

      let entry = progress.find((p: any) => p.type === objectiveType);
      if (!entry) {
        entry = { type: objectiveType, count: 0 };
        progress.push(entry);
      }

      if (objectiveType === 'explore_locations') {
        if (!entry.visited) entry.visited = [];
        if (locationId && entry.visited.includes(locationId)) continue;
        if (locationId) entry.visited.push(locationId);
        entry.count = entry.visited.length;
      } else {
        entry.count = (entry.count || 0) + 1;
      }

      if (entry.count >= obj.target) {
        completeDaily(userId, slot, d.commission_id);
      } else {
        db.prepare("UPDATE hsr_player_dailies SET progress = ? WHERE user_id = ? AND slot_number = ? AND date = ? AND commission_id = ?")
          .run(JSON.stringify(progress), userId, slot, today, d.commission_id);
      }
      break;
    }
  }
}
