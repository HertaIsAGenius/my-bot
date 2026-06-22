import * as fs from 'fs';
import { dataPath } from './dataPath';

const DATA_FILE = dataPath('levelNotifConfig.json');

let cache: Record<string, string | null> | null = null;

function read(): Record<string, string | null> {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return cache!;
    }
  } catch {}
  cache = {};
  return cache;
}

function write(data: Record<string, string | null>) {
  cache = data;
  if (!fs.existsSync(dataPath())) fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getLevelUpChannel(guildId: string): string | null {
  return read()[guildId] ?? null;
}

export function setLevelUpChannel(guildId: string, channelId: string | null) {
  const data = read();
  if (channelId === null) {
    delete data[guildId];
  } else {
    data[guildId] = channelId;
  }
  write(data);
}
