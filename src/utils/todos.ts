import { getTodos as dbGetTodos, addTodo as dbAdd, removeTodo as dbRemove, editTodo as dbEdit, clearTodos as dbClear } from './db';

export interface TodoItem {
  id: number;
  text: string;
  authorId: string;
  authorTag: string;
  createdAt: number;
  editedAt?: number;
}

function mapRow(r: any): TodoItem {
  return {
    id: r.id,
    text: r.text,
    authorId: r.author_id,
    authorTag: r.author_tag,
    createdAt: r.created_at,
    editedAt: r.edited_at || undefined,
  };
}

export function addTodo(guildId: string, text: string, authorId: string, authorTag: string) {
  const row = dbAdd(guildId, text, authorId, authorTag);
  return mapRow(row);
}

export function getTodos(guildId: string): TodoItem[] {
  return (dbGetTodos(guildId) as any[]).map(mapRow);
}

export function removeTodo(guildId: string, id: number) {
  const result = dbRemove(guildId, id);
  return result ? mapRow(result) : null;
}

export function editTodo(guildId: string, id: number, newText: string) {
  const result = dbEdit(guildId, id, newText);
  return result ? mapRow(result) : null;
}

export function clearTodos(guildId: string) {
  return (dbClear(guildId) as any[]).map(mapRow);
}
