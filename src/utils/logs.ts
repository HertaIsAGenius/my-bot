import { getLogConfig, setLogConfig, getChannelLogConfig, setChannelLogConfig, logMessage as dbLogMessage, logReaction as dbLogReaction } from './db';

export function isMessageLoggingEnabled(guildId: string, channelId?: string) {
  if (channelId) return getChannelLogConfig(channelId).messages;
  return getLogConfig(guildId).messages;
}

export function isReactionLoggingEnabled(guildId: string, channelId?: string) {
  if (channelId) return getChannelLogConfig(channelId).reactions;
  return getLogConfig(guildId).reactions;
}

export function setMessageLoggingEnabled(guildId: string, enabled: boolean, channelId?: string) {
  if (channelId) {
    setChannelLogConfig(channelId, enabled);
    return;
  }
  setLogConfig(guildId, enabled);
}

export function setReactionLoggingEnabled(guildId: string, enabled: boolean, channelId?: string) {
  if (channelId) {
    setChannelLogConfig(channelId, undefined, enabled);
    return;
  }
  setLogConfig(guildId, undefined, enabled);
}

export function setChannelMessageLogging(channelId: string, enabled: boolean) {
  setChannelLogConfig(channelId, enabled);
}

export function setChannelReactionLogging(channelId: string, enabled: boolean) {
  setChannelLogConfig(channelId, undefined, enabled);
}

export function logMessage(guildId: string, entry: { messageId: string; authorId: string; content: string; channelId: string }) {
  dbLogMessage(guildId, entry);
}

export function logReaction(guildId: string, entry: { messageId: string; authorId: string; emoji: string; channelId: string; added: boolean }) {
  dbLogReaction(guildId, entry);
}
