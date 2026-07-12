import { isStickerDetectionEnabled as dbIsEnabled, setStickerDetectionEnabled as dbSetEnabled } from './db';

export function isStickerDetectionEnabled(guildId: string) {
  return dbIsEnabled(guildId);
}

export function setStickerDetectionEnabled(guildId: string, enabled: boolean) {
  dbSetEnabled(guildId, enabled);
}
