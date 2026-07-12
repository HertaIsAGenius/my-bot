import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { COLORS } from './embed';
import { getModMailChannel } from './db';
import { queryLlm } from './llm';

export const relayByUser = new Map<string, { threadId: string; guildId: string }>();
export const relayByThread = new Map<string, string>();
const relayContext = new Map<string, Array<{ role: 'user' | 'staff'; content: string }>>();

const pendingConfirms = new Map<string, { guildId: string }>();
const pendingGuildSelect = new Set<string>();

function makeContainer(title: string, body: string, accent?: number) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .setAccentColor(accent ?? COLORS.accent);
}

export async function handleModMailDm(message: any): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  if (!message.content) return false;

  if (relayByUser.has(message.author.id)) {
    const { threadId } = relayByUser.get(message.author.id)!;
    try {
      const thread = await message.client.channels.fetch(threadId);
      if (thread?.isTextBased()) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${message.author.username}'s Message**`))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(message.content))
          .setAccentColor(COLORS.accent);
        await thread.send({ components: [container], flags: MessageFlags.IsComponentsV2 });

        const ctx = relayContext.get(message.author.id);
        if (ctx) ctx.push({ role: 'user', content: message.content });

        return true;
      }
    } catch {
      relayByUser.delete(message.author.id);
    }
  }

  if (pendingConfirms.has(message.author.id) || pendingGuildSelect.has(message.author.id)) return true;

  const guilds = message.client.guilds.cache.filter((g: any) => getModMailChannel(g.id));

  if (guilds.size === 0) {
    const c = makeContainer('Not Available', 'ModMail is not configured on any server this bot is in.');
    await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return true;
  }

  if (guilds.size === 1) {
    const guild = guilds.first()!;
    pendingConfirms.set(message.author.id, { guildId: guild.id });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('modmail_confirm').setLabel('Start Conversation').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('modmail_deny').setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );

    const c = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **ModMail - ${guild.name}**`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Press **Start Conversation** to open a direct line to the staff team, or **Cancel** to close this.'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addActionRowComponents(row)
      .setAccentColor(COLORS.accent);

    await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return true;
  }

  pendingGuildSelect.add(message.author.id);

  const options = guilds.map((g: any) =>
    new StringSelectMenuOptionBuilder().setLabel(g.name).setValue(g.id)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('modmail_guild_sel')
    .setPlaceholder('Select a server...')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const c = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Select a Server**'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Which server would you like to contact?'))
    .addActionRowComponents(row)
    .setAccentColor(COLORS.accent);

  await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
  return true;
}

export async function handleModMailGuildSelect(interaction: any) {
  const guildId = interaction.values[0];
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) {
    const c = makeContainer('Not Found', 'Could not find that server.');
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  pendingGuildSelect.delete(interaction.user.id);
  pendingConfirms.set(interaction.user.id, { guildId });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('modmail_confirm').setLabel('Start Conversation').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('modmail_deny').setLabel('Cancel').setStyle(ButtonStyle.Danger),
  );

  const c = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **ModMail - ${guild.name}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Press **Start Conversation** to open a direct line to the staff team, or **Cancel** to close this.'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addActionRowComponents(row)
    .setAccentColor(COLORS.accent);

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
}

export async function handleModMailConfirm(interaction: any) {
  const pending = pendingConfirms.get(interaction.user.id);
  if (!pending) {
    const c = makeContainer('Not Found', 'No pending ModMail session found. Send me a new message to start one.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  pendingConfirms.delete(interaction.user.id);

  const channelId = getModMailChannel(pending.guildId);
  if (!channelId) {
    const c = makeContainer('Not Configured', 'ModMail channel is no longer configured for that server.');
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const guild = interaction.client.guilds.cache.get(pending.guildId);
  if (!guild) {
    const c = makeContainer('Not Found', 'Could not find the server.');
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  await interaction.deferUpdate();

  try {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      const c = makeContainer('Invalid Channel', 'ModMail channel is invalid.');
      await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
      return;
    }

    const threadName = `modmail-${interaction.user.username}`;
    const thread = await (channel as any).threads.create({
      name: threadName,
      reason: `ModMail conversation with ${interaction.user.tag}`,
    });

    relayByUser.set(interaction.user.id, { threadId: thread.id, guildId: pending.guildId });
    relayByThread.set(thread.id, interaction.user.id);
    relayContext.set(interaction.user.id, []);

    const c = makeContainer('Conversation Started', 'Your conversation with the staff team has been opened. Send a message in this DM to begin.');
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });

    const closeBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('modmail_close_thread').setLabel('Close Thread').setStyle(ButtonStyle.Danger),
    );

    const staffContainer = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **ModMail - ${interaction.user.username}**`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('A ModMail conversation has been started.\n\n• `!r <message>` — Reply to the user\n• `!r AI <prompt>` — Use AI tech support to reply\n• `!r suggest` — Get an AI-suggested reply with confirm/regenerate buttons\n• `!r summary` — Summarize the conversation so far\n• `!r end` — Close and archive the thread\n\nAI will be able to assist you in this conversation, please press the button below if you prefer to complete the questions by yourself!'))
      .addActionRowComponents(closeBtn)
      .setAccentColor(COLORS.accent);

    await thread.send({ components: [staffContainer], flags: MessageFlags.IsComponentsV2 });
  } catch (e: any) {
    const c = makeContainer('Failed', `Failed to start conversation: ${e.message}`);
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
  }
}

