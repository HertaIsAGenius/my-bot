import { getChatMemory } from './db';

interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LlmOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULTS = {
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  temperature: 0.7,
  maxTokens: 500,
};

export async function queryLlm(messages: LlmMessage[], opts: LlmOptions): Promise<string> {
  const baseUrl = opts.baseUrl || DEFAULTS.baseUrl;
  const model = opts.model || DEFAULTS.model;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? DEFAULTS.temperature,
      max_tokens: opts.maxTokens ?? DEFAULTS.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || 'No response.';
}

export function buildContext(
  guildId: string,
  channelId: string,
  userContent: string,
  systemPrompt: string,
  memoryEnabled: boolean,
): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt }];

  if (memoryEnabled) {
    const history = getChatMemory(guildId, channelId, 30);
    for (const msg of history) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
}
