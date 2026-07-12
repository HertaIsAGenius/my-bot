import { getGuildConfig, setGuildConfig } from './db';

export function getLevelUpChannel(guildId: string): string | null {
  return getGuildConfig(guildId, 'level_up_channel');
}

export function setLevelUpChannel(guildId: string, channelId: string | null) {
  setGuildConfig(guildId, 'level_up_channel', channelId);
}