export async function handleModMailDeny(interaction: any) {
  pendingConfirms.delete(interaction.user.id);
  const c = makeContainer('Cancelled', 'ModMail request cancelled. Send a new message if you need assistance in the future.');
  await interaction.deferUpdate();
  await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
}

async function closeModMailThread(thread: any, userId: string, client: any) {
  relayByUser.delete(userId);
  relayByThread.delete(thread.id);
  relayContext.delete(userId);

  const c = makeContainer('Conversation Closed', 'This conversation has been closed.');

  await thread.send({ components: [c], flags: MessageFlags.IsComponentsV2 });

  try {
    const user = await client.users.fetch(userId);
    await user.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
  } catch {}

  await thread.setLocked(true, 'ModMail thread closed').catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

export async function handleModMailThread(message: any): Promise<boolean> {
  if (message.author.bot || !message.guild) return false;

  const content = message.content?.trim();
  if (!content?.startsWith('!r ')) return false;

  const userId = relayByThread.get(message.channel.id);
  if (!userId) return false;

  const command = content.slice('!r '.length).trim();

  if (command === 'end') {
    await message.delete().catch(() => {});
    await closeModMailThread(message.channel, userId, message.client);
    return true;
  }

  if (command === 'summary') {
    await message.delete().catch(() => {});
    const ctx = relayContext.get(userId) || [];
    if (ctx.length === 0) {
      const c = makeContainer('Summary', 'No conversation history to summarize.');
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
      return true;
    }

    try {
      const apiKey = process.env.LLM_API_KEY;
      if (!apiKey) {
        const c = makeContainer('Not Configured', 'LLM API key is not configured. Set `LLM_API_KEY` in the .env file.');
        await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return true;
      }

      const baseUrl = process.env.LLM_BASE_URL;
      const model = process.env.LLM_MODEL;
      const conversationText = ctx.map(m =>
        m.role === 'user' ? `User: ${m.content}` : `Staff: ${m.content}`
      ).join('\n');

      const summary = await queryLlm(
        [{ role: 'system', content: 'Summarize this ModMail conversation in 2-3 sentences. Focus on the user\'s issue and what has been done so far. Be concise.' },
         { role: 'user', content: conversationText }],
        { apiKey, baseUrl, model, temperature: 0.3, maxTokens: 200 }
      );

      const c = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Conversation Summary**'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
        .setAccentColor(COLORS.accent);

      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
    } catch (e: any) {
      const c = makeContainer('Summary Error', `Failed to generate summary: ${e.message}`);
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
    return true;
  }

  if (command === 'suggest') {
    await message.delete().catch(() => {});
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      const c = makeContainer('Not Configured', 'LLM API key is not configured.');
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
      return true;
    }

    const baseUrl = process.env.LLM_BASE_URL;
    const model = process.env.LLM_MODEL;
    const ctx = relayContext.get(userId) || [];
    const conversationText = ctx.map(m =>
      m.role === 'user' ? `User: ${m.content}` : `Staff: ${m.content}`
    ).join('\n');

    try {
      const suggestion = await queryLlm(
        [{ role: 'system', content: 'You are a ModMail support assistant. Based on the conversation, write a concise 1-2 sentence reply from staff to the user. Write directly as if you are the staff member. Do not add prefixes like "Staff:" or "Reply:".' },
         { role: 'user', content: conversationText || '(No prior conversation — this is a new inquiry.)' }],
        { apiKey, baseUrl, model, temperature: 0.5, maxTokens: 200 }
      );

      pendingSuggestions.set(message.author.id, { threadId: message.channel.id, userId, suggestion });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('modmail_suggest_confirm').setLabel('Send as Reply').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('modmail_suggest_regenerate').setLabel('Regenerate').setStyle(ButtonStyle.Secondary),
      );

      const c = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**AI Suggested Reply**\n${suggestion}`))
        .addActionRowComponents(row)
        .setAccentColor(COLORS.accent);

      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
    } catch (e: any) {
      const c = makeContainer('Suggest Error', `Failed to generate suggestion: ${e.message}`);
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
    return true;
  }

  if (command.startsWith('AI ')) {
    const prompt = command.slice('AI '.length).trim();
    if (!prompt) {
      const c = makeContainer('Usage', 'Usage: `!r AI <prompt>` — e.g. `!r AI tell them about our refund policy`');
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
      await message.delete().catch(() => {});
      return true;
    }

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    const model = process.env.LLM_MODEL;

    if (!apiKey) {
      const c = makeContainer('Not Configured', 'LLM API key is not configured. Set `LLM_API_KEY` in the .env file.');
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
      await message.delete().catch(() => {});
      return true;
    }

    const ctx = relayContext.get(userId) || [];
    const conversationText = ctx.map(m =>
      m.role === 'user' ? `User: ${m.content}` : `Staff: ${m.content}`
    ).join('\n');

    const guild = message.channel.guild;
    let serverContext = '';
    if (guild) {
      const channelsList = guild.channels.cache
        .filter((c: any) => c.isTextBased?.())
        .map((c: any) => `<#${c.id}> — ${c.name}`)
        .join('\n');
      const rolesList = guild.roles.cache
        .filter((r: any) => r.name !== '@everyone')
        .map((r: any) => `<@&${r.id}> — ${r.name}`)
        .join('\n');
      const emojisList = guild.emojis.cache
        .map((e: any) => e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`)
        .join(' ');
      serverContext = `\n\nThis server's channels, roles, and emojis — only use IDs listed here:\n\nChannels:\n${channelsList || '(none)'}\n\nRoles:\n${rolesList || '(none)'}\n\nEmojis:\n${emojisList || '(none)'}`;
    }

    const systemPrompt = `You are Modmail, the support assistant for this Discord server. You help staff and members resolve tickets quickly and clearly.${serverContext}

Guidelines:
- Keep every response to 1-3 sentences. Never write more, even if the question seems complex — ask a follow-up instead.
- Use Discord mention syntax exactly: <#channelId> for channels, <@&roleId> for roles. Only use IDs that appear in the server context above — never invent or guess one.
- Use Discord emoji syntax exactly: <:name:id> or <a:name:id> for animated. Only use emojis listed in the server context above.
- When you make lists, use <:ArrowPNG:1522912441573572730> instead of dashes.
- Be direct and friendly, not robotic. Skip greetings like "Hello!" and get straight to the answer.
- If you don't have enough context to answer accurately, say so plainly and suggest who or where to ask, rather than guessing.`;

    const fullPrompt = `${systemPrompt}\n\nConversation history:\n${conversationText || '(No prior conversation.)'}\n\nStaff direction: ${prompt}\n\nWrite your response to the user:`;

    try {
      const reply = await queryLlm(
        [{ role: 'user', content: fullPrompt }],
        { apiKey, baseUrl, model }
      );

      const user = await message.client.users.fetch(userId);
      const toUser = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Staff Reply (AI)**'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(reply))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('*(Reply in this DM to continue the conversation.)*'))
        .setAccentColor(COLORS.accent);

      await user.send({ components: [toUser], flags: MessageFlags.IsComponentsV2 });

      const ctxLog = relayContext.get(userId);
      if (ctxLog) ctxLog.push({ role: 'staff', content: reply });

      const threadLog = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **AI Reply Sent**'))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(reply))
        .setAccentColor(COLORS.accent);

      await message.channel.send({ components: [threadLog], flags: MessageFlags.IsComponentsV2 });
    } catch (e: any) {
      const c = makeContainer('AI Error', `Failed to generate AI response: ${e.message}`);
      await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }

    await message.delete().catch(() => {});
    return true;
  }

  if (!command) return true;

  try {
    const user = await message.client.users.fetch(userId);
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Staff Reply**'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(command))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('*(Reply in this DM to continue the conversation.)*'))
      .setAccentColor(COLORS.accent);

    await user.send({ components: [container], flags: MessageFlags.IsComponentsV2 });

    const ctx = relayContext.get(userId);
    if (ctx) ctx.push({ role: 'staff', content: command });

    await message.delete().catch(() => {});
  } catch {
    const c = makeContainer('Error', 'Could not send message to the user.');
    await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
  }

  return true;
}

export async function handleModMailCloseThread(interaction: any) {
  await interaction.deferUpdate();

  try {
    const thread = interaction.channel;
    if (thread?.isThread()) {
      const userId = relayByThread.get(thread.id);
      if (userId) {
        await closeModMailThread(thread, userId, interaction.client);
      } else {
        const c = makeContainer('Conversation Closed', 'This conversation has been closed.');
        await thread.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        await thread.setLocked(true, 'ModMail thread closed').catch(() => {});
        await thread.setArchived(true).catch(() => {});
      }
    }
  } catch {}
}

const pendingSuggestions = new Map<string, { threadId: string; userId: string; suggestion: string }>();

export async function handleModMailSuggestConfirm(interaction: any) {
  const pending = pendingSuggestions.get(interaction.user.id);
  if (!pending) {
    await interaction.reply({ content: 'No pending suggestion found. Run `!r suggest` first.', flags: MessageFlags.Ephemeral });
    return;
  }

  pendingSuggestions.delete(interaction.user.id);

  try {
    const user = await interaction.client.users.fetch(pending.userId);
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Staff Reply**'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(pending.suggestion))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('*(Reply in this DM to continue the conversation.)*'))
      .setAccentColor(COLORS.accent);

    await user.send({ components: [container], flags: MessageFlags.IsComponentsV2 });

    const ctx = relayContext.get(pending.userId);
    if (ctx) ctx.push({ role: 'staff', content: pending.suggestion });

    await interaction.update({ components: [], content: '✅ **Suggestion sent as reply.**' });
  } catch {
    await interaction.reply({ content: '❌ Could not send message to the user.', flags: MessageFlags.Ephemeral });
  }
}

export async function handleModMailSuggestRegenerate(interaction: any) {
  const pending = pendingSuggestions.get(interaction.user.id);
  if (!pending) {
    await interaction.reply({ content: 'No pending suggestion found. Run `!r suggest` first.', flags: MessageFlags.Ephemeral });
    return;
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    await interaction.reply({ content: 'LLM API key is not configured.', flags: MessageFlags.Ephemeral });
    return;
  }

  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const ctx = relayContext.get(pending.userId) || [];
  const conversationText = ctx.map(m =>
    m.role === 'user' ? `User: ${m.content}` : `Staff: ${m.content}`
  ).join('\n');

  try {
    const suggestion = await queryLlm(
      [{ role: 'system', content: 'You are a ModMail support assistant. Based on the conversation, write a concise 1-2 sentence reply from staff to the user. Take a different approach than the previous suggestion. Write directly as if you are the staff member.' },
       { role: 'user', content: conversationText || '(No prior conversation — this is a new inquiry.)' }],
      { apiKey, baseUrl, model, temperature: 0.7, maxTokens: 200 }
    );

    pending.suggestion = suggestion;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('modmail_suggest_confirm').setLabel('Send as Reply').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('modmail_suggest_regenerate').setLabel('Regenerate').setStyle(ButtonStyle.Secondary),
    );

    const c = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**AI Suggested Reply**\n${suggestion}`))
      .addActionRowComponents(row)
      .setAccentColor(COLORS.accent);

    await interaction.update({ components: [c] });
  } catch (e: any) {
    await interaction.reply({ content: `❌ Failed to regenerate: ${e.message}`, flags: MessageFlags.Ephemeral });
  }
}
