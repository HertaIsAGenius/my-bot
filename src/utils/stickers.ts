import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const dataDir = dataPath();
const configPath = join(dataDir, 'stickerConfig.json');

export interface StickerConfig {
  enabled: boolean;
}

let cache: Record<string, StickerConfig> | null = null;

function ensure() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function load(): Record<string, StickerConfig> {
  if (cache) return cache;
  ensure();
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({}), 'utf-8');
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, StickerConfig>;
  } catch {
    writeFileSync(configPath, JSON.stringify({}), 'utf-8');
    cache = {};
  }
  return cache;
}

function save(c: Record<string, StickerConfig>) {
  cache = c;
  ensure();
  writeFileSync(configPath, JSON.stringify(c, null, 2), 'utf-8');
}

export function isStickerDetectionEnabled(guildId: string) {
  return load()[guildId]?.enabled ?? true;
}

export function setStickerDetectionEnabled(guildId: string, enabled: boolean) {
  const c = load();
  c[guildId] = { enabled };
  save(c);
}
