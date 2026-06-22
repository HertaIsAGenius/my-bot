import * as fs from 'fs';
import { dataPath } from './dataPath';

const DATA_FILE = dataPath('botperms.json');

let cache: Record<string, string[]> | null = null;

function read(): Record<string, string[]> {
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

function write(data: Record<string, string[]>) {
  cache = data;
  if (!fs.existsSync(dataPath())) fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function key(guildId: string, commandName: string): string {
  return `${guildId}_${commandName}`;
}

export function getCommandRoles(guildId: string, commandName: string): string[] {
  return read()[key(guildId, commandName)] ?? [];
}

export function setCommandRoles(guildId: string, commandName: string, roleIds: string[]) {
  const data = read();
  data[key(guildId, commandName)] = roleIds;
  write(data);
}

export function getAllPerms(guildId: string): Array<{ command: string; roles: string[] }> {
  const data = read();
  const prefix = `${guildId}_`;
  return Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, roles]) => ({ command: k.slice(prefix.length), roles }));
}
