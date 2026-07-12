import { ChatInputCommandInteraction, MessageFlags, TextChannel } from 'discord.js';
import { embed } from '../utils/embed';
import { getLlmConfig, setLlmConfig } from '../utils/llmConfig';
import { clearChatMemory } from '../utils/db';

function resolveChannel(ch: any): TextChannel | null {
  if (ch instanceof TextChannel) return ch;
  return null;
}

async function llmCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const group = interaction.options.getSubcommandGroup();
  const sub = interaction.options.getSubcommand();

  if (group === 'channel' && sub === 'set') {
    const channel = resolveChannel(interaction.options.getChannel('channel') ?? interaction.channel);
    if (!channel) {
      await interaction.reply({ embeds: [embed('Invalid Channel', 'Select a text channel.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const prompt = interaction.options.getString('prompt');
    const cfg: any = { enabled: true };
    if (prompt) cfg.systemPrompt = prompt;
    setLlmConfig(channel.id, cfg);
    await interaction.reply({ embeds: [embed('LLM Enabled', `AI replies enabled in ${channel}.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (group === 'channel' && sub === 'disable') {
    const channel = resolveChannel(interaction.options.getChannel('channel') ?? interaction.channel);
    if (!channel) return;
    setLlmConfig(channel.id, { enabled: false });
    await interaction.reply({ embeds: [embed('LLM Disabled', `AI replies disabled in <#${channel.id}>.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'config') {
    const channel = resolveChannel(interaction.options.getChannel('channel') ?? interaction.channel);
    if (!channel) return;
    const cfg = getLlmConfig(channel.id);
    await interaction.reply({
      embeds: [embed('LLM Config', [
        `**Channel:** <#${channel.id}>`,
        `**Enabled:** ${cfg.enabled ? 'Yes' : 'No'}`,
        `**Memory:** ${cfg.memoryEnabled ? 'On' : 'Off'}`,
        `**System Prompt:**\n\`\`\`${cfg.systemPrompt}\`\`\``,
      ].join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (sub === 'clear') {
    const channel = resolveChannel(interaction.options.getChannel('channel') ?? interaction.channel);
    if (!channel) return;
    clearChatMemory(interaction.guild.id, channel.id);
    await interaction.reply({ embeds: [embed('Memory Cleared', `Chat memory cleared for <#${channel.id}>.`)], flags: MessageFlags.Ephemeral });
    return;
  }
}

module.exports = { default: llmCommand };
