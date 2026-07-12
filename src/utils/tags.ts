import { getTags as dbGetTags, getTag as dbGetTag, createTag as dbCreate, editTag as dbEdit, deleteTag as dbDelete, incrementTagUses as dbIncUses } from './db';

export interface StaffTag {
  id: number;
  guildId: string;
  name: string;
  aliases: string[];
  title: string;
  content: string;
  footer?: string;
  imageUrl?: string;
  createdBy: string;
  updatedBy?: string;
  uses: number;
  createdAt: number;
  updatedAt?: number;
}

function mapRow(r: any): StaffTag {
  return {
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    aliases: JSON.parse(r.aliases || '[]'),
    title: r.title || '',
    content: r.content,
    footer: r.footer || undefined,
    imageUrl: r.image_url || undefined,
    createdBy: r.created_by,
    updatedBy: r.updated_by || undefined,
    uses: r.uses || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at || undefined,
  };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
}

export function createTag(guildId: string, name: string, content: string, authorId: string, opts?: { aliases?: string[]; title?: string; footer?: string; imageUrl?: string }) {
  const n = normalizeName(name);
  if (!n) throw new Error('Tag name cannot be empty after normalization.');
  try {
    const result = dbCreate(guildId, n, content, authorId, opts);
    return mapRow(result);
  } catch (e: any) {
    if (e.message?.includes('already exists')) throw e;
    throw e;
  }
}

export function getTags(guildId: string): StaffTag[] {
  return (dbGetTags(guildId) as any[]).map(mapRow);
}

export function getTag(guildId: string, name: string): StaffTag | null {
  const n = normalizeName(name);
  const row = dbGetTag(guildId, n);
  return row ? mapRow(row) : null;
}

export function findTag(guildId: string, nameOrAlias: string): StaffTag | null {
  const n = normalizeName(nameOrAlias);
  const tags = dbGetTags(guildId) as any[];
  const found = tags.find((t: any) => t.name === n || (JSON.parse(t.aliases || '[]') as string[]).includes(n));
  return found ? mapRow(found) : null;
}

export function editTag(guildId: string, currentName: string, updates: { name?: string; content?: string; aliases?: string[]; title?: string; footer?: string; imageUrl?: string }, editorId: string) {
  const n = normalizeName(currentName);
  const result = dbEdit(guildId, n, updates, editorId);
  if (!result) return null;
  return mapRow(result);
}

export function deleteTag(guildId: string, name: string) {
  const n = normalizeName(name);
  const result = dbDelete(guildId, n);
  return result ? mapRow(result) : null;
}

export function incrementTagUses(guildId: string, name: string) {
  const n = normalizeName(name);
  dbIncUses(guildId, n);
}

export interface TagExportEntry {
  name: string;
  title: string;
  description?: string;
  footer?: string;
  imageUrl?: string;
  aliases: string[];
}

export function exportTags(guildId: string): TagExportEntry[] {
  return getTags(guildId).map(t => ({
    name: t.name,
    title: t.title,
    description: t.content || undefined,
    footer: t.footer,
    imageUrl: t.imageUrl,
    aliases: t.aliases
  }));
}

export function importTags(guildId: string, entries: TagExportEntry[], userId: string): { imported: number; skipped: string[] } {
  const skipped: string[] = [];
  let imported = 0;
  for (const entry of entries) {
    const n = normalizeName(entry.name);
    if (!n) { skipped.push(entry.name); continue; }
    try {
      const existing = getTag(guildId, n);
      if (existing) {
        editTag(guildId, n, {
          name: n,
          title: entry.title,
          content: entry.description ?? '',
          aliases: entry.aliases,
          footer: entry.footer,
          imageUrl: entry.imageUrl,
        }, userId);
      } else {
        createTag(guildId, n, entry.description ?? '', userId, {
          title: entry.title,
          aliases: entry.aliases,
          footer: entry.footer,
          imageUrl: entry.imageUrl,
        });
      }
      imported++;
    } catch {
      skipped.push(entry.name);
    }
  }
  return { imported, skipped };
}
