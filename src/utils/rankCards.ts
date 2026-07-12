import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'rankCards.json');

export interface RankCardConfig {
  backgroundColor: string;
  accentColor: string;
  barColor: string;
  avatarStyle: 'hexagon' | 'circle' | 'square';
  fontFamily: string;
  backgroundImage: string | null;
}

const DEFAULTS: RankCardConfig = {
  backgroundColor: '#0c0f17',
  accentColor: '#4ef2d2',
  barColor: '#4ef2d2',
  avatarStyle: 'hexagon',
  fontFamily: "'DIN', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  backgroundImage: null,
};

type Store = Record<string, RankCardConfig>;

function loadAll(): Store {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveAll(data: Store) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function key(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function getCardConfig(guildId: string, userId: string): RankCardConfig {
  const all = loadAll();
  return { ...DEFAULTS, ...all[key(guildId, userId)] };
}

export function setCardConfig(guildId: string, userId: string, partial: Partial<RankCardConfig>): RankCardConfig {
  const all = loadAll();
  const k = key(guildId, userId);
  all[k] = { ...DEFAULTS, ...all[k], ...partial };
  saveAll(all);
  return all[k];
}

export function resetCardConfig(guildId: string, userId: string): RankCardConfig {
  const all = loadAll();
  delete all[key(guildId, userId)];
  saveAll(all);
  return { ...DEFAULTS };
}
