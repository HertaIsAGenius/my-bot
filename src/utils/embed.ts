import { EmbedBuilder } from 'discord.js';

const ACCENT = 0x2B3A67;

export function embed(title?: string, description?: string) {
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(title ?? null)
    .setDescription(description ?? null);
}

export function embedColored(color: number, title?: string, description?: string) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title ?? null)
    .setDescription(description ?? null);
}

export const COLORS = {
  accent: 0x2B3A67,
  success: 0x3A7D44,
  danger: 0x9B2226,
  warning: 0xCA6702,
  info: 0x005F73,
  neutral: 0x4FC3F7,
} as const;
