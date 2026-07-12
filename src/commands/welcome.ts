import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getWelcomeConfig, setWelcomeConfig, getGoodbyeConfig, setGoodbyeConfig, getAutoRoles, addAutoRole, removeAutoRole } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (sub === 'welcome' || sub === 'goodbye') {
    const isWelcome = sub === 'welcome';
    const fn = isWelcome ? getWelcomeConfig : getGoodbyeConfig;
    const fnSet = isWelcome ? setWelcomeConfig : setGoodbyeConfig;
    const label = isWelcome ? 'Welcome' : 'Goodbye';
    const chOption = interaction.options.getChannel('channel');
    const msgOption = interaction.options.getString('message');
    const toggle = interaction.options.getString('toggle');

    const config = fn(guildId);

    if (chOption) config.channel_id = chOption.id;
    if (msgOption !== null) config.message = msgOption;
    if (toggle) config.enabled = toggle === 'on';

    fnSet(guildId, config);

    const e = embed(`${label} Config`, `Channel: ${config.channel_id ? `<#${config.channel_id}>` : '*not set*'}\nMessage: \`${config.message}\`\nEnabled: ${config.enabled ? 'Yes' : 'No'}`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'test') {
    const isWelcome = interaction.options.getString('type') !== 'goodbye';
    const fn = isWelcome ? getWelcomeConfig : getGoodbyeConfig;
    const label = isWelcome ? 'Welcome' : 'Goodbye';
    const config = fn(guildId);
    if (!config.enabled || !config.channel_id) {
      await interaction.reply({ embeds: [embed(`${label} Not Configured`, `${label} is not configured or disabled.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    const channel = interaction.guild?.channels.cache.get(config.channel_id) as any;
    if (!channel?.isTextBased()) {
      await interaction.reply({ embeds: [embed('Channel Not Found', 'The configured channel could not be found.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const msg = config.message
      .replace(/\{user\}/g, interaction.user.toString())
      .replace(/\{server\}/g, interaction.guild?.name || '');
    const e = embed(label, msg).setColor(COLORS.accent);
    await channel.send({ embeds: [e] });
    await interaction.reply({ embeds: [embed(`${label} Test Sent`, `${label} message sent to <#${config.channel_id}>.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'autorole') {
    const role = interaction.options.getRole('role', true);
    const action = interaction.options.getString('action') || 'add';
    if (action === 'add') {
      addAutoRole(guildId, role.id);
      await interaction.reply({ embeds: [embed('Auto-Role Added', `**${role.name}** added to auto-role list.`).setColor(COLORS.success)], flags: MessageFlags.Ephemeral });
    } else {
      removeAutoRole(guildId, role.id);
      await interaction.reply({ embeds: [embed('Auto-Role Removed', `**${role.name}** removed from auto-role list.`).setColor(COLORS.danger)], flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (sub === 'autorolelist') {
    const roles = getAutoRoles(guildId);
    if (roles.length === 0) {
      await interaction.reply({ embeds: [embed('Auto-Roles', 'No auto-roles configured.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = roles.map(r => `<@&${r}>`).join('\n');
    const e = embed('Auto-Roles', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
