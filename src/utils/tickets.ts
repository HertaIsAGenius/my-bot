import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TicketCategory, getTicketConfig, setTicketConfig } from './ticketConfig';
import { dataPath } from './dataPath';

export type TicketStatus = 'open' | 'claimed' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketNote {
  authorId: string;
  content: string;
  createdAt: number;
}

export interface Ticket {
  id: number;
  guildId: string;
  channelId: string;
  creatorId: string;
  creatorTag: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  claimedBy: string | null;
  claimedAt: number | null;
  notes: TicketNote[];
  createdAt: number;
  closedAt: number | null;
  closedBy: string | null;
  closeReason: string | null;
  transcriptPath: string | null;
}

const DATA_FILE = dataPath('tickets.json');

const cache = new Map<string, Ticket[]>();

function loadAll(): Record<string, Ticket[]> {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveAll(data: Record<string, Ticket[]>) {
  const dir = dataPath();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function load(guildId: string): Ticket[] {
  if (cache.has(guildId)) return cache.get(guildId)!;
  const all = loadAll();
  const list = all[guildId] || [];
  cache.set(guildId, list);
  return list;
}

function save(guildId: string) {
  const all = loadAll();
  all[guildId] = cache.get(guildId) || [];
  saveAll(all);
}

export function createTicket(
  guildId: string,
  channelId: string,
  creatorId: string,
  creatorTag: string,
  category: TicketCategory,
  subject?: string
): Ticket {
  const list = load(guildId);
  const id = list.length > 0 ? list[list.length - 1].id + 1 : 1;
  const ticket: Ticket = {
    id,
    guildId,
    channelId,
    creatorId,
    creatorTag,
    category,
    status: 'open',
    priority: 'medium',
    subject: subject || '',
    claimedBy: null,
    claimedAt: null,
    notes: [],
    createdAt: Date.now(),
    closedAt: null,
    closedBy: null,
    closeReason: null,
    transcriptPath: null
  };
  list.push(ticket);
  save(guildId);
  return ticket;
}

export function getTickets(guildId: string): Ticket[] {
  return load(guildId);
}

export function getTicket(guildId: string, ticketId: number): Ticket | null {
  return load(guildId).find(t => t.id === ticketId) ?? null;
}

export function getTicketByChannel(channelId: string): Ticket | null {
  for (const [, list] of cache) {
    const t = list.find(t => t.channelId === channelId);
    if (t) return t;
  }
  const all = loadAll();
  for (const guildId of Object.keys(all)) {
    const t = all[guildId].find(t => t.channelId === channelId);
    if (t) {
      cache.set(guildId, all[guildId]);
      return t;
    }
  }
  return null;
}

export function updateTicket(guildId: string, ticketId: number, updates: Partial<Ticket>) {
  const list = load(guildId);
  const idx = list.findIndex(t => t.id === ticketId);
  if (idx === -1) return null;
  Object.assign(list[idx], updates);
  save(guildId);
  return list[idx];
}

export function claimTicket(guildId: string, ticketId: number, userId: string) {
  return updateTicket(guildId, ticketId, { status: 'claimed', claimedBy: userId, claimedAt: Date.now() });
}

export function addNote(guildId: string, ticketId: number, authorId: string, content: string) {
  const list = load(guildId);
  const t = list.find(t => t.id === ticketId);
  if (!t) return null;
  t.notes.push({ authorId, content, createdAt: Date.now() });
  save(guildId);
  return t;
}

export function closeTicket(guildId: string, ticketId: number, closedBy: string, reason?: string, transcriptPath?: string) {
  return updateTicket(guildId, ticketId, {
    status: 'closed',
    closedBy,
    closedAt: Date.now(),
    closeReason: reason || null,
    transcriptPath: transcriptPath || null
  });
}

export function reopenTicket(guildId: string, ticketId: number) {
  return updateTicket(guildId, ticketId, {
    status: 'open',
    closedBy: null,
    closedAt: null,
    closeReason: null
  });
}

export function searchTickets(guildId: string, query: { userId?: string; status?: TicketStatus; category?: TicketCategory }): Ticket[] {
  return load(guildId).filter(t => {
    if (query.userId && t.creatorId !== query.userId) return false;
    if (query.status && t.status !== query.status) return false;
    if (query.category && t.category !== query.category) return false;
    return true;
  });
}

export function getTicketStats(guildId: string) {
  const tickets = load(guildId);
  const open = tickets.filter(t => t.status === 'open');
  const claimed = tickets.filter(t => t.status === 'claimed');
  const closed = tickets.filter(t => t.status === 'closed');
  const byCategory = {} as Record<string, number>;
  const byStaff = {} as Record<string, { closed: number; claimed: number }>;

  for (const t of tickets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    if (t.claimedBy) {
      byStaff[t.claimedBy] = byStaff[t.claimedBy] || { closed: 0, claimed: 0 };
      byStaff[t.claimedBy].claimed++;
      if (t.status === 'closed') byStaff[t.claimedBy].closed++;
    }
  }

  const avgClosureMs = closed.reduce((sum, t) => {
    if (t.closedAt && t.createdAt) return sum + (t.closedAt - t.createdAt);
    return sum;
  }, 0) / (closed.length || 1);

  return {
    total: tickets.length,
    open: open.length,
    claimed: claimed.length,
    closed: closed.length,
    byCategory,
    byStaff,
    avgClosureHours: Math.round(avgClosureMs / 3600000 * 10) / 10
  };
}

// ── Legacy wrappers ────────────────────────────────────

export function addTicket(guildId: string, reporterId: string, _reportedId: string | undefined, reason: string): Ticket {
  return createTicket(guildId, '', reporterId, 'Unknown', 'other', reason);
}

export function setModeratorChannel(guildId: string, channelId: string) {
  setTicketConfig(guildId, { loggingChannelId: channelId });
}

export function preloadAllTickets() {
  const all = loadAll();
  for (const [guildId, tickets] of Object.entries(all)) {
    cache.set(guildId, tickets);
  }
}

export function getModeratorChannel(guildId: string): string | null {
  return getTicketConfig(guildId).loggingChannelId;
}
