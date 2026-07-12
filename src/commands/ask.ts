import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';
import { queryLlmWithTools, ToolDefinition } from '../utils/llmTools';
import { getLevelData, progressToNext, getRank, getWeeklyRank } from '../utils/levels';

type ToolResult = { tool: string; output: string };

async function executeTool(toolName: string, args: any, guildId: string, userId: string, guild?: any): Promise<ToolResult> {
  switch (toolName) {
    case 'get_rank': {
      const targetId = args.user_id || userId;
      const data = getLevelData(targetId, guildId);
      if (!data) return { tool: toolName, output: 'That user has no XP data yet.' };
      const rank = getRank(targetId, guildId);
      const weeklyRank = getWeeklyRank(targetId, guildId);
      const prog = progressToNext(data);
      return {
        tool: toolName,
        output: [
          `Level: ${data.level}`,
          `Total XP: ${data.xp}`,
          `Server Rank: #${rank}`,
          `Weekly Rank: #${weeklyRank}`,
          `Weekly XP: ${data.weeklyXp}`,
          `Progress to next level: ${prog.current}/${prog.needed} (${Math.round(prog.percent * 100)}%)`,
        ].join('\n'),
      };
    }

    case 'get_server_info': {
      if (!guild) return { tool: toolName, output: 'No guild context available.' };
      const channels = guild.channels.cache
        .filter((c: any) => c.isTextBased?.())
        .map((c: any) => `<#${c.id}> — ${c.name}`)
        .join('\n');
      const roles = guild.roles.cache
        .filter((r: any) => r.name !== '@everyone')
        .map((r: any) => `<@&${r.id}> — ${r.name}`)
        .join('\n');
      return { tool: toolName, output: `Channels:\n${channels || '(none)'}\n\nRoles:\n${roles || '(none)'}` };
    }

    case 'get_level': {
      const targetId = args.user_id || userId;
      const data = getLevelData(targetId, guildId);
      if (!data) return { tool: toolName, output: 'That user has no XP data yet.' };
      return {
        tool: toolName,
        output: `Level ${data.level} with ${data.xp} total XP. ${args.include_rank ? `Server rank: #${getRank(targetId, guildId)}.` : ''}`,
      };
    }

    default:
      return { tool: toolName, output: `Unknown tool: ${toolName}` };
  }
}

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_rank',
      description: 'Get detailed rank card data (level, XP, rank, weekly stats) for a user. Use this when someone asks about their rank, level, or progress.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'The Discord user ID to look up (omit to use the asking user)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_level',
      description: 'Get a user\'s level and total XP. Simpler than get_rank — use when only level/XP is needed.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'The Discord user ID' },
          include_rank: { type: 'boolean', description: 'Whether to include the server rank' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_server_info',
      description: 'Get all text channels and roles in this server with their real Discord IDs and names.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

async function askCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    await interaction.editReply({ embeds: [embed('Not Configured', 'LLM API key is not set. Ask your bot owner to configure `LLM_API_KEY` in the `.env` file.')] });
    return;
  }

  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  try {
    const systemPrompt = `You are a Discord bot assistant that routes user questions to the right feature.
You have access to tools that can look up data. Use them when the user asks about their rank, level, server info, channels or roles.
Keep responses to 1-3 sentences max. Always use Discord mention syntax (<#id> for channels, <@&id> for roles) when referencing them.
Be friendly and concise. If you don't have a tool for what they're asking, explain what tools are available.

Available features on this bot: rank/levels, tickets, tags, moderation, economy, giveaways, chess, AI chat, server stats, ModMail, trial applications, and more.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    // Round 1: Ask the LLM what tool to call
    const round1 = await queryLlmWithTools(messages, TOOLS, { apiKey, baseUrl, model, temperature: 0.3, maxTokens: 500 });

    if (round1.toolCalls && round1.toolCalls.length > 0) {
      // Execute the tool
      const results: ToolResult[] = [];
      for (const tc of round1.toolCalls) {
        const args = JSON.parse(tc.function.arguments || '{}');
        const result = await executeTool(tc.function.name, args, guildId, userId, interaction.guild);
        results.push(result);
      }

      // Round 2: Send tool results back to LLM for final answer
      const toolMessages: any[] = [...messages, { role: 'assistant', content: null, tool_calls: round1.toolCalls }];
      for (const r of results) {
        const tcMatch = round1.toolCalls.find((tc: { function: { name: string } }) => tc.function.name === r.tool);
        toolMessages.push({ role: 'tool', content: r.output, tool_call_id: tcMatch?.id || '' });
      }

      const round2 = await queryLlmWithTools(toolMessages, [], { apiKey, baseUrl, model, temperature: 0.5, maxTokens: 500 });

      const reply = round2.content || 'I found the information but couldn\'t format a response.';
      await interaction.editReply({ embeds: [embed('Ask', reply)] });
    } else if (round1.content) {
      // LLM answered directly without using tools
      await interaction.editReply({ embeds: [embed('Ask', round1.content)] });
    } else {
      await interaction.editReply({ embeds: [embed('Ask', 'I wasn\'t sure how to process that. Try asking about your rank, level, or server stats.')] });
    }
  } catch (e: any) {
    console.error('[Ask] Error:', e);
    await interaction.editReply({ embeds: [embed('Error', `Failed to process your request: ${e.message}`)] });
  }
}

module.exports = { default: askCommand };
