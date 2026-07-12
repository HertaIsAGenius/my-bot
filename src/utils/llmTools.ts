interface ToolParam {
  type: string;
  description?: string;
  [key: string]: any;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParam>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
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

export async function queryLlmWithTools(
  messages: LlmMessage[],
  tools: ToolDefinition[],
  opts: LlmOptions,
): Promise<{ content?: string; toolCalls?: ToolCall[] }> {
  const baseUrl = opts.baseUrl || DEFAULTS.baseUrl;
  const model = opts.model || DEFAULTS.model;

  const body: any = {
    model,
    messages,
    temperature: opts.temperature ?? DEFAULTS.temperature,
    max_tokens: opts.maxTokens ?? DEFAULTS.maxTokens,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json() as any;
  const choice = data.choices?.[0]?.message;

  if (!choice) return {};

  return {
    content: choice.content?.trim(),
    toolCalls: choice.tool_calls,
  };
}
