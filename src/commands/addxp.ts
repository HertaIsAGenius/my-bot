import { ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { addXpDirect } from '../utils/levels';

async function addxpCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
    await interaction.reply({ content: 'You need **Manage Server** permission to add XP.', flags: MessageFlags.Ephemeral });
    return;
  }

  const target = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  if (amount < 1) {
    await interaction.reply({ content: 'Amount must be at least 1.', flags: MessageFlags.Ephemeral });
    return;
  }

  const result = addXpDirect(target.id, interaction.guild.id, amount);

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x2B3A67)
      .setTitle('XP Added')
      .setDescription(`Added **${amount}** XP to ${target}.\nThey now have **${result.xp}** XP (level **${result.newLevel}**).`)
      .setFooter(result.leveledUp ? { text: `${target.username} leveled up to ${result.newLevel}!` } : null)
    ]
  });
}

module.exports = { default: addxpCommand };
