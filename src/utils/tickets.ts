import {
  createTicket as dbCreateTicket, getTickets as dbGetTickets, getTicket as dbGetTicket,
  getTicketByChannel as dbGetByChannel, updateTicket as dbUpdateTicket,
  searchTickets as dbSearch, getTicketStats as dbGetStats,
  claimTicket as dbClaim, addNote as dbAddNote,
  closeTicket as dbClose, reopenTicket as dbReopen,
  setModeratorChannel as dbSetModChan, getModeratorChannel as dbGetModChan,
  getAllTickets as dbGetAllTickets,
} from './db';
import { TicketCategory } from './ticketConfig';

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

function mapRow(r: any): Ticket {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id || '',
    creatorId: r.creator_id,
    creatorTag: r.creator_tag || '',
    category: r.category || 'other',
    status: r.status || 'open',
    priority: r.priority || 'medium',
    subject: r.subject || '',
    claimedBy: r.claimed_by || null,
    claimedAt: r.claimed_at || null,
    notes: JSON.parse(r.notes || '[]'),
    createdAt: r.created_at,
    closedAt: r.closed_at || null,
    closedBy: r.closed_by || null,
    closeReason: r.close_reason || null,
    transcriptPath: r.transcript_path || null,
  };
}

export function createTicket(
  guildId: string, channelId: string, creatorId: string, creatorTag: string,
  category: TicketCategory, subject?: string
): Ticket {
  const row = dbCreateTicket(guildId, channelId, creatorId, creatorTag, category, subject);
  return mapRow(row);
}

export function getTickets(guildId: string): Ticket[] {
  return (dbGetTickets(guildId) as any[]).map(mapRow);
}

export function getTicket(guildId: string, ticketId: number): Ticket | null {
  const row = dbGetTicket(guildId, ticketId);
  return row ? mapRow(row) : null;
}

export function getTicketByChannel(channelId: string): Ticket | null {
  const row = dbGetByChannel(channelId);
  return row ? mapRow(row) : null;
}

export function updateTicket(guildId: string, ticketId: number, updates: Partial<Ticket>) {
  const dbUpdates: any = {};
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.claimedBy !== undefined) dbUpdates.claimed_by = updates.claimedBy;
  if (updates.claimedAt !== undefined) dbUpdates.claimed_at = updates.claimedAt;
  if (updates.closedBy !== undefined) dbUpdates.closed_by = updates.closedBy;
  if (updates.closedAt !== undefined) dbUpdates.closed_at = updates.closedAt;
  if (updates.closeReason !== undefined) dbUpdates.close_reason = updates.closeReason;
  if (updates.transcriptPath !== undefined) dbUpdates.transcript_path = updates.transcriptPath;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  const result = dbUpdateTicket(guildId, ticketId, dbUpdates);
  return result ? mapRow(result) : null;
}

export function claimTicket(guildId: string, ticketId: number, userId: string) {
  const result = dbClaim(guildId, ticketId, userId);
  return result ? mapRow(result) : null;
}

export function addNote(guildId: string, ticketId: number, authorId: string, content: string) {
  const result = dbAddNote(guildId, ticketId, authorId, content);
  return result ? mapRow(result) : null;
}

export function closeTicket(guildId: string, ticketId: number, closedBy: string, reason?: string, transcriptPath?: string) {
  const result = dbClose(guildId, ticketId, closedBy, reason, transcriptPath);
  return result ? mapRow(result) : null;
}

export function reopenTicket(guildId: string, ticketId: number) {
  const result = dbReopen(guildId, ticketId);
  return result ? mapRow(result) : null;
}

export function searchTickets(guildId: string, query: { userId?: string; status?: TicketStatus; category?: TicketCategory }): Ticket[] {
  return (dbSearch(guildId, query) as any[]).map(mapRow);
}

export function getTicketStats(guildId: string) {
  return dbGetStats(guildId);
}

export function addTicket(guildId: string, reporterId: string, _reportedId: string | undefined, reason: string): Ticket {
  return createTicket(guildId, '', reporterId, 'Unknown', 'other', reason);
}

export function setModeratorChannel(guildId: string, channelId: string) {
  dbSetModChan(guildId, channelId);
}

export function preloadAllTickets() {
}

export function getModeratorChannel(guildId: string): string | null {
  return dbGetModChan(guildId);
}
