import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataPath } from './dataPath';

const dataDir = dataPath();
const todosPath = join(dataDir, 'todos.json');

export interface TodoItem {
  id: number;
  text: string;
  authorId: string;
  authorTag: string;
  createdAt: number;
  editedAt?: number;
}

let cache: Record<string, TodoItem[]> | null = null;

function ensureDataDir() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
}

function loadAll(): Record<string, TodoItem[]> {
  if (cache) return cache;
  ensureDataDir();
  if (!existsSync(todosPath)) {
    writeFileSync(todosPath, JSON.stringify({}), 'utf-8');
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(todosPath, 'utf-8')) as Record<string, TodoItem[]>;
  } catch {
    writeFileSync(todosPath, JSON.stringify({}), 'utf-8');
    cache = {};
  }
  return cache;
}

function saveAll(data: Record<string, TodoItem[]>) {
  cache = data;
  ensureDataDir();
  writeFileSync(todosPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function addTodo(guildId: string, text: string, authorId: string, authorTag: string) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const id = list.length > 0 ? list[list.length - 1].id + 1 : 1;
  const item: TodoItem = { id, text, authorId, authorTag, createdAt: Date.now() };
  list.push(item);
  data[guildId] = list;
  saveAll(data);
  return item;
}

export function getTodos(guildId: string) {
  return loadAll()[guildId] ?? [];
}

export function removeTodo(guildId: string, id: number) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  data[guildId] = list;
  saveAll(data);
  return removed;
}

export function editTodo(guildId: string, id: number, newText: string) {
  const data = loadAll();
  const list = data[guildId] ?? [];
  const item = list.find((t) => t.id === id);
  if (!item) return null;
  item.text = newText;
  item.editedAt = Date.now();
  saveAll(data);
  return item;
}

export function clearTodos(guildId: string) {
  const data = loadAll();
  const prev = data[guildId] ?? [];
  data[guildId] = [];
  saveAll(data);
  return prev;
}
