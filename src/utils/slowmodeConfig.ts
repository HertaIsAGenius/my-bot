import { enableSlowmodeChannel as dbEnable, disableSlowmodeChannel as dbDisable, isSlowmodeEnabled as dbIsEnabled, getEnabledSlowmodeChannels as dbGetEnabled } from './db';

export function isSlowmodeEnabled(channelId: string) {
  return dbIsEnabled(channelId);
}

export function enableSlowmodeChannel(channelId: string) {
  dbEnable('0', channelId);
}

export function disableSlowmodeChannel(channelId: string) {
  dbDisable('0', channelId);
}

export function getEnabledSlowmodeChannels() {
  return dbGetEnabled();
}
