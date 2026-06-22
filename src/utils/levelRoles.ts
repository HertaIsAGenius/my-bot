import * as fs from 'fs';
import { dataPath } from './dataPath';

const DATA_FILE = dataPath('levelRoles.json');

interface LevelRolesData {
  [guildId: string]: {
    [level: number]: string;
  };
}

let dataCache: LevelRolesData | null = null;

function readData(): LevelRolesData {
  if (dataCache) return dataCache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      dataCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return dataCache!;
    }
  } catch {}
  dataCache = {};
  return dataCache;
}

function writeData(data: LevelRolesData) {
  dataCache = data;
  if (!fs.existsSync(dataPath())) fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getLevelRole(guildId: string, level: number): string | null {
  const data = readData();
  return data[guildId]?.[level] ?? null;
}

export function setLevelRole(guildId: string, level: number, roleId: string) {
  const data = readData();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][level] = roleId;
  writeData(data);
}

export function removeLevelRole(guildId: string, level: number): boolean {
  const data = readData();
  if (!data[guildId]?.[level]) return false;
  delete data[guildId][level];
  if (Object.keys(data[guildId]).length === 0) delete data[guildId];
  writeData(data);
  return true;
}

export function listLevelRoles(guildId: string): { level: number; roleId: string }[] {
  const data = readData();
  if (!data[guildId]) return [];
  return Object.entries(data[guildId])
    .map(([level, roleId]) => ({ level: parseInt(level), roleId }))
    .sort((a, b) => a.level - b.level);
}
