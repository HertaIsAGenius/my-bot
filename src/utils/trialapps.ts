import * as fs from 'fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const DATA_FILE = dataPath('trialapps.json');

interface Store {
  channelId: string | null;
  forms: Array<{ name: string; questions: string[] }>;
}

let cache: Record<string, Store> | null = null;

function read(): Record<string, Store> {
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

function write(data: Record<string, Store>) {
  cache = data;
  if (!fs.existsSync(dataPath())) fs.mkdirSync(dataPath(), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function ensure(guildId: string): Store {
  const data = read();
  if (!data[guildId]) data[guildId] = { channelId: null, forms: [] };
  return data[guildId];
}

export function getTrialAppChannel(guildId: string): string | null {
  return ensure(guildId).channelId;
}

export function setTrialAppChannel(guildId: string, channelId: string | null) {
  const data = read();
  if (!data[guildId]) data[guildId] = { channelId: null, forms: [] };
  data[guildId].channelId = channelId;
  write(data);
}

export function getForms(guildId: string): Array<{ name: string; questions: string[] }> {
  return ensure(guildId).forms;
}

export function getForm(guildId: string, name: string): { name: string; questions: string[] } | undefined {
  return ensure(guildId).forms.find(f => f.name === name);
}

export function addForm(guildId: string, form: { name: string; questions: string[] }) {
  const data = read();
  if (!data[guildId]) data[guildId] = { channelId: null, forms: [] };
  data[guildId].forms.push(form);
  write(data);
}
