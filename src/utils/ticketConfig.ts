import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

export const TICKET_CATEGORIES = ['support', 'bug', 'purchase', 'staff', 'other'] as const;
export type TicketCategory = typeof TICKET_CATEGORIES[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  support: 'Support',
  bug: 'Bug Report',
  purchase: 'Purchase Assistance',
  staff: 'Staff Report',
  other: 'Other'
};

export const CATEGORY_COLORS: Record<TicketCategory, number> = {
  support: 0x4FC3F7,
  bug: 0xF44336,
  purchase: 0x66BB6A,
  staff: 0xFFA726,
  other: 0x78909C
};

export const THREAD_CATEGORIES = ['inquiry', 'report', 'staffreport', 'hsr'] as const;
export type ThreadCategory = typeof THREAD_CATEGORIES[number];

export const THREAD_CATEGORY_LABELS: Record<ThreadCategory, string> = {
  inquiry: 'Server Inquiries',
  report: 'Server Reports',
  staffreport: 'Staff Reports',
  hsr: 'HSR Questions'
};

export interface TicketGuildConfig {
  ticketCategoryId: string | null;
  loggingChannelId: string | null;
  panelChannelId: string | null;
  panelMessageId: string | null;
  supportRoleIds: string[];
  pingRoles: Partial<Record<ThreadCategory, string>>;
}

const defaults: TicketGuildConfig = {
  ticketCategoryId: null,
  loggingChannelId: null,
  panelChannelId: null,
  panelMessageId: null,
  supportRoleIds: [],
  pingRoles: {}
};

const CONFIG_PATH = dataPath('ticketConfig.json');

let cache: Record<string, TicketGuildConfig> | null = null;

function load(): Record<string, TicketGuildConfig> {
  if (cache) return cache;
  try {
    if (existsSync(CONFIG_PATH)) {
      cache = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  cache = cache || {};
  return cache;
}

function save() {
  const dir = dataPath();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cache || {}, null, 2));
}

export function getTicketConfig(guildId: string): TicketGuildConfig {
  const all = load();
  return { ...defaults, ...(all[guildId] || {}) };
}

export function setTicketConfig(guildId: string, config: Partial<TicketGuildConfig>) {
  const all = load();
  all[guildId] = { ...getTicketConfig(guildId), ...config };
  save();
}

export function setPingRole(guildId: string, category: ThreadCategory, roleId: string | null) {
  const cfg = getTicketConfig(guildId);
  const pingRoles = { ...cfg.pingRoles };
  if (roleId) {
    pingRoles[category] = roleId;
  } else {
    delete pingRoles[category];
  }
  setTicketConfig(guildId, { pingRoles });
}

export function getPingRole(guildId: string, category: string): string | null {
  const cfg = getTicketConfig(guildId);
  return cfg.pingRoles[category as ThreadCategory] || null;
}
