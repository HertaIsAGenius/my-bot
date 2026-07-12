import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { embed, embedColored } from '../utils/embed';
import { getSaveSlots, getPlayer, getParty, getEnemiesByLocation, addCredits, addTrailblazeXp, addItem, getMaterialName, getEnemyMaterialFamily, rollMaterialDrop, rollCreditDrop } from '../hsr/db';

interface CombatState {
  userId: string;
  slot: number;
  characters: CombatCharacter[];
  enemies: CombatEnemy[];
  skillPoints: number;
  turnIndex: number;
  turnOrder: { type: 'ally' | 'enemy'; index: number }[];
  active: boolean;
  log: string[];
}

interface CombatCharacter {
  charId: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  energy: number;
  maxEnergy: number;
  taunt: number;
  element: string;
  alive: boolean;
}

interface CombatEnemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  toughness: number;
  maxToughness: number;
  weakness: string[];
  resistances: string[];
  alive: boolean;
  broken: boolean;
}

const combatStates = new Map<string, CombatState>();

function getLatestSlot(userId: string): number | null {
  const slots = getSaveSlots(userId);
  if (slots.length === 0) return null;
  slots.sort((a, b) => b.last_played.localeCompare(a.last_played));
  return slots[0].slot_number;
}

function calcHp(baseHp: number, level: number): number {
  return baseHp + (level - 1) * 15;
}

function calcAtk(baseAtk: number, level: number): number {
  return Math.floor(baseAtk + (level - 1) * 1.5);
}

function calcDef(baseDef: number, level: number): number {
  return Math.floor(baseDef + (level - 1));
}

function dealDamage(atk: number, def: number, multiplier: number, isBroken: boolean): number {
  const base = atk * multiplier;
  const defMult = 1000 / (1000 + def);
  const brokenMult = isBroken ? 1.25 : 1.0;
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.floor(base * defMult * brokenMult * variance));
}

function recalculateTurnOrder(state: CombatState): void {
  const entries: { type: 'ally' | 'enemy'; index: number; speed: number }[] = [];
  for (let i = 0; i < state.characters.length; i++) {
    if (state.characters[i].alive) {
      entries.push({ type: 'ally', index: i, speed: state.characters[i].speed });
    }
  }
  for (let i = 0; i < state.enemies.length; i++) {
    if (state.enemies[i].alive) {
      entries.push({ type: 'enemy', index: i, speed: state.enemies[i].speed });
    }
  }
  entries.sort((a, b) => b.speed - a.speed || Math.random() - 0.5);
  state.turnOrder = entries.map(e => ({ type: e.type, index: e.index }));
}

function advanceTurn(state: CombatState): void {
  if (!state.active) return;
  state.turnIndex++;
  if (state.turnIndex >= state.turnOrder.length) {
    recalculateTurnOrder(state);
    state.turnIndex = 0;
  }
  const entity = state.turnOrder[state.turnIndex];
  if (!entity) return;
  const isAlive = entity.type === 'ally'
    ? state.characters[entity.index]?.alive
    : state.enemies[entity.index]?.alive;
  if (!isAlive) {
    advanceTurn(state);
  }
}

function isEnemyTurn(state: CombatState): boolean {
  if (state.turnOrder.length === 0) return false;
  const entity = state.turnOrder[state.turnIndex];
  return entity?.type === 'enemy';
}

