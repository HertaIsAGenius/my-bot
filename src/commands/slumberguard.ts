import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, PermissionFlagsBits, TextChannel } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getSlumberGuardChannel, getSlumberGuardGuildChannels, getSlumberGuardPresets, getSlumberGuardPreset, setSlumberGuardPreset, setSlumberGuardChannel, deleteSlumberGuardPreset, ensureDefaultPresets } from '../utils/db';
import { slumberGuard } from '../utils/slumberguard';

export default async function handler(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission to use this command.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guild.id;

  if (sub === 'help') {
    const presets = getSlumberGuardPresets(guildId);
    if (presets.length === 0) ensureDefaultPresets(guildId);
    const all = presets.length > 0 ? presets : getSlumberGuardPresets(guildId);
    const e = new EmbedBuilder()
      .setColor(0x2B3A67)
      .setTitle('Slumber Guard — Presets')
      .setDescription('Automatic slowmode presets. Use `/slumberguard set <preset>` on a channel.')
      .addFields(all.map(p => ({
        name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
        value: `Users: **${p.threshold_users}** in **${p.threshold_time}s** → Slowmode **${p.slowmode_time}s** for **${p.slowmode_length}s** (min **${p.min_messages}** msgs)`,
        inline: false,
      })));
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });

  } else if (sub === 'set') {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const preset = interaction.options.getString('preset', true);
    const enabled = interaction.options.getString('toggle') ?? 'on';

    if (channel.type !== 0 && channel.type !== 5 && channel.type !== 11) {
      await interaction.reply({ embeds: [embed('Invalid Channel', 'Please select a text or announcement channel.')], flags: MessageFlags.Ephemeral });
      return;
    }

    ensureDefaultPresets(guildId);

    const exists = getSlumberGuardPreset(guildId, preset);
    if (!exists) {
      const names = getSlumberGuardPresets(guildId).map(p => p.name).join(', ');
      await interaction.reply({ embeds: [embed('Unknown Preset', `Unknown preset "${preset}". Available: ${names}`)], flags: MessageFlags.Ephemeral });
      return;
    }

    const isEnabled = enabled === 'on';
    setSlumberGuardChannel(channel.id, guildId, preset, isEnabled);

    if (!isEnabled) {
      slumberGuard.getStatus(channel.id);
      await interaction.reply({ embeds: [embed('Slumber Guard Disabled', `Slumber Guard disabled for <#${channel.id}>.`)], flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ embeds: [embed('Slumber Guard Enabled', `Slumber Guard enabled for <#${channel.id}> with preset **${preset}**.`)], flags: MessageFlags.Ephemeral });
    }

  } else if (sub === 'list') {
    const channels = getSlumberGuardGuildChannels(guildId);
    if (channels.length === 0) {
      await interaction.reply({ embeds: [embed('No Channels', 'No channels configured. Use `/slumberguard set` to configure one.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = channels.map(c => {
      const status = c.enabled ? '✅' : '❌';
      return `${status} <#${c.channel_id}> — **${c.preset_name}**${c.enabled ? '' : ' (disabled)'}`;
    });
    const e = new EmbedBuilder()
      .setColor(0x2B3A67)
      .setTitle('Slumber Guard — Configured Channels')
      .setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });

  } else if (sub === 'preset') {
    const action = interaction.options.getString('action', true);
    const name = interaction.options.getString('name', true);

    ensureDefaultPresets(guildId);

    if (action === 'view') {
      const preset = getSlumberGuardPreset(guildId, name);
      if (!preset) {
        await interaction.reply({ embeds: [embed('Not Found', `Preset "${name}" not found.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      const e = new EmbedBuilder()
        .setColor(0x2B3A67)
        .setTitle(`Preset: ${name.charAt(0).toUpperCase() + name.slice(1)}`)
        .addFields(
          { name: 'Threshold Users', value: String(preset.threshold_users), inline: true },
          { name: 'Threshold Time', value: `${preset.threshold_time}s`, inline: true },
          { name: 'Slowmode Time', value: `${preset.slowmode_time}s`, inline: true },
          { name: 'Slowmode Length', value: `${preset.slowmode_length}s`, inline: true },
          { name: 'Min Messages', value: String(preset.min_messages), inline: true },
        );
      await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });

    } else if (action === 'custom') {
      const thresholdUsers = interaction.options.getInteger('threshold_users') ?? undefined;
      const thresholdTime = interaction.options.getInteger('threshold_time') ?? undefined;
      const slowmodeTime = interaction.options.getInteger('slowmode_time') ?? undefined;
      const slowmodeLength = interaction.options.getInteger('slowmode_length') ?? undefined;
      const minMessages = interaction.options.getInteger('min_messages') ?? undefined;

      setSlumberGuardPreset(guildId, name, {
        threshold_users: thresholdUsers,
        threshold_time: thresholdTime,
        slowmode_time: slowmodeTime,
        slowmode_length: slowmodeLength,
        min_messages: minMessages,
      });
      await interaction.reply({ embeds: [embed('Preset Saved', `Custom preset **${name}** saved.`)], flags: MessageFlags.Ephemeral });

    } else if (action === 'delete') {
      const deleted = deleteSlumberGuardPreset(guildId, name);
      if (!deleted) {
        await interaction.reply({ embeds: [embed('Not Found', `Preset "${name}" not found.`)], flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [embed('Preset Deleted', `Preset **${name}** deleted.`)], flags: MessageFlags.Ephemeral });
    }

  } else if (sub === 'reset') {
    await interaction.reply({
      embeds: [embed('Reset Presets', 'This will reset all Slumber Guard presets to defaults. Use `/slumberguard preset delete` to remove individual presets.')],
      flags: MessageFlags.Ephemeral,
    });
  }
}
