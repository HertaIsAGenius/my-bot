import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  GuildMember,
  MessageFlags
} from 'discord.js';

export default async function verifypanelCommand(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('verify_panel_modal')
    .setTitle('Verification Panel Setup')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('webhook_name')
          .setLabel('Webhook Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Verification')
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('webhook_avatar')
          .setLabel('Webhook Profile Picture (URL)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://i.imgur.com/example.png')
          .setRequired(false)
          .setMaxLength(500)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('button_text')
          .setLabel('Text on Button')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Verify')
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('message_text')
          .setLabel('Text Being Sent by Webhook')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Click the button below to get verified!')
          .setRequired(true)
          .setMaxLength(2000)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('role_id')
          .setLabel('Role to Add (ID or @mention)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('123456789012345678')
          .setRequired(true)
          .setMaxLength(30)
      )
    );

  await interaction.showModal(modal);
}

export async function handleVerifyPanelSubmit(interaction: any) {
  const webhookName = interaction.fields.getTextInputValue('webhook_name');
  const avatarUrl = interaction.fields.getTextInputValue('webhook_avatar') || '';
  const buttonText = interaction.fields.getTextInputValue('button_text');
  const messageText = interaction.fields.getTextInputValue('message_text');
  const roleInput = interaction.fields.getTextInputValue('role_id');

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'This must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const roleId = roleInput.replace(/[<@&>]/g, '');
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: 'Invalid role. Please provide a valid role ID or mention.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channel = interaction.channel as TextChannel;
    if (!channel.isTextBased() || channel.isDMBased()) {
      await interaction.editReply({ content: 'This command must be used in a text channel.' });
      return;
    }

    const whOptions: any = { name: webhookName };
    if (avatarUrl) {
      try {
        const res = await fetch(avatarUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        whOptions.avatar = buf;
      } catch {}
    }

    const webhook = await channel.createWebhook(whOptions);

    const button = new ButtonBuilder()
      .setCustomId(`verify_grant_${role.id}`)
      .setLabel(buttonText)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await webhook.send({ content: messageText, components: [row] });

    await interaction.editReply({ content: `Verification panel sent in ${channel} with role **@${role.name}**.` });
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to create verification panel: ${e.message}` });
  }
}

export async function handleVerifyButton(interaction: any) {
  const roleId = interaction.customId.replace('verify_grant_', '');
  const member = interaction.member as GuildMember;

  if (!member || !interaction.guild) {
    await interaction.reply({ content: 'This must be used in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: 'The role no longer exists.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (member.roles.cache.has(roleId)) {
    await interaction.reply({ content: 'You already have this role!', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await member.roles.add(roleId);
    await interaction.reply({ content: `You have been given the **@${role.name}** role.`, flags: MessageFlags.Ephemeral });
  } catch (e: any) {
    await interaction.reply({ content: `Failed to add role: ${e.message}`, flags: MessageFlags.Ephemeral });
  }
}
