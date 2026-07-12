import { getLevelRole as dbGet, setLevelRole as dbSet, removeLevelRole as dbRemove, listLevelRoles as dbList } from './db';

export function getLevelRole(guildId: string, level: number): string | null {
  return dbGet(guildId, level);
}

export function setLevelRole(guildId: string, level: number, roleId: string) {
  dbSet(guildId, level, roleId);
}

export function removeLevelRole(guildId: string, level: number): boolean {
  return dbRemove(guildId, level);
}

export function listLevelRoles(guildId: string): { level: number; roleId: string }[] {
  return dbList(guildId);
}
