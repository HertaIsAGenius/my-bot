import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { getTrialAppChannel, getForms, getForm } from '../utils/trialapps';

const guildId = process.env.GUILD_ID || '';

const appStates = new Map<string, {
  formName: string;
  questions: string[];
  answers: string[];
  currentQ: number;
}>();

export default async function trialappstartCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.guild) {
    await interaction.reply({ content: 'Please run this command in my DMs to start an application.', flags: MessageFlags.Ephemeral });
    return;
  }

  const channelId = getTrialAppChannel(guildId);
  if (!channelId) {
    await interaction.reply({ content: 'This server has not set up an application channel yet. Please try again later.', flags: MessageFlags.Ephemeral });
    return;
  }

  const forms = getForms(guildId);
  if (forms.length === 0) {
    await interaction.reply({ content: 'No application forms are available right now. Please try again later.', flags: MessageFlags.Ephemeral });
    return;
  }

  const options = forms.map(f =>
    new StringSelectMenuOptionBuilder().setLabel(f.name).setDescription(`${f.questions.length} question(s)`).setValue(f.name)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('trialapp_form_sel')
    .setPlaceholder('Select an application type...')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const embed = new EmbedBuilder()
    .setColor(0x2B3A67)
    .setTitle('Start an Application')
    .setDescription('Select the type of application you want to submit.');

  await interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleFormSelect(interaction: any) {
  const formName = interaction.values[0];
  const form = getForm(guildId, formName);
  if (!form) {
    await interaction.reply({ content: 'That form no longer exists.', flags: MessageFlags.Ephemeral });
    return;
  }

  appStates.set(interaction.user.id, {
    formName,
    questions: form.questions,
    answers: [],
    currentQ: 0
  });

  const q = form.questions[0];
  const embed = new EmbedBuilder()
    .setColor(0x2B3A67)
    .setTitle(`Application: ${formName}`)
    .setDescription(`**Question 1/${form.questions.length}**\n\n${q}\n\nType your answer in this DM.`);

  await interaction.update({ embeds: [embed], components: [] });
}

export async function handleDmMessage(message: any): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  const state = appStates.get(message.author.id);
  if (!state) return false;

  const answer = message.content.trim();
  if (!answer) {
    try { await message.reply('Please provide an answer.'); } catch {}
    return true;
  }

  state.answers.push(answer);
  state.currentQ++;

  try {
    if (state.currentQ >= state.questions.length) {
      const lines = state.questions.map((q, i) => `**${q}**\n${state.answers[i]}`).join('\n\n');
      await message.reply('Answer recorded! Review your application below.');
      const embed = new EmbedBuilder()
        .setColor(0x2B3A67)
        .setTitle(`Review Your ${state.formName} Application`)
        .setDescription(lines);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('trialapp_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('trialapp_cancel').setLabel('Cancel form').setStyle(ButtonStyle.Danger),
      );

      await message.channel.send({ embeds: [embed], components: [row] });
    } else {
      const q = state.questions[state.currentQ];
      const embed = new EmbedBuilder()
        .setColor(0x2B3A67)
        .setTitle(`Application: ${state.formName}`)
        .setDescription(`**Question ${state.currentQ + 1}/${state.questions.length}**\n\n${q}\n\nType your answer in this DM.`);
      await message.channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error('TrialApp DM error:', e);
  }

  return true;
}

export async function handleAccept(interaction: any) {
  const state = appStates.get(interaction.user.id);
  if (!state) {
    await interaction.reply({ content: 'No pending application found.', flags: MessageFlags.Ephemeral });
    return;
  }

  const channelId = getTrialAppChannel(guildId);
  if (!channelId) {
    await interaction.reply({ content: 'Application channel is no longer configured.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) {
      await interaction.editReply({ content: 'Could not find the server.' });
      return;
    }

    const channel = (guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null)) as any;
    if (!channel?.isTextBased()) {
      await interaction.editReply({ content: 'Application channel is invalid.' });
      return;
    }

    const cleanName = state.formName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const threadName = `${cleanName}-${interaction.user.username}`;

    const color = state.formName.toLowerCase().includes('helper')
      ? 0xFFFF00
      : state.formName.toLowerCase().includes('moderator')
        ? 0x8B00FF
        : 0x2B3A67;

    const user = interaction.user;
    const member = await guild.members.fetch(user.id);

    const bannerColor = user.hexAccentColor || '#0099ff';
    const globalAvatar = user.displayAvatarURL({ size: 1024 });
    const serverAvatar = member.displayAvatarURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${user.username}'s ${state.formName}`)
      .setThumbnail(globalAvatar)
      .addFields(
        {
          name: 'User',
          value: [
            `User: @${user.username}`,
            `ID: ${user.id}`,
            `Mention: <@${user.id}>`,
            `Created: <t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
            `Banner color: ${bannerColor}`,
            `Avatar: [global](${globalAvatar}) / [server](${serverAvatar})`,
          ].join('\n'),
        },
        {
          name: 'Server',
          value: `Joined: <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`,
        },
      );

    const lines = state.questions
      .map((q, i) => `> ${i + 1}. ${q}\n> ${state.answers[i] || '*no response*'}`)
      .join('\n\n');

    const answersEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle('Application Answers')
      .setDescription(lines);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('trialapp_channel_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('trialapp_channel_deny').setLabel('Deny').setStyle(ButtonStyle.Danger),
    );

    const message = await channel.send({ embeds: [embed], components: [row] });
    const thread = await message.startThread({ name: threadName });
    await thread.send({ embeds: [answersEmbed] });

    appStates.delete(interaction.user.id);
    await interaction.editReply({ content: `Your application has been submitted!` });
  } catch (e: any) {
    await interaction.editReply({ content: `Failed to submit application: ${e.message}` });
  }
}

export async function handleCancel(interaction: any) {
  appStates.delete(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(0x2B3A67)
    .setTitle('Application Cancelled')
    .setDescription('Your application has been cancelled. No information was saved.');
  await interaction.update({ embeds: [embed], components: [] });
}

export async function handleChannelDecision(interaction: any) {
  const isAccept = interaction.customId === 'trialapp_channel_accept';
  const formName = interaction.message.embeds[0]?.title?.replace(/^[^']+'s /, '') || 'application';

  const mentionField = interaction.message.embeds[0]?.fields?.find((f: any) => f.name === 'User')?.value || '';
  const mentionMatch = mentionField.match(/<@(\d+)>/);
  const userId = mentionMatch ? mentionMatch[1] : null;

  if (userId) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send(`${isAccept ? '✅' : '❌'} Your **${formName}** application has been ${isAccept ? 'accepted' : 'denied'}.`);
    } catch {}
  }

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('trialapp_channel_accept').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId('trialapp_channel_deny').setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(true),
  );

  await interaction.message.edit({ components: [disabledRow] });
  await interaction.reply({ content: `Application ${isAccept ? 'accepted' : 'denied'} successfully.`, flags: MessageFlags.Ephemeral });
}

module.exports = { default: trialappstartCommand, handleFormSelect, handleDmMessage, handleAccept, handleCancel, handleChannelDecision, appStates };
