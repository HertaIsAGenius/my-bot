import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const dataDir = dataPath();
const tagsPath = join(dataDir, 'tags.json');

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

let cache: Record<string, StaffTag[]> | null = null;

function ensureDataDir() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function loadAll(): Record<string, StaffTag[]> {
  if (cache) return cache;
  ensureDataDir();
  if (!existsSync(tagsPath)) {
    writeFileSync(tagsPath, JSON.stringify({}), 'utf-8');
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(tagsPath, 'utf-8')) as Record<string, StaffTag[]>;
  } catch {
    writeFileSync(tagsPath, JSON.stringify({}), 'utf-8');
    cache = {};
  }
  return cache;
}

function saveAll(data: Record<string, StaffTag[]>) {
  cache = data;
  ensureDataDir();
  writeFileSync(tagsPath, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
}

export function createTag(guildId: string, name: string, content: string, authorId: string, opts?: { aliases?: string[]; title?: string; footer?: string; imageUrl?: string }) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const n = normalizeName(name);
  if (!n) throw new Error('Tag name cannot be empty after normalization.');
  if (list.some((t) => t.name === n)) throw new Error(`Tag "${n}" already exists.`);
  const id = list.length > 0 ? list[list.length - 1].id + 1 : 1;
  const cleanAliases = (opts?.aliases ?? []).map(normalizeName).filter(Boolean);
  const tag: StaffTag = {
    id, guildId, name: n, aliases: cleanAliases, title: opts?.title ?? '', content,
    footer: opts?.footer, imageUrl: opts?.imageUrl, createdBy: authorId,
    uses: 0, createdAt: Date.now()
  };
  list.push(tag);
  data[guildId] = list;
  saveAll(data);
  return tag;
}

export function getTags(guildId: string) {
  return loadAll()[guildId] ?? [];
}

export function getTag(guildId: string, name: string): StaffTag | null {
  const n = normalizeName(name);
  return getTags(guildId).find(t => t.name === n) ?? null;
}

export function findTag(guildId: string, nameOrAlias: string) {
  const n = normalizeName(nameOrAlias);
  const tags = getTags(guildId);
  return tags.find((t) => t.name === n || t.aliases.includes(n)) ?? null;
}

export function editTag(guildId: string, currentName: string, updates: { name?: string; content?: string; aliases?: string[]; title?: string; footer?: string; imageUrl?: string }, editorId: string) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const idx = list.findIndex((t) => t.name === normalizeName(currentName));
  if (idx === -1) return null;
  const tag = list[idx];
  if (updates.name !== undefined) {
    const newName = normalizeName(updates.name);
    if (newName && newName !== tag.name && list.some((t, i) => i !== idx && t.name === newName)) {
      throw new Error(`Tag "${newName}" already exists.`);
    }
    if (newName) tag.name = newName;
  }
  if (updates.content !== undefined) tag.content = updates.content;
  if (updates.aliases !== undefined) tag.aliases = updates.aliases.map(normalizeName).filter(Boolean);
  if (updates.title !== undefined) tag.title = updates.title;
  if (updates.footer !== undefined) tag.footer = updates.footer || undefined;
  if (updates.imageUrl !== undefined) tag.imageUrl = updates.imageUrl || undefined;
  tag.updatedBy = editorId;
  tag.updatedAt = Date.now();
  data[guildId] = list;
  saveAll(data);
  return tag;
}

export function deleteTag(guildId: string, name: string) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const n = normalizeName(name);
  const idx = list.findIndex((t) => t.name === n);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  data[guildId] = list;
  saveAll(data);
  return removed;
}

export function incrementTagUses(guildId: string, name: string) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const tag = list.find((t) => t.name === normalizeName(name));
  if (!tag) return;
  tag.uses++;
  saveAll(data);
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
  const data = loadAll();
  const list = data[guildId] ?? [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const n = normalizeName(entry.name);
    if (!n) { skipped.push(entry.name); continue; }
    const existing = list.findIndex(t => t.name === n);
    const id = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;

    const cleanAliases = (entry.aliases ?? []).map(normalizeName).filter(Boolean);
    const tag: StaffTag = {
      id, guildId, name: n, aliases: cleanAliases, title: entry.title,
      content: entry.description ?? '',
      footer: entry.footer, imageUrl: entry.imageUrl,
      createdBy: userId, uses: 0, createdAt: Date.now()
    };

    if (existing >= 0) {
      list[existing] = { ...list[existing], ...tag, id: list[existing].id, uses: list[existing].uses, createdAt: list[existing].createdAt, updatedBy: userId, updatedAt: Date.now() };
    } else {
      list.push(tag);
    }
  }

  data[guildId] = list;
  saveAll(data);
  return { imported: entries.length - skipped.length, skipped };
}
