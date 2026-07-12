import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { embed, COLORS } from '../utils/embed';
import { createGiveaway, endGiveaway, deleteGiveaway, getGiveaway, getGuildGiveaways } from '../utils/db';

export default async function (interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId!;

  if (sub === 'create') {
    const prize = interaction.options.getString('prize', true);
    const duration = interaction.options.getInteger('duration', true);
    const winners = interaction.options.getInteger('winners') || 1;
    const channel = interaction.options.getChannel('channel', true) || interaction.channel;
    const description = interaction.options.getString('description') || undefined;

    const endTime = Date.now() + duration * 1000;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const e = embed('🎉 Giveaway', `${description || ''}`)
      .setColor(COLORS.info)
      .addFields(
        { name: 'Prize', value: prize, inline: true },
        { name: 'Winners', value: winners.toString(), inline: true },
        { name: 'Ends', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
        { name: 'Hosted by', value: interaction.user.toString(), inline: true },
      )
      .setFooter({ text: 'React with 🎉 to enter' });

    const msg = await (channel as any).send({ embeds: [e] });
    await msg.react('🎉');

    createGiveaway(guildId, msg.id, channel.id, prize, winners, endTime, interaction.user.id, description);

    const confirm = embed('Giveaway Created', `Giveaway for **${prize}** created in <#${channel.id}>.`).setColor(COLORS.success);
    await interaction.editReply({ embeds: [confirm] });
    return;
  }

  if (sub === 'end') {
    const messageId = interaction.options.getString('message_id', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const giveaway = getGiveaway(messageId);
    if (!giveaway) {
      await interaction.editReply({ embeds: [embed('Not Found', 'Giveaway not found.')] });
      return;
    }

    let channel: any;
    try {
      channel = await interaction.guild?.channels.fetch(giveaway.channel_id);
    } catch {}

    if (!channel) {
      await interaction.editReply({ embeds: [embed('Error', 'Giveaway channel not found.')] });
      return;
    }

    let msg: any;
    try {
      msg = await channel.messages.fetch(messageId);
    } catch {}

    if (!msg) {
      await interaction.editReply({ embeds: [embed('Error', 'Giveaway message not found.')] });
      return;
    }

    const reaction = msg.reactions.cache.get('🎉');
    let entries: string[] = [];
    if (reaction) {
      const users = await reaction.users.fetch();
      entries = users.filter((u: any) => !u.bot).map((u: any) => u.id);
    }

    const winnerCount = Math.min(giveaway.winners, entries.length);
    const winnerIds: string[] = [];
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    for (let i = 0; i < winnerCount; i++) {
      winnerIds.push(shuffled[i]);
    }

    endGiveaway(messageId, winnerIds);

    const resultE = embed('🎉 Giveaway Ended', `**${giveaway.prize}**`)
      .setColor(COLORS.warning)
      .addFields(
        { name: 'Winners', value: winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join(', ') : 'No entries' },
      );

    await msg.edit({ embeds: [resultE] });
    if (winnerIds.length > 0) {
      await channel.send(`Congratulations ${winnerIds.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`);
    }

    await interaction.editReply({ embeds: [embed('Giveaway Ended', 'Giveaway ended successfully.')] });
    return;
  }

  if (sub === 'reroll') {
    const messageId = interaction.options.getString('message_id', true);
    const giveaway = getGiveaway(messageId);
    if (!giveaway) {
      await interaction.reply({ embeds: [embed('Not Found', 'Giveaway not found.')], flags: MessageFlags.Ephemeral });
      return;
    }

    const oldWinners: string[] = JSON.parse(giveaway.winner_ids || '[]');
    const shuffled = [...oldWinners].sort(() => Math.random() - 0.5);
    const rerolled = shuffled.slice(0, giveaway.winners);

    const e = embed('🎉 Giveaway Rerolled', `**${giveaway.prize}**\nNew winners: ${rerolled.length > 0 ? rerolled.map(id => `<@${id}>`).join(', ') : 'No valid winners'}`).setColor(COLORS.warning);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'delete') {
    const messageId = interaction.options.getString('message_id', true);
    deleteGiveaway(messageId);
    await interaction.reply({ embeds: [embed('Giveaway Deleted', 'Giveaway deleted.')], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'list') {
    const giveaways = getGuildGiveaways(guildId);
    if (giveaways.length === 0) {
      await interaction.reply({ embeds: [embed('Giveaways', 'No giveaways.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const desc = giveaways.map((g: any) => `**${g.prize}** — ${g.ended ? 'Ended' : `<t:${Math.floor(g.end_time / 1000)}:R>`} — Winners: ${g.winners} — [Jump](https://discord.com/channels/${guildId}/${g.channel_id}/${g.message_id})`).join('\n');
    const e = embed('Giveaways', desc).setColor(COLORS.info);
    await interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ embeds: [embed('Error', 'Unknown subcommand.')], flags: MessageFlags.Ephemeral });
}
