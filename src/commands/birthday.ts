import { ChatInputCommandInteraction, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { getBirthday, setBirthday, removeBirthday, getGuildBirthdays } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (sub === 'set') {
    const date = interaction.options.getString('date', true);
    const timezone = interaction.options.getString('timezone') || 'UTC';

    const parts = date.split('/');
    if (parts.length !== 2) {
      await interaction.reply({ embeds: [embed('Invalid Format', 'Use format MM/DD (e.g., 12/25).')], flags: MessageFlags.Ephemeral });
      return;
    }
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      await interaction.reply({ embeds: [embed('Invalid Date', 'The date you provided is not valid.')], flags: MessageFlags.Ephemeral });
      return;
    }

    setBirthday(guildId, interaction.user.id, month, day, timezone);
    const e = embed('Birthday Set', `Your birthday is set to **${month}/${day}** (${timezone}).`).setColor(COLORS.success);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    removeBirthday(guildId, interaction.user.id);
    await interaction.reply({ embeds: [embed('Birthday Removed', 'Your birthday has been removed.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'list') {
    const birthdays = getGuildBirthdays(guildId);
    if (birthdays.length === 0) {
      await interaction.reply({ embeds: [embed('Birthdays', 'No birthdays set.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const sorted = birthdays.sort((a: any, b: any) => a.month - b.month || a.day - b.day);
    const desc = sorted.map((b: any) => `<@${b.user_id}> — **${b.month}/${b.day}**${b.year ? ` (${b.year})` : ''}`).join('\n');
    const e = embed('Birthdays', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
