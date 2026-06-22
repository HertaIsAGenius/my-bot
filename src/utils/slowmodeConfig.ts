import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const dataDir = dataPath();
const configPath = join(dataDir, 'slowmodeConfig.json');

interface SlowmodeConfig {
  enabledChannels: string[];
}

function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function loadConfig(): SlowmodeConfig {
  ensureDataDir();
  if (!existsSync(configPath)) {
    const initial: SlowmodeConfig = { enabledChannels: [] };
    writeFileSync(configPath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as SlowmodeConfig;
  } catch {
    const initial: SlowmodeConfig = { enabledChannels: [] };
    writeFileSync(configPath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function saveConfig(config: SlowmodeConfig) {
  ensureDataDir();
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

const config = loadConfig();
const enabledChannels = new Set<string>(config.enabledChannels);

export function isSlowmodeEnabled(channelId: string) {
  return enabledChannels.has(channelId);
}

export function enableSlowmodeChannel(channelId: string) {
  enabledChannels.add(channelId);
  saveConfig({ enabledChannels: Array.from(enabledChannels) });
}

export function disableSlowmodeChannel(channelId: string) {
  enabledChannels.delete(channelId);
  saveConfig({ enabledChannels: Array.from(enabledChannels) });
}

export function getEnabledSlowmodeChannels() {
  return new Set(enabledChannels);
}
