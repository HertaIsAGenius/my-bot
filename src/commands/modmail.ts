import { ChatInputCommandInteraction, MessageFlags, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { COLORS } from '../utils/embed';
import { setModMailChannel } from '../utils/db';

function makeContainer(title: string, body: string, accent?: number) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .setAccentColor(accent ?? COLORS.accent);
}

export default async function modmailCommand(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel', true);
    setModMailChannel(interaction.guildId!, channel.id);
    const c = makeContainer('Channel Set', `ModMail channel set to <#${channel.id}>.`);
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  } else if (sub === 'remove') {
    setModMailChannel(interaction.guildId!, null);
    const c = makeContainer('Channel Removed', 'ModMail channel has been removed.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}
