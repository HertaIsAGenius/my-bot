import * as fs from 'fs';
import { dataPath } from './dataPath';

export interface LevelData {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  lastMessageTimestamp: number;
  weeklyXp: number;
  weeklyResetTimestamp: number;
}

const DATA_FILE = dataPath('levels.json');

let dataCache: Record<string, LevelData> | null = null;

function readData(): Record<string, LevelData> {
  if (dataCache) return dataCache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Record<string, LevelData>;
      dataCache = parsed;
      return parsed;
    }
  } catch {}
  dataCache = {};
  return dataCache;
}

function writeData(data: Record<string, LevelData>) {
  dataCache = data;
  if (!fs.existsSync(dataPath())) fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const cooldowns = new Map<string, number>();

export function getLevelData(userId: string, guildId: string): LevelData | null {
  const d = readData()[`${guildId}_${userId}`];
  if (!d) return null;
  if (d.weeklyXp === undefined) d.weeklyXp = 0;
  if (d.weeklyResetTimestamp === undefined) d.weeklyResetTimestamp = Date.now();
  return d;
}

function ensureWeekly(entry: LevelData) {
  if (entry.weeklyXp === undefined) entry.weeklyXp = 0;
  if (entry.weeklyResetTimestamp === undefined) entry.weeklyResetTimestamp = Date.now();
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

  const data = readData();
  let entry = data[key];
  const oldLevel = entry?.level ?? 0;

  if (!entry) {
    entry = { userId, guildId, xp: 0, level: 0, lastMessageTimestamp: 0, weeklyXp: 0, weeklyResetTimestamp: now };
    data[key] = entry;
  }

  ensureWeekly(entry);

  const gained = Math.floor(Math.random() * 11) + 15;
  entry.xp += gained;
  entry.weeklyXp += gained;
  entry.lastMessageTimestamp = now;
  entry.level = Math.floor((-50 + Math.sqrt(2500 + 200 * entry.xp)) / 100);
  writeData(data);

  return { leveledUp: entry.level > oldLevel, oldLevel, newLevel: entry.level, xp: entry.xp };
}

export function addXpDirect(userId: string, guildId: string, amount: number): { leveledUp: boolean; oldLevel: number; newLevel: number; xp: number } {
  const key = `${guildId}_${userId}`;
  const data = readData();
  let entry = data[key];
  const oldLevel = entry?.level ?? 0;

  if (!entry) {
    entry = { userId, guildId, xp: 0, level: 0, lastMessageTimestamp: 0, weeklyXp: 0, weeklyResetTimestamp: Date.now() };
    data[key] = entry;
  }

  ensureWeekly(entry);

  entry.xp += amount;
  entry.weeklyXp += amount;
  entry.level = Math.floor((-50 + Math.sqrt(2500 + 200 * entry.xp)) / 100);
  writeData(data);

  return { leveledUp: entry.level > oldLevel, oldLevel, newLevel: entry.level, xp: entry.xp };
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
  return Object.values(readData())
    .filter(e => e.guildId === guildId)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

export function getWeeklyLeaderboard(guildId: string, limit = 10): LevelData[] {
  return Object.values(readData())
    .filter(e => e.guildId === guildId)
    .map(e => {
      if (e.weeklyXp === undefined) e.weeklyXp = 0;
      if (e.weeklyResetTimestamp === undefined) e.weeklyResetTimestamp = 0;
      return e;
    })
    .sort((a, b) => (b.weeklyXp || 0) - (a.weeklyXp || 0))
    .slice(0, limit);
}

export function getRank(userId: string, guildId: string): number {
  const sorted = Object.values(readData())
    .filter(e => e.guildId === guildId)
    .sort((a, b) => b.xp - a.xp);
  const idx = sorted.findIndex(e => e.userId === userId);
  return idx === -1 ? 0 : idx + 1;
}

export function getWeeklyRank(userId: string, guildId: string): number {
  const sorted = Object.values(readData())
    .filter(e => e.guildId === guildId)
    .map(e => {
      if (e.weeklyXp === undefined) e.weeklyXp = 0;
      if (e.weeklyResetTimestamp === undefined) e.weeklyResetTimestamp = 0;
      return e;
    })
    .sort((a, b) => (b.weeklyXp || 0) - (a.weeklyXp || 0));
  const idx = sorted.findIndex(e => e.userId === userId);
  return idx === -1 ? 0 : idx + 1;
}

export function resetWeeklyXp(guildId: string): number {
  const data = readData();
  let count = 0;
  const now = Date.now();
  for (const key of Object.keys(data)) {
    if (data[key].guildId === guildId) {
      data[key].weeklyXp = 0;
      data[key].weeklyResetTimestamp = now;
      count++;
    }
  }
  if (count > 0) writeData(data);
  return count;
}

export function clearGuildXp(guildId: string): number {
  const data = readData();
  let count = 0;
  for (const key of Object.keys(data)) {
    if (data[key].guildId === guildId) {
      delete data[key];
      count++;
    }
  }
  if (count > 0) writeData(data);
  return count;
}