function buildHpBar(current: number, max: number, length: number = 10): string {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function buildEnergyBar(current: number, max: number, length: number = 8): string {
  const filled = Math.round((current / max) * length);
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

export function buildCombatEmbed(state: CombatState): object {
  const lines: string[] = [];

  const turnOrderLines: string[] = [];
  for (let i = 0; i < state.turnOrder.length; i++) {
    const ent = state.turnOrder[i];
    const name = ent.type === 'ally'
      ? state.characters[ent.index].name
      : state.enemies[ent.index]?.name ?? 'Unknown';
    const prefix = i === state.turnIndex ? '⬅️ **' : '';
    const suffix = i === state.turnIndex ? '**' : '';
    turnOrderLines.push(`${prefix}${i + 1}. ${name}${suffix}`);
  }
  lines.push('**Turn Order**');
  lines.push(turnOrderLines.join('\n'));
  lines.push('');

  if (state.log.length > 0) {
    const recentLog = state.log.slice(-6);
    lines.push('**Combat Log**');
    for (const entry of recentLog) {
      lines.push(`> ${entry}`);
    }
    lines.push('');
  }

  lines.push('**Party**');
  for (const c of state.characters) {
    if (!c.alive) {
      lines.push(`💀 ~~${c.name}~~`);
      continue;
    }
    const hpBar = buildHpBar(c.hp, c.maxHp);
    const energyBar = buildEnergyBar(c.energy, c.maxEnergy);
    lines.push(`❤️ **${c.name}** \`${c.hp}/${c.maxHp}\``);
    lines.push(`   ${hpBar}  ⚡${energyBar} \`${c.energy}/${c.maxEnergy}\``);
  }
  lines.push('');

  lines.push('**Enemies**');
  for (const e of state.enemies) {
    if (!e.alive) {
      lines.push(`💀 ~~${e.name}~~`);
      continue;
    }
    const hpBar = buildHpBar(e.hp, e.maxHp);
    const toughnessBar = buildHpBar(e.toughness, e.maxToughness, 8);
    const brokenLabel = e.broken ? ' [BROKEN]' : '';
    lines.push(`**${e.name}${brokenLabel}** \`${e.hp}/${e.maxHp}\``);
    lines.push(`   ${hpBar}`);
    lines.push(`   ◆ Toughness: ${toughnessBar} \`${e.toughness}/${e.maxToughness}\``);
  }
  lines.push('');

  const spFilled = '◆'.repeat(state.skillPoints);
  const spEmpty = '◇'.repeat(5 - state.skillPoints);
  lines.push(`**Skill Points:** ${spFilled}${spEmpty}`);

  return embedColored(0x3b1f6e, '⚔️ Combat', lines.join('\n'));
}

export function buildActionRows(state: CombatState): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const entity = state.turnOrder[state.turnIndex];
  if (!entity || entity.type === 'enemy') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('hsr_combat_enemy_turn')
        .setLabel('Enemy Turn')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('hsr_combat_run')
        .setLabel('Run')
        .setStyle(ButtonStyle.Secondary),
    );
    rows.push(row);
    return rows;
  }

  const charIndex = entity.index;
  const c = state.characters[charIndex];
  const canSkill = state.skillPoints >= 1;
  const canUlt = c.energy >= c.maxEnergy;

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hsr_combat_action_${charIndex}_basic`)
      .setLabel('Basic ATK')
      .setEmoji('⚔️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`hsr_combat_action_${charIndex}_skill`)
      .setLabel('Skill')
      .setEmoji('💠')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canSkill),
    new ButtonBuilder()
      .setCustomId(`hsr_combat_action_${charIndex}_ultimate`)
      .setLabel('Ultimate')
      .setEmoji('💥')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canUlt),
    new ButtonBuilder()
      .setCustomId('hsr_combat_run')
      .setLabel('Run')
      .setEmoji('🏃')
      .setStyle(ButtonStyle.Secondary),
  );
  rows.push(actionRow);

  return rows;
}

function buildResultEmbed(title: string, description: string, color: number = 0x3b1f6e): object {
  return embedColored(color, title, description);
}

function buildVictoryRewards(userId: string, slot: number, enemies: CombatEnemy[]): string {
  const lines: string[] = [];
  const xpAmount = enemies.length * 30;
  const creditAmount = enemies.reduce((sum, e) => {
    const maxHp = e.maxHp;
    return sum + Math.floor(maxHp * 0.5);
  }, 0);

  const xpResult = addTrailblazeXp(userId, slot, xpAmount);
  addCredits(userId, slot, creditAmount);

  lines.push(`+ **${xpAmount}** Trailblaze XP`);
  if (xpResult.leveled) {
    lines.push(`⭐ **Level Up!** You are now **Lv.${xpResult.newLevel}**`);
  }
  lines.push(`+ **${creditAmount}** Credits`);

  for (const e of enemies) {
    if (!e.alive) continue;
    const loot: { item_id: string; chance: number; qty: number }[] = [];
    try {
      const row = (global as any).__db_getEnemyData?.(e.id) ?? null;
    } catch { /* empty */ }
  }

  return lines.join('\n');
}

function applyLoot(userId: string, slot: number, enemies: CombatEnemy[]): string[] {
  const lootLines: string[] = [];
  for (const e of enemies) {
    const family = getEnemyMaterialFamily(e.id);
    if (family) {
      const drop = rollMaterialDrop(family);
      if (drop) {
        addItem(userId, slot, drop.item_id, drop.quantity);
        lootLines.push(`+ **${drop.quantity}x** ${getMaterialName(drop.item_id)}`);
      }
    }
    const credits = rollCreditDrop();
    addCredits(userId, slot, credits);
    lootLines.push(`+ **${credits}** Credits`);
  }
  return lootLines;
}

function totalXpForEnemies(enemies: CombatEnemy[]): number {
  return enemies.reduce((sum, e) => sum + 30, 0);
}

function totalCreditsForEnemies(enemies: CombatEnemy[]): number {
  let total = 0;
  for (const _ of enemies) {
    total += rollCreditDrop();
  }
  return total;
}

async function showCombatView(interaction: any, state: CombatState): Promise<void> {
  const embed = buildCombatEmbed(state);
  const rows = buildActionRows(state);
  await interaction.update({ embeds: [embed], components: rows });
}

async function showVictory(interaction: any, state: CombatState): Promise<void> {
  const userId = state.userId;
  const slot = state.slot;
  combatStates.delete(`${userId}:${slot}`);

  const xpAmt = totalXpForEnemies(state.enemies);
  const creditAmt = totalCreditsForEnemies(state.enemies);
  const xpResult = addTrailblazeXp(userId, slot, xpAmt);
  addCredits(userId, slot, creditAmt);
  const lootLines = applyLoot(userId, slot, state.enemies);
  const { advanceQuest, unlockAchievement } = require('../hsr/db');
  advanceQuest(userId, slot, 'defeat_enemies');
  unlockAchievement(userId, slot, 'first_victory');

  const resultLines: string[] = ['Victory! All enemies defeated.', '', `+ **${xpAmt}** Trailblaze XP`, `+ **${creditAmt}** Credits`];
  if (xpResult.leveled) {
    resultLines.push(`⭐ **Level Up!** Lv.${xpResult.newLevel}`);
  }
  if (lootLines.length > 0) {
    resultLines.push('', '**Loot:**');
    resultLines.push(...lootLines);
  }

  await interaction.update({
    embeds: [buildResultEmbed('🎉 Victory!', resultLines.join('\n'), 0x3A7D44)],
    components: [],
  });
}

async function showDefeat(interaction: any, state: CombatState): Promise<void> {
  const userId = state.userId;
  const slot = state.slot;
  combatStates.delete(`${userId}:${slot}`);

  const lines = ['All party members have fallen.', 'Your party automatically recovers — no penalties.'];

  await interaction.update({
    embeds: [buildResultEmbed('💀 Defeat', lines.join('\n'), 0x9B2226)],
    components: [],
  });
}

async function showEscape(interaction: any, state: CombatState): Promise<void> {
  const userId = state.userId;
  const slot = state.slot;
  combatStates.delete(`${userId}:${slot}`);

  await interaction.update({
    embeds: [buildResultEmbed('🏃 Escaped', 'You successfully fled from battle!', 0xCA6702)],
    components: [],
  });
}

export function startCombat(interaction: any, userId: string, slot: number, pickedEnemies: any[]): CombatState {
  const party = getParty(userId, slot);
  const characters: CombatCharacter[] = [];
  const maxEnergy = 100;

  for (const pc of party) {
    const maxHp = calcHp(pc.base_hp, pc.level);
    characters.push({
      charId: pc.character_id,
      name: pc.name,
      hp: maxHp,
      maxHp,
      atk: calcAtk(pc.base_atk, pc.level),
      def: calcDef(pc.base_def, pc.level),
      speed: pc.base_speed,
      energy: Math.floor(maxEnergy * 0.5),
      maxEnergy,
      taunt: pc.taunt_value ?? 100,
      element: pc.element,
      alive: true,
    });
  }

  const combatEnemies: CombatEnemy[] = pickedEnemies.map((e: any) => ({
    id: e.id,
    name: e.name,
    hp: e.hp,
    maxHp: e.hp,
    atk: e.atk,
    def: e.def,
    speed: e.speed,
    toughness: e.toughness,
    maxToughness: e.toughness,
    weakness: JSON.parse(e.weaknesses || '[]'),
    resistances: JSON.parse(e.resistances || '[]'),
    alive: true,
    broken: false,
  }));

  const state: CombatState = {
    userId,
    slot,
    characters,
    enemies: combatEnemies,
    skillPoints: 3,
    turnIndex: 0,
    turnOrder: [],
    active: true,
    log: ['Combat begins!'],
  };

  recalculateTurnOrder(state);

  const key = `${userId}:${slot}`;
  combatStates.set(key, state);
  return state;
}

export async function handleHsrCombat(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const key = `${userId}:${slot}`;
  if (combatStates.has(key)) {
    await interaction.reply({
      embeds: [embed('Combat Active', 'You are already in combat! Finish or run first.')],
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
      embeds: [embed('No Party', 'You have no characters in your party. Summon or equip some first.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const enemies = getEnemiesByLocation(player.current_location);
  if (!enemies || enemies.length === 0) {
    await interaction.reply({
      embeds: [embed('Safe Zone', 'No enemies in this area. Explore another location.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pickedEnemies: any[] = [];
  const shuffled = [...enemies].sort(() => Math.random() - 0.5);
  const count = Math.min(2 + Math.floor(Math.random() * 2), shuffled.length);
  for (let i = 0; i < count; i++) {
    pickedEnemies.push(shuffled[i]);
  }

  const state = startCombat(interaction, userId, slot, pickedEnemies);

  await interaction.reply({
    embeds: [buildCombatEmbed(state)],
    components: buildActionRows(state),
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleHsrCombatAction(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const key = `${userId}:${slot}`;
  const state = combatStates.get(key);
  if (!state || !state.active) {
    await interaction.reply({
      embeds: [embed('No Combat', 'No active combat session. Start one with the combat button.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parts = interaction.customId.split('_');
  const charIndex = parseInt(parts[3]);
  const action = parts[4] as 'basic' | 'skill' | 'ultimate';

  const char = state.characters[charIndex];
  if (!char || !char.alive) {
    await interaction.reply({
      embeds: [embed('Invalid', 'That character is not available.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targets = state.enemies.filter(e => e.alive);
  if (targets.length === 0) {
    await showVictory(interaction, state);
    return;
  }

  let multiplier: number;
  let energyGain: number;
  let spChange: number;

  switch (action) {
    case 'basic':
      multiplier = 1.0;
      energyGain = 20;
      spChange = 1;
      break;
    case 'skill':
      multiplier = 2.0;
      energyGain = 30;
      spChange = -1;
      break;
    case 'ultimate':
      multiplier = 3.0;
      energyGain = 0;
      spChange = 0;
      break;
  }

  if (action === 'skill' && state.skillPoints < 1) {
    await interaction.reply({
      embeds: [embed('No SP', 'Not enough Skill Points. Use Basic ATK or wait.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (action === 'ultimate' && char.energy < char.maxEnergy) {
    await interaction.reply({
      embeds: [embed('No Energy', 'Energy is not full.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  state.skillPoints = Math.max(0, Math.min(5, state.skillPoints + spChange));

  if (action !== 'ultimate') {
    char.energy = Math.min(char.maxEnergy, char.energy + energyGain);
  } else {
    char.energy = 0;
  }

  const target = targets[0];

  if (action === 'ultimate') {
    let totalDmg = 0;
    for (const enemy of state.enemies.filter(e => e.alive)) {
      const dmg = dealDamage(char.atk, enemy.def, multiplier, enemy.broken);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      totalDmg += dmg;
      if (enemy.hp <= 0) enemy.alive = false;
      if (enemy.weakness.includes(char.element)) {
        enemy.toughness = Math.max(0, enemy.toughness - 30);
        if (enemy.toughness <= 0 && !enemy.broken) {
          enemy.broken = true;
        }
      }
    }
    state.log.push(`${char.name} uses **Ultimate** on all enemies for **${totalDmg}** DMG!`);
  } else {
    const dmg = dealDamage(char.atk, target.def, multiplier, target.broken);
    target.hp = Math.max(0, target.hp - dmg);
    if (target.hp <= 0) target.alive = false;
    if (target.weakness.includes(char.element)) {
      target.toughness = Math.max(0, target.toughness - 20);
      if (target.toughness <= 0 && !target.broken) {
        target.broken = true;
      }
    }
    const actionLabel = action === 'basic' ? 'Basic ATK' : 'Skill';
    const brokenMsg = target.broken && target.hp > 0 ? ' **[BROKEN]**' : '';
    state.log.push(`${char.name} uses **${actionLabel}** on ${target.name}${brokenMsg} for **${dmg}** DMG!`);
  }

  const allEnemiesDead = state.enemies.every(e => !e.alive);
  const allAlliesDead = state.characters.every(c => !c.alive);

  if (allEnemiesDead) {
    await showVictory(interaction, state);
    return;
  }
  if (allAlliesDead) {
    await showDefeat(interaction, state);
    return;
  }

  advanceTurn(state);

  await showCombatView(interaction, state);
}

export async function handleHsrCombatEnemyTurn(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const key = `${userId}:${slot}`;
  const state = combatStates.get(key);
  if (!state || !state.active) {
    await interaction.reply({
      embeds: [embed('No Combat', 'No active combat session.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const aliveEnemies = state.enemies.filter(e => e.alive);
  const aliveAllies = state.characters.filter(c => c.alive);

  const resultLines: string[] = [];

  for (const enemy of aliveEnemies) {
    if (enemy.broken) {
      enemy.broken = false;
      enemy.toughness = enemy.maxToughness;
      resultLines.push(`**${enemy.name}** recovers from weakness break!`);
      state.log.push(`${enemy.name} recovers from break!`);
      continue;
    }

    const targets = state.characters.filter(c => c.alive);
    if (targets.length === 0) break;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const enemySkillMultiplier = 1.0;
    const dmg = dealDamage(enemy.atk, target.def, enemySkillMultiplier, false);
    target.hp = Math.max(0, target.hp - dmg);
    if (target.hp <= 0) target.alive = false;

    resultLines.push(`**${enemy.name}** attacks **${target.name}** for **${dmg}** DMG!`);
    state.log.push(`${enemy.name} hits ${target.name} for **${dmg}** DMG!`);
    if (!target.alive) {
      resultLines.push(`💀 **${target.name}** has fallen!`);
      state.log.push(`💀 ${target.name} has fallen!`);
    }
  }

  const allAlliesDead = state.characters.every(c => !c.alive);
  const allEnemiesDead = state.enemies.every(e => !e.alive);

  if (allAlliesDead) {
    await showDefeat(interaction, state);
    return;
  }
  if (allEnemiesDead) {
    await showVictory(interaction, state);
    return;
  }

  advanceTurn(state);

  const color = 0x9B2226;
  const resultEmbed = embedColored(color, '⚡ Enemy Turn', resultLines.join('\n'));
  const combatView = buildCombatEmbed(state);
  const rows = buildActionRows(state);

  await interaction.update({
    embeds: [resultEmbed, combatView],
    components: rows,
  });
}

export async function handleHsrCombatRun(interaction: any) {
  const userId = interaction.user.id;
  const slot = getLatestSlot(userId);
  if (!slot) {
    await interaction.reply({
      embeds: [embed('No Save Found', 'Use `/hsr begin` to create your Trailblazer.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const key = `${userId}:${slot}`;
  const state = combatStates.get(key);
  if (!state || !state.active) {
    await interaction.reply({
      embeds: [embed('No Combat', 'No active combat session.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (Math.random() < 0.7) {
    await showEscape(interaction, state);
    return;
  }

  const aliveEnemies = state.enemies.filter(e => e.alive);
  const aliveAllies = state.characters.filter(c => c.alive);
  const failLines: string[] = ['Failed to escape!'];

  for (const enemy of aliveEnemies) {
    const targets = state.characters.filter(c => c.alive);
    if (targets.length === 0) break;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const dmg = dealDamage(enemy.atk, target.def, 1.0, false);
    target.hp = Math.max(0, target.hp - dmg);
    if (target.hp <= 0) target.alive = false;

    failLines.push(`**${enemy.name}** hits **${target.name}** for **${dmg}** DMG!`);
    state.log.push(`${enemy.name} hits ${target.name} for **${dmg}** DMG!`);
    if (!target.alive) {
      failLines.push(`💀 **${target.name}** has fallen!`);
      state.log.push(`💀 ${target.name} has fallen!`);
    }
  }

  const allAlliesDead = state.characters.every(c => !c.alive);
  if (allAlliesDead) {
    await showDefeat(interaction, state);
    return;
  }

  const failEmbed = embedColored(0xCA6702, '🏃 Failed to Escape', failLines.join('\n'));
  const combatView = buildCombatEmbed(state);
  const rows = buildActionRows(state);

  await interaction.update({
    embeds: [failEmbed, combatView],
    components: rows,
  });
}
