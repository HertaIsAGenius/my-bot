import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { embed } from '../utils/embed';

const PERMISSIONS = '8'; // Administrator

export default async function inviteCommand(interaction: ChatInputCommandInteraction) {
  const clientId = interaction.client.user?.id || process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    await interaction.reply({ embeds: [embed('Error', 'Could not determine bot client ID.')], flags: MessageFlags.Ephemeral });
    return;
  }

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${PERMISSIONS}&scope=bot+applications.commands`;

  await interaction.reply({
    embeds: [embed('Invite Me', `[Click here to add me to your server](${url})`)],
    flags: MessageFlags.Ephemeral,
  });
}
