import { getLevelRow, upsertLevelRow, getAllLevels, deleteLevel, deleteAllGuildLevels, resetWeeklyXp as dbResetWeekly, LevelRow } from './db';

export interface LevelData {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  lastMessageTimestamp: number;
  weeklyXp: number;
  weeklyResetTimestamp: number;
}

function rowToData(row: LevelRow): LevelData {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    xp: row.xp,
    level: Math.floor((-50 + Math.sqrt(2500 + 200 * row.xp)) / 100),
    lastMessageTimestamp: row.last_message_at,
    weeklyXp: row.weekly_xp,
    weeklyResetTimestamp: row.weekly_reset_at,
  };
}

const cooldowns = new Map<string, number>();

export function getLevelData(userId: string, guildId: string): LevelData | null {
  const row = getLevelRow(guildId, userId);
  if (!row) return null;
  return rowToData(row);
}

export function addXp(userId: string, guildId: string): { leveledUp: boolean; oldLevel: number; newLevel: number; xp: number } {
  const key = `${guildId}_${userId}`;
  const now = Date.now();

  const last = cooldowns.get(key);
  if (last && now - last < 60000) {
    const existing = getLevelData(userId, guildId);
    return { leveledUp: false, oldLevel: existing?.level ?? 0, newLevel: existing?.level ?? 0, xp: existing?.xp ?? 0 };
  }
  cooldowns.set(key, now);

  const row = getLevelRow(guildId, userId);
  const oldLevel = row ? Math.floor((-50 + Math.sqrt(2500 + 200 * row.xp)) / 100) : 0;

  const gained = Math.floor(Math.random() * 11) + 15;
  const newXp = (row?.xp ?? 0) + gained;
  const newWeeklyXp = (row?.weekly_xp ?? 0) + gained;

  upsertLevelRow(guildId, userId, {
    xp: newXp,
    weekly_xp: newWeeklyXp,
    last_message_at: now,
  });

  const newLevel = Math.floor((-50 + Math.sqrt(2500 + 200 * newXp)) / 100);
  return { leveledUp: newLevel > oldLevel, oldLevel, newLevel, xp: newXp };
}

export function addXpDirect(userId: string, guildId: string, amount: number): { leveledUp: boolean; oldLevel: number; newLevel: number; xp: number } {
  const row = getLevelRow(guildId, userId);
  const oldLevel = row ? Math.floor((-50 + Math.sqrt(2500 + 200 * row.xp)) / 100) : 0;

  const newXp = (row?.xp ?? 0) + amount;
  const newWeeklyXp = (row?.weekly_xp ?? 0) + amount;

  upsertLevelRow(guildId, userId, {
    xp: newXp,
    weekly_xp: newWeeklyXp,
  });

  const newLevel = Math.floor((-50 + Math.sqrt(2500 + 200 * newXp)) / 100);
  return { leveledUp: newLevel > oldLevel, oldLevel, newLevel, xp: newXp };
}

export function xpForLevel(level: number): number {
  return 50 * level * (level + 1);
}

export function progressToNext(entry: LevelData): { current: number; needed: number; percent: number } {
  const curTotal = xpForLevel(entry.level);
  const nextTotal = xpForLevel(entry.level + 1);
  const xpInto = entry.xp - curTotal;
  const needed = nextTotal - curTotal;
  return { current: xpInto, needed, percent: needed > 0 ? Math.min(xpInto / needed, 1) : 0 };
}

export function getLeaderboard(guildId: string, limit = 10): LevelData[] {
  return getAllLevels(guildId)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)
    .map(rowToData);
}

export function getWeeklyLeaderboard(guildId: string, limit = 10): LevelData[] {
  return getAllLevels(guildId)
    .sort((a, b) => (b.weekly_xp || 0) - (a.weekly_xp || 0))
    .slice(0, limit)
    .map(rowToData);
}

export function getRank(userId: string, guildId: string): number {
  const sorted = getAllLevels(guildId)
    .sort((a, b) => b.xp - a.xp);
  const idx = sorted.findIndex(e => e.user_id === userId);
  return idx === -1 ? 0 : idx + 1;
}

export function getWeeklyRank(userId: string, guildId: string): number {
  const sorted = getAllLevels(guildId)
    .sort((a, b) => (b.weekly_xp || 0) - (a.weekly_xp || 0));
  const idx = sorted.findIndex(e => e.user_id === userId);
  return idx === -1 ? 0 : idx + 1;
}

export function resetWeeklyXp(guildId: string): number {
  return dbResetWeekly(guildId);
}

export function clearGuildXp(guildId: string): number {
  const rows = getAllLevels(guildId);
  deleteAllGuildLevels(guildId);
  return rows.length;
}
