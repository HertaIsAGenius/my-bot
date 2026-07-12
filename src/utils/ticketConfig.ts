import { getTicketConfig as dbGet, setTicketConfig as dbSet, setPingRole as dbSetPing, getPingRole as dbGetPing } from './db';

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

export function getTicketConfig(guildId: string): TicketGuildConfig {
  return dbGet(guildId) as TicketGuildConfig;
}

export function setTicketConfig(guildId: string, config: Partial<TicketGuildConfig>) {
  dbSet(guildId, config);
}

export function setPingRole(guildId: string, category: ThreadCategory, roleId: string | null) {
  dbSetPing(guildId, category, roleId);
}

export function getPingRole(guildId: string, category: string): string | null {
  return dbGetPing(guildId, category);
}
