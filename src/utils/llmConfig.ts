import { getGuildConfig, setGuildConfig } from './db';

export interface LlmChannelConfig {
  enabled: boolean;
  systemPrompt: string;
  memoryEnabled: boolean;
}

const DEFAULT_PROMPT = 'You are a helpful assistant on a Discord server. Be friendly, concise, and keep responses under 200 words.';

function key(channelId: string): string {
  return `llm_config_${channelId}`;
}

export function getLlmConfig(channelId: string): LlmChannelConfig {
  const raw = getGuildConfig('0', key(channelId));
  if (!raw) {
    return { enabled: false, systemPrompt: DEFAULT_PROMPT, memoryEnabled: true };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { enabled: false, systemPrompt: DEFAULT_PROMPT, memoryEnabled: true };
  }
}

export function setLlmConfig(channelId: string, config: Partial<LlmChannelConfig>) {
  const current = getLlmConfig(channelId);
  const merged = { ...current, ...config };
  setGuildConfig('0', key(channelId), JSON.stringify(merged));
}
