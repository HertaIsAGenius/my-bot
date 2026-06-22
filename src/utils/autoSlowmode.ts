import { Message, NewsChannel, TextChannel } from 'discord.js';
import { isSlowmodeEnabled } from './slowmodeConfig';

export class AutoSlowmodeManager {
  private messageTimestamps = new Map<string, number[]>();
  private activeChannels = new Map<string, number>();
  private disabledChannels = new Set<string>();
  private lastChange = new Map<string, number>();
  private readonly threshold = 20;
  private readonly windowMs = 10000;
  private readonly slowmodeSeconds = 10;
  private readonly coolDownMs = 60000;

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupStaleChannels(), 300000);
  }

  private cleanupStaleChannels() {
    const now = Date.now();
    const staleTimeout = 3600000;
    for (const [channelId] of this.messageTimestamps) {
      const lastActive = this.lastChange.get(channelId) ?? 0;
      if (now - lastActive > staleTimeout && !this.activeChannels.has(channelId) && !this.disabledChannels.has(channelId)) {
        this.messageTimestamps.delete(channelId);
        this.lastChange.delete(channelId);
      }
    }
  }

  public async handleMessage(message: Message<true>) {
    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased() || channel.isThread()) return;
    if (this.disabledChannels.has(channel.id)) return;

    const now = Date.now();
    const timestamps = (this.messageTimestamps.get(channel.id) ?? []).filter(
      (timestamp) => timestamp > now - this.windowMs
    );

    timestamps.push(now);
    this.messageTimestamps.set(channel.id, timestamps);

    if (!isSlowmodeEnabled(channel.id)) return;

    if (timestamps.length >= this.threshold && !this.activeChannels.has(channel.id)) {
      await this.setSlowmode(channel as TextChannel | NewsChannel, this.slowmodeSeconds, 'Auto slowmode enabled by activity detector');
      this.activeChannels.set(channel.id, this.slowmodeSeconds);
      this.lastChange.set(channel.id, now);
      return;
    }

    if (this.activeChannels.has(channel.id) && timestamps.length < this.threshold / 2) {
      const lastChange = this.lastChange.get(channel.id) ?? now;
      if (now - lastChange >= this.coolDownMs) {
        await this.setSlowmode(channel as TextChannel | NewsChannel, 0, 'Auto slowmode disabled after traffic normalized');
        this.activeChannels.delete(channel.id);
        this.lastChange.set(channel.id, now);
      }
    }
  }

  public getChannelStatus(channelId: string) {
    return {
      active: this.activeChannels.has(channelId),
      disabled: this.disabledChannels.has(channelId)
    };
  }

  public async disableChannel(channel: TextChannel | NewsChannel) {
    this.disabledChannels.add(channel.id);
    if (this.activeChannels.has(channel.id)) {
      await this.setSlowmode(channel, 0, 'Auto slowmode disabled by command');
      this.activeChannels.delete(channel.id);
      this.lastChange.set(channel.id, Date.now());
    }
  }

  public enableChannel(channelId: string) {
    this.disabledChannels.delete(channelId);
    this.lastChange.set(channelId, Date.now());
  }

  private async setSlowmode(channel: TextChannel | NewsChannel, seconds: number, reason: string) {
    try {
      await channel.setRateLimitPerUser(seconds, reason);
    } catch (error) {
      console.error('Failed to update slowmode:', error);
    }
  }
}

export const autoSlowmode = new AutoSlowmodeManager();
