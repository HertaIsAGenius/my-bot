import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ButtonInteraction } from 'discord.js';
import { queryLlm } from '../utils/llm';

const topicStore = new Map<string, { topic: string; content: string }>();

const BLOCKED_WORDS = [
  'mommy', 'daddy', 'sigma', 'ohio', 'gyatt', 'rizz', 'skibidi', 'fanum', 'goon',
  'aura', 'alpha', 'beta', 'cringe', 'pog', 'poggers', 'sus', 'simp', 'based',
  'chad', 'incel', 'npc', 'glaze', 'glazing', 'edging', 'lock in', 'lock-in',
];

const GENERIC_KEYWORDS = [
  'technology', 'nature', 'music', 'books', 'travel', 'food', 'science',
  'history', 'art', 'space', 'ocean', 'animals', 'sports', 'philosophy',
  'education', 'culture', 'architecture', 'psychology', 'astronomy', 'writing',
];

function containsBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some(w => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default async function topicaiCommand(interaction: ChatInputCommandInteraction) {
  const topic = interaction.options.getString('topic', true);
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;

  if (!apiKey) {
    await interaction.reply({ content: 'LLM is not configured. Set `LLM_API_KEY` in `.env`.' });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  await generateAndSend(interaction, apiKey, baseUrl, model, topic, 0);
}

async function generateAndSend(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  apiKey: string,
  baseUrl: string | undefined,
  model: string | undefined,
  topic: string,
  attempt: number,
) {
  if (attempt >= 3) {
    const fallback = 'What is something you have changed your mind about recently?';
    topicStore.set(interaction.user.id, { topic, content: fallback });
    const row = buildRow();
    const payload = { content: fallback, components: [row] };
    if (interaction.isChatInputCommand()) await interaction.editReply(payload);
    else await interaction.update(payload);
    return;
  }

  try {
    const prompt = `Generate a single thought-provoking question based on this description: "${topic}". Use Markdown headings (e.g. "# Question here") if appropriate. Output ONLY the question — no explanations, no extra text, no advice.`;
    const reply = await queryLlm(
      [{ role: 'user', content: prompt }],
      { apiKey, baseUrl, model }
    );

    if (containsBlocked(reply)) {
      const newTopic = pickRandom(GENERIC_KEYWORDS);
      return await generateAndSend(interaction, apiKey, baseUrl, model, newTopic, attempt + 1);
    }

    topicStore.set(interaction.user.id, { topic, content: reply });
    const row = buildRow();
    const payload = { content: reply, components: [row] };
    if (interaction.isChatInputCommand()) await interaction.editReply(payload);
    else await interaction.update(payload);
  } catch (e) {
    const errMsg = { content: 'Failed to generate topic. Try again later.', components: [] };
    if (interaction.isChatInputCommand()) await interaction.editReply(errMsg);
    else await interaction.update(errMsg);
  }
}

function buildRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('topicai_regenerate').setLabel('Regenerate').setEmoji('🔄').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('topicai_send').setLabel('Send to Chat').setEmoji('📤').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('topicai_delete').setLabel('Delete').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
}

export async function handleTopicAiButton(interaction: ButtonInteraction) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;

  if (!apiKey) {
    await interaction.reply({ content: 'LLM is not configured.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (interaction.customId === 'topicai_delete') {
    topicStore.delete(interaction.user.id);
    await interaction.message.delete().catch(() => {});
    return;
  }

  if (interaction.customId === 'topicai_send') {
    const stored = topicStore.get(interaction.user.id);
    if (!stored) {
      await interaction.reply({ content: 'This topic is no longer available. Run `/topic-ai` again.', flags: MessageFlags.Ephemeral });
      return;
    }
    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ content: 'Cannot send to this channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    await (channel as any).send(stored.content);
    topicStore.delete(interaction.user.id);
    await interaction.update({ content: '✅ Topic sent to chat!', components: [] });
    return;
  }

  if (interaction.customId === 'topicai_regenerate') {
    const stored = topicStore.get(interaction.user.id);
    if (!stored) {
      await interaction.reply({ content: 'This topic is no longer available. Run `/topic-ai` again.', flags: MessageFlags.Ephemeral });
      return;
    }
    await generateAndSend(interaction, apiKey, baseUrl, model, stored.topic, 0);
  }
}
