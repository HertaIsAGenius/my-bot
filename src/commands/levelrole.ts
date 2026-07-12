import { ChatInputCommandInteraction, PermissionsBitField, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getLevelRole, setLevelRole, removeLevelRole, listLevelRoles } from '../utils/levelRoles';

async function levelroleCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [embed('Guild Only', 'This command must be used in a server.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ embeds: [embed('Permission Denied', 'You need Manage Server permission.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === 'add') {
    const level = interaction.options.getInteger('level', true);
    const role = interaction.options.getRole('role', true);

    if (level < 1) {
      await interaction.reply({ embeds: [embed('Invalid Level', 'Level must be 1 or higher.')], flags: MessageFlags.Ephemeral });
      return;
    }

    setLevelRole(guildId, level, role.id);
    await interaction.reply({
      embeds: [embed('Level Role Set', `Members who reach **level ${level}** will be automatically assigned ${role}.`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (sub === 'remove') {
    const level = interaction.options.getInteger('level', true);
    const removed = removeLevelRole(guildId, level);
    if (!removed) {
      await interaction.reply({ embeds: [embed('Not Found', `No role is configured for level ${level}.`)], flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      embeds: [embed('Level Role Removed', `The role reward for **level ${level}** has been removed.`)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (sub === 'list') {
    const entries = listLevelRoles(guildId);
    if (entries.length === 0) {
      await interaction.reply({
        embeds: [embed('Level Roles', 'No level roles configured. Use `/levelrole add <level> <role>` to set one.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const desc = entries.map(e => `**Level ${e.level}** → <@&${e.roleId}>`).join('\n');
    await interaction.reply({
      embeds: [embed('Level Roles', desc)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }
}

module.exports = { default: levelroleCommand };
