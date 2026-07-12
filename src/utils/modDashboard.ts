import { getGuildConfig, setGuildConfig, getModCases, getModCase, ModCase } from './db';

// ── Dashboard channel / message persistence ──

export function getDashboardChannel(guildId: string): string | null {
  return getGuildConfig(guildId, 'mod_dashboard_channel');
}

export function setDashboardChannel(guildId: string, channelId: string | null) {
  setGuildConfig(guildId, 'mod_dashboard_channel', channelId);
}

export function getDashboardMessage(guildId: string): string | null {
  return getGuildConfig(guildId, 'mod_dashboard_message');
}

export function setDashboardMessage(guildId: string, messageId: string | null) {
  setGuildConfig(guildId, 'mod_dashboard_message', messageId);
}

// ── Panel state (non-persistent, derived from message) ──
export type DashboardView = 'main' | 'user' | 'cases' | 'case_detail';
export interface DashboardSession {
  view: DashboardView;
  targetUserId?: string;
  caseId?: number;
}
