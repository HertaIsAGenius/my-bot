import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const dataDir = dataPath();
const configPath = join(dataDir, 'logConfig.json');
const channelConfigPath = join(dataDir, 'channelLogConfig.json');

let configCache: Record<string, { messages?: boolean; reactions?: boolean }> | null = null;
let channelConfigCache: Record<string, { messages?: boolean; reactions?: boolean }> | null = null;

function ensureDataDir() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function loadConfig(): Record<string, { messages?: boolean; reactions?: boolean }> {
  if (configCache) return configCache;
  ensureDataDir();
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({}), 'utf-8');
    configCache = {};
    return configCache;
  }
  try {
    configCache = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, { messages?: boolean; reactions?: boolean }>;
  } catch {
    writeFileSync(configPath, JSON.stringify({}), 'utf-8');
    configCache = {};
  }
  return configCache;
}

function saveConfig(cfg: Record<string, { messages?: boolean; reactions?: boolean }>) {
  configCache = cfg;
  ensureDataDir();
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

function loadChannelConfig(): Record<string, { messages?: boolean; reactions?: boolean }> {
  if (channelConfigCache) return channelConfigCache;
  ensureDataDir();
  if (!existsSync(channelConfigPath)) {
    writeFileSync(channelConfigPath, JSON.stringify({}), 'utf-8');
    channelConfigCache = {};
    return channelConfigCache;
  }
  try {
    channelConfigCache = JSON.parse(readFileSync(channelConfigPath, 'utf-8')) as Record<string, { messages?: boolean; reactions?: boolean }>;
  } catch {
    writeFileSync(channelConfigPath, JSON.stringify({}), 'utf-8');
    channelConfigCache = {};
  }
  return channelConfigCache;
}

function saveChannelConfig(cfg: Record<string, { messages?: boolean; reactions?: boolean }>) {
  channelConfigCache = cfg;
  ensureDataDir();
  writeFileSync(channelConfigPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function isMessageLoggingEnabled(guildId: string, channelId?: string) {
  if (channelId) {
    return loadChannelConfig()[channelId]?.messages ?? false;
  }
  return loadConfig()[guildId]?.messages ?? false;
}

export function isReactionLoggingEnabled(guildId: string, channelId?: string) {
  if (channelId) {
    return loadChannelConfig()[channelId]?.reactions ?? false;
  }
  return loadConfig()[guildId]?.reactions ?? false;
}

export function setMessageLoggingEnabled(guildId: string, enabled: boolean, channelId?: string) {
  if (channelId) {
    setChannelMessageLogging(channelId, enabled);
    return;
  }
  const cfg = loadConfig();
  cfg[guildId] = { ...cfg[guildId], messages: enabled };
  saveConfig(cfg);
}

export function setReactionLoggingEnabled(guildId: string, enabled: boolean, channelId?: string) {
  if (channelId) {
    setChannelReactionLogging(channelId, enabled);
    return;
  }
  const cfg = loadConfig();
  cfg[guildId] = { ...cfg[guildId], reactions: enabled };
  saveConfig(cfg);
}

export function setChannelMessageLogging(channelId: string, enabled: boolean) {
  const cfg = loadChannelConfig();
  cfg[channelId] = { ...cfg[channelId], messages: enabled };
  saveChannelConfig(cfg);
}

export function setChannelReactionLogging(channelId: string, enabled: boolean) {
  const cfg = loadChannelConfig();
  cfg[channelId] = { ...cfg[channelId], reactions: enabled };
  saveChannelConfig(cfg);
}

const MAX_LOG_BYTES = 50 * 1024 * 1024;

function checkLogRotation(guildId: string, logName: string) {
  const dir = join(dataDir, guildId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const logPath = join(dir, `${logName}.jsonl`);
  if (existsSync(logPath)) {
    try {
      const { size } = statSync(logPath);
      if (size >= MAX_LOG_BYTES) {
        const backupPath = join(dir, `${logName}_${Date.now()}.jsonl`);
        renameSync(logPath, backupPath);
      }
    } catch {}
  }
}

export function logMessage(guildId: string, entry: { messageId: string; authorId: string; content: string; channelId: string }) {
  checkLogRotation(guildId, 'messages');
  const dir = join(dataDir, guildId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'messages.jsonl'), JSON.stringify(entry) + '\n', 'utf-8');
}

export function logReaction(guildId: string, entry: { messageId: string; authorId: string; emoji: string; channelId: string; added: boolean }) {
  checkLogRotation(guildId, 'reactions');
  const dir = join(dataDir, guildId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'reactions.jsonl'), JSON.stringify(entry) + '\n', 'utf-8');
}
