import { Message, TextChannel, NewsChannel } from 'discord.js';
import { getSlumberGuardChannel, getSlumberGuardPreset, ensureDefaultPresets } from './db';

class SlumberGuardManager {
  private userActivity = new Map<string, Map<string, number>>();
  private activeSlowmodes = new Map<string, { slowmodeTime: number; timeout: ReturnType<typeof setTimeout> }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [channelId, users] of this.userActivity) {
      for (const [userId, ts] of users) {
        if (now - ts > 60000) users.delete(userId);
      }
      if (users.size === 0) this.userActivity.delete(channelId);
    }
  }

  public async handleMessage(message: Message<true>) {
    if (message.author.bot) return;
    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased() || channel.isThread()) return;

    const sgChannel = getSlumberGuardChannel(channel.id);
    if (!sgChannel || !sgChannel.enabled) return;

    const preset = getSlumberGuardPreset(channel.guildId, sgChannel.preset_name);
    if (!preset) return;

    ensureDefaultPresets(channel.guildId);

    const now = Date.now();
    const windowMs = preset.threshold_time * 1000;
    const lengthMs = preset.slowmode_length * 1000;

    let users = this.userActivity.get(channel.id);
    if (!users) {
      users = new Map();
      this.userActivity.set(channel.id, users);
    }

    users.set(message.author.id, now);

    for (const [userId, ts] of users) {
      if (now - ts > windowMs) users.delete(userId);
    }

    let userCount = 0;
    let msgCount = 0;
    for (const [, ts] of users) {
      userCount++;
      if (now - ts <= windowMs) msgCount++;
    }

    if (userCount >= preset.threshold_users && msgCount >= preset.min_messages && !this.activeSlowmodes.has(channel.id)) {
      await this.activateSlowmode(channel as TextChannel | NewsChannel, channel.id, preset.slowmode_time, lengthMs);
    }
  }

  private async activateSlowmode(channel: TextChannel | NewsChannel, channelId: string, slowmodeTime: number, lengthMs: number) {
    try {
      await channel.setRateLimitPerUser(slowmodeTime, 'Slumber Guard: anti-raid auto-slowmode');
    } catch { return; }

    const timeout = setTimeout(async () => {
      await this.deactivateSlowmode(channel, channelId);
    }, lengthMs);

    this.activeSlowmodes.set(channelId, { slowmodeTime, timeout });
  }

  private async deactivateSlowmode(channel: TextChannel | NewsChannel, channelId: string) {
    this.activeSlowmodes.delete(channelId);
    try {
      await channel.setRateLimitPerUser(0, 'Slumber Guard: traffic normalized');
    } catch {}
  }

  public getStatus(channelId: string) {
    return { active: this.activeSlowmodes.has(channelId) };
  }
}

export const slumberGuard = new SlumberGuardManager();
