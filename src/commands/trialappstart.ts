import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder } from 'discord.js';
import { COLORS } from '../utils/embed';
import { getTrialAppChannel, getForms } from '../utils/trialapps';

type AppState = {
  guildId: string;
  formName: string;
  questions: string[];
  answers: string[];
  currentQ: number;
};

const appStates = new Map<string, AppState>();

function makeContainer(title: string, body: string, accent?: number) {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${title}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .setAccentColor(accent ?? COLORS.accent);
}

async function sendFormSelector(target: any, guildId: string, isUpdate: boolean) {
  const channelId = getTrialAppChannel(guildId);
  if (!channelId) {
    const c = makeContainer('Not Configured', 'This server has not set up an application channel yet. Please try again later.');
    if (isUpdate) await target.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    else await target.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const forms = getForms(guildId);
  if (forms.length === 0) {
    const c = makeContainer('No Forms', 'No application forms are available right now. Please try again later.');
    if (isUpdate) await target.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    else await target.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const options = forms.map((f, i) =>
    new StringSelectMenuOptionBuilder().setLabel(f.name).setDescription(`${f.questions.length} question(s)`).setValue(`${guildId}:${i}`)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('trialapp_form_sel')
    .setPlaceholder('Select an application type...')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Start an Application**'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Select the type of application you want to submit.'))
    .addActionRowComponents(row)
    .setAccentColor(COLORS.accent);

  if (isUpdate) {
    await target.message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
  } else {
    await target.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
}

export default async function trialappstartCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.guild) {
    const c = makeContainer('DM Only', 'Please run this command in my DMs to start an application.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const guilds = interaction.client.guilds.cache;

  if (guilds.size === 0) {
    const c = makeContainer('No Servers', 'The bot is not in any server.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  if (guilds.size === 1) {
    await sendFormSelector(interaction, guilds.first()!.id, false);
    return;
  }

  const options = guilds.map(g =>
    new StringSelectMenuOptionBuilder().setLabel(g.name).setValue(g.id)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('trialapp_guild_sel')
    .setPlaceholder('Select a server...')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Select a Server**'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Which server would you like to apply to?'))
    .addActionRowComponents(row)
    .setAccentColor(COLORS.accent);

  await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleGuildSelect(interaction: any) {
  await interaction.deferUpdate();
  await sendFormSelector(interaction, interaction.values[0], true);
}

export async function handleFormSelect(interaction: any) {
  const raw = interaction.values[0];
  const [guildId, formIndexStr] = raw.split(':');
  const formIndex = parseInt(formIndexStr);
  const forms = getForms(guildId);
  const form = forms[formIndex];
  if (!form) {
    const c = makeContainer('Not Found', 'That form no longer exists.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  appStates.set(interaction.user.id, {
    guildId,
    formName: form.name,
    questions: form.questions,
    answers: [],
    currentQ: 0
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('trialapp_form_start').setLabel('Start').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('trialapp_form_stop').setLabel('Stop').setStyle(ButtonStyle.Danger),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${form.name}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Press **Start** to begin your application or **Stop** to cancel.'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addActionRowComponents(row)
    .setAccentColor(COLORS.accent);

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleFormStart(interaction: any) {
  const state = appStates.get(interaction.user.id);
  if (!state) {
    const c = makeContainer('Not Found', 'No pending application found.');
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [c], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const q = state.questions[0];
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **Application: ${state.formName}**`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Question 1/${state.questions.length}**\n\n${q}\n\nType your answer in this DM.`))
    .setAccentColor(COLORS.accent);

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleDmMessage(message: any): Promise<boolean> {
  if (message.author.bot || message.guild) return false;

  const state = appStates.get(message.author.id);
  if (!state) return false;

  const answer = message.content.trim();
  if (!answer) {
    try {
      const c = makeContainer('No Answer', 'Please provide an answer.');
      await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    } catch {}
    return true;
  }

  state.answers.push(answer);
  state.currentQ++;

  try {
    if (state.currentQ >= state.questions.length) {
      const lines = state.questions.map((q, i) => `**${q}**\n${state.answers[i]}`).join('\n\n');
      const c = makeContainer('Answer Recorded', 'Answer recorded! Review your application below.');
      await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('trialapp_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('trialapp_cancel').setLabel('Cancel form').setStyle(ButtonStyle.Danger),
      );

      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **Review Your ${state.formName} Application**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addActionRowComponents(row)
        .setAccentColor(COLORS.accent);

      await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } else {
      const q = state.questions[state.currentQ];
      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **Application: ${state.formName}**`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Question ${state.currentQ + 1}/${state.questions.length}**\n\n${q}\n\nType your answer in this DM.`))
        .setAccentColor(COLORS.accent);

      await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  } catch (e) {
    console.error('TrialApp DM error:', e);
  }

  return true;
}

export async function handleAccept(interaction: any) {
  const state = appStates.get(interaction.user.id);
  if (!state) {
    const c = makeContainer('Not Found', 'No pending application found.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  const guildId = state.guildId;
  const channelId = getTrialAppChannel(guildId);
  if (!channelId) {
    const c = makeContainer('Not Configured', 'Application channel is no longer configured.');
    await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) {
      const c = makeContainer('Not Found', 'Could not find the server.');
      await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
      return;
    }

    const channel = (guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null)) as any;
    if (!channel?.isTextBased()) {
      const c = makeContainer('Invalid Channel', 'Application channel is invalid.');
      await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
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

    const encodedForm = state.formName.replace(/:/g, '-');
    const acceptId = `tapp_acc_${user.id}:${encodedForm}`;
    const denyId = `tapp_den_${user.id}:${encodedForm}`;

    const userText = [
      `**User:** @${user.username}`,
      `**ID:** ${user.id}`,
      `**Mention:** <@${user.id}>`,
      `**Created:** <t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
      `**Banner color:** ${bannerColor}`,
      `**Avatar:** [global](${globalAvatar}) / [server](${serverAvatar})`,
    ].join('\n');

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# **${user.username}'s ${state.formName}**`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**User**\n${userText}`))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Server**\nJoined: <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`))
      .setAccentColor(color);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(acceptId).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(denyId).setLabel('Deny').setStyle(ButtonStyle.Danger),
    );

    const msg = await channel.send({ components: [container, row], flags: MessageFlags.IsComponentsV2 });
    const thread = await msg.startThread({ name: threadName });

    const lines = state.questions
      .map((q, i) => `> ${i + 1}. ${q}\n> ${state.answers[i] || '*no response*'}`)
      .join('\n\n');

    const answersContainer = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Application Answers**'))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
      .setAccentColor(color);

    await thread.send({ components: [answersContainer], flags: MessageFlags.IsComponentsV2 });

    appStates.delete(interaction.user.id);
    const c = makeContainer('Submitted', 'Your application has been submitted!');
    await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
  } catch (e: any) {
    const c = makeContainer('Failed', `Failed to submit application: ${e.message}`);
    await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
  }
}

export async function handleCancel(interaction: any) {
  appStates.delete(interaction.user.id);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Application Cancelled**'))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Your application has been cancelled. No information was saved.'))
    .setAccentColor(COLORS.accent);

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

export async function handleChannelDecision(interaction: any) {
  const customId = interaction.customId;
  const isAccept = customId.startsWith('tapp_acc_');
  const payload = customId.startsWith('tapp_acc_')
    ? customId.slice('tapp_acc_'.length)
    : customId.slice('tapp_den_'.length);
  const colonIdx = payload.indexOf(':');
  const userId = colonIdx >= 0 ? payload.slice(0, colonIdx) : payload;
  const formName = colonIdx >= 0 ? payload.slice(colonIdx + 1) : 'application';

  if (userId) {
    try {
      const user = await interaction.client.users.fetch(userId);
      await user.send(`${isAccept ? '✅' : '❌'} Your **${formName}** application has been ${isAccept ? 'accepted' : 'denied'}.`);
    } catch {}
  }

  const topRow = interaction.message.components?.[0];
  const acceptBtn = topRow?.components?.find((c: any) => c.customId?.startsWith('tapp_acc_'));
  const denyBtn = topRow?.components?.find((c: any) => c.customId?.startsWith('tapp_den_'));

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(acceptBtn?.customId || 'tapp_acc_unknown').setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId(denyBtn?.customId || 'tapp_den_unknown').setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(true),
  );

  await interaction.message.edit({ components: [disabledRow] });

  const c = makeContainer('Decision Recorded', `Application ${isAccept ? 'accepted' : 'denied'} successfully.`);
  await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

module.exports = { default: trialappstartCommand, handleGuildSelect, handleFormSelect, handleFormStart, handleDmMessage, handleAccept, handleCancel, handleChannelDecision, appStates };
