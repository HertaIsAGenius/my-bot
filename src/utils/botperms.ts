import { getCommandRoles as dbGet, setCommandRoles as dbSet, getAllPerms as dbGetAll } from './db';

export function getCommandRoles(guildId: string, commandName: string): string[] {
  return dbGet(guildId, commandName);
}

export function setCommandRoles(guildId: string, commandName: string, roleIds: string[]) {
  dbSet(guildId, commandName, roleIds);
}

export function getAllPerms(guildId: string): Array<{ command: string; roles: string[] }> {
  return dbGetAll(guildId);
}
